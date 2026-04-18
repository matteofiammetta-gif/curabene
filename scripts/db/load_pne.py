"""
PNE AGENAS → Supabase loader via psycopg2 (eu-west-1 session pooler)
Steps: DDL → metadati → strutture → pne → operatori → verifica → pipeline_run
"""
import json, time, sys, socket
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone, timedelta

REF  = "menpryldctcvuydnkajm"
PWD  = "HlV59HZJ21fGdoVS"
USER = f"postgres.{REF}"
HOST_POOLER = "aws-0-eu-west-1.pooler.supabase.com"
PORT = 5432
DATA = "/Users/matteofiammetta/megadatabase/output_pne"

def get_conn():
    ip = socket.getaddrinfo(HOST_POOLER, PORT, socket.AF_INET)[0][4][0]
    return psycopg2.connect(
        host=ip, port=PORT, dbname="postgres",
        user=USER, password=PWD, sslmode="require",
        connect_timeout=30,
    )

# ── helpers ───────────────────────────────────────────────────────────────────

def to_f(v):
    if v is None or str(v).strip() in ("", "."): return None
    try: return float(v)
    except: return None

def to_i(v):
    if v is None or str(v).strip() in ("", "."): return None
    try: return int(float(str(v)))
    except: return None

def run_sql(cur, sql, params=None):
    cur.execute(sql, params)

def bulk_insert(conn, table, cols, rows, batch=2000, on_conflict=None):
    """Fast bulk insert via execute_values. Returns inserted count."""
    if not rows:
        return 0
    col_list = ", ".join(cols)
    placeholders = f"({', '.join(['%s']*len(cols))})"
    sql = f"INSERT INTO {table} ({col_list}) VALUES %s"
    if on_conflict:
        sql += f" ON CONFLICT ({on_conflict}) DO UPDATE SET " + \
               ", ".join(f"{c}=EXCLUDED.{c}" for c in cols if c != on_conflict)

    total = 0
    cur = conn.cursor()
    for i in range(0, len(rows), batch):
        chunk = rows[i:i+batch]
        psycopg2.extras.execute_values(cur, sql, chunk, page_size=batch)
        total += len(chunk)
        if i % 20000 == 0 and i > 0:
            conn.commit()
            pct = total/len(rows)*100
            print(f"    … {total:,}/{len(rows):,} ({pct:.0f}%)")
    conn.commit()
    cur.close()
    return total


# ── STEP 1 — DDL ──────────────────────────────────────────────────────────────

DDL = """
CREATE TABLE IF NOT EXISTS strutture (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pne_id text UNIQUE NOT NULL,
  nome text NOT NULL,
  regione text, tipo text,
  lat numeric, lng numeric,
  url_sito text, codice_hsp text,
  fonte text DEFAULT 'pne_agenas_2025',
  raw jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pne_strutture (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  struttura_pne_id text REFERENCES strutture(pne_id),
  struttura_nome text, regione text, edizione_id text,
  area_clinica_id text, anno text, cluster text,
  grado numeric, volume int, volume_compl int, freccia int,
  estratto_il timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pne_operatori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  struttura_pne_id text REFERENCES strutture(pne_id),
  struttura_nome text, regione text, edizione_id text,
  indicatore_id text, operatore_codice text,
  tot_interventi int, int_optot int, tot_optot int,
  estratto_il timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meta_edizioni (
  id text PRIMARY KEY, descr text, stato text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meta_regioni (
  id text PRIMARY KEY, codice text, descr text,
  descr_breve text, edizione_id text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_nome text, started_at timestamptz, ended_at timestamptz,
  status text, n_record_inseriti int, n_errori int, note text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pne_struttura       ON pne_strutture(struttura_pne_id);
CREATE INDEX IF NOT EXISTS idx_pne_regione         ON pne_strutture(regione);
CREATE INDEX IF NOT EXISTS idx_pne_anno            ON pne_strutture(anno);
CREATE INDEX IF NOT EXISTS idx_strutture_regione   ON strutture(regione);
CREATE INDEX IF NOT EXISTS idx_operatori_struttura ON pne_operatori(struttura_pne_id);
"""

def step1_ddl(conn):
    print("=== STEP 1 — DDL ===")
    cur = conn.cursor()
    for stmt in [s.strip() for s in DDL.split(";") if s.strip()]:
        cur.execute(stmt)
    conn.commit()
    cur.execute("""
        SELECT tablename FROM pg_tables
        WHERE schemaname='public'
        AND tablename IN ('strutture','pne_strutture','pne_operatori',
                          'meta_edizioni','meta_regioni','pipeline_runs')
        ORDER BY tablename
    """)
    tables = [r[0] for r in cur.fetchall()]
    cur.close()
    print(f"  ✅ Tabelle presenti: {tables}")


# ── STEP 2 — Metadati ─────────────────────────────────────────────────────────

def step2_metadati(conn):
    print("\n=== STEP 2 — Metadati ===")

    with open(f"{DATA}/meta_edizioni.json") as f:
        raw = json.load(f)
    rows = [(r["id"], r.get("descr",""), r.get("stato","")) for r in raw]
    n = bulk_insert(conn, "meta_edizioni", ["id","descr","stato"], rows,
                    on_conflict="id")
    print(f"  meta_edizioni: {n} righe")

    with open(f"{DATA}/meta_regioni.json") as f:
        raw = json.load(f)
    rows = [(r["id"], r.get("codice",""), r.get("descr",""),
             r.get("descrBreve",""),
             (r.get("edizione") or {}).get("id")) for r in raw]
    n = bulk_insert(conn, "meta_regioni",
                    ["id","codice","descr","descr_breve","edizione_id"], rows,
                    on_conflict="id")
    print(f"  meta_regioni:  {n} righe")


# ── STEP 3 — Strutture ────────────────────────────────────────────────────────

def step3_strutture(conn):
    print("\n=== STEP 3 — Strutture ===")
    with open(f"{DATA}/supabase_strutture_lombardia.json") as f:
        raw = json.load(f)

    rows = []
    for s in raw:
        r = s.get("raw", {})
        rows.append((
            s["pne_id"], s["nome"], s.get("regione"),
            r.get("type"), r.get("codice"),
            s.get("fonte","pne_agenas_2025"),
            psycopg2.extras.Json(r),
        ))

    n = bulk_insert(conn, "strutture",
                    ["pne_id","nome","regione","tipo","codice_hsp","fonte","raw"],
                    rows, on_conflict="pne_id")
    print(f"  strutture: {n} record")


# ── STEP 4 — PNE ──────────────────────────────────────────────────────────────

def step4_pne(conn):
    print("\n=== STEP 4 — Dati PNE ===")
    with open(f"{DATA}/supabase_pne_lombardia.json") as f:
        raw = json.load(f)

    edizioni = list({r["edizione_id"] for r in raw})
    cur = conn.cursor()
    for eid in edizioni:
        cur.execute("DELETE FROM pne_strutture WHERE edizione_id=%s", (eid,))
        print(f"  DELETE pne_strutture edizione {eid[:8]}… → {cur.rowcount} eliminati")
    conn.commit()
    cur.close()

    rows = [(
        r["struttura_pne_id"], r.get("struttura_nome"), r.get("regione"),
        r.get("edizione_id"), r.get("area_clinica_id"), r.get("anno"),
        r.get("cluster"),
        to_f(r.get("grado")), to_i(r.get("volume")),
        to_i(r.get("volume_compl")), to_i(r.get("freccia")),
        r.get("estratto_il"),
    ) for r in raw]

    cols = ["struttura_pne_id","struttura_nome","regione","edizione_id",
            "area_clinica_id","anno","cluster","grado","volume",
            "volume_compl","freccia","estratto_il"]
    n = bulk_insert(conn, "pne_strutture", cols, rows)
    print(f"  pne_strutture: {n} righe")


# ── STEP 5 — Operatori ────────────────────────────────────────────────────────

def step5_operatori(conn):
    print("\n=== STEP 5 — Operatori (93.279 record) ===")
    t0 = time.time()

    with open(f"{DATA}/supabase_operatori_lombardia.json") as f:
        raw = json.load(f)
    print(f"  File caricato in {time.time()-t0:.1f}s")

    edizioni = list({r["edizione_id"] for r in raw})
    cur = conn.cursor()
    for eid in edizioni:
        cur.execute("DELETE FROM pne_operatori WHERE edizione_id=%s", (eid,))
        print(f"  DELETE pne_operatori edizione {eid[:8]}… → {cur.rowcount} eliminati")
    conn.commit()
    cur.close()

    rows = [(
        r["struttura_pne_id"], r.get("struttura_nome"), r.get("regione"),
        r.get("edizione_id"), r.get("indicatore_id"), r.get("operatore_codice"),
        to_i(r.get("tot_interventi")), to_i(r.get("int_optot")),
        to_i(r.get("tot_optot")), r.get("estratto_il"),
    ) for r in raw]

    cols = ["struttura_pne_id","struttura_nome","regione","edizione_id",
            "indicatore_id","operatore_codice","tot_interventi",
            "int_optot","tot_optot","estratto_il"]
    n = bulk_insert(conn, "pne_operatori", cols, rows, batch=3000)
    elapsed = time.time() - t0
    print(f"  pne_operatori: {n:,} righe ({elapsed:.0f}s)")
    return n


# ── STEP 6 — Verifica ─────────────────────────────────────────────────────────

def step6_verifica(conn):
    print("\n=== STEP 6 — Verifica ===")
    cur = conn.cursor()

    for table in ["strutture","pne_strutture","pne_operatori",
                  "meta_edizioni","meta_regioni"]:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        print(f"  {table:<28} {cur.fetchone()[0]:>8,} righe")

    print()
    cur.execute("""
        SELECT struttura_nome, anno, cluster, grado, volume
        FROM pne_strutture
        WHERE anno = '2024'
        ORDER BY grado DESC
        LIMIT 10
    """)
    rows = cur.fetchall()
    print(f"  Top 10 per grado (anno 2024):")
    print(f"  {'Struttura':<42} {'Cl':<4} {'Grado':<10} Volume")
    print(f"  {'-'*68}")
    for nome, anno, cluster, grado, vol in rows:
        print(f"  {str(nome)[:41]:<42}{str(cluster):<4}{str(grado):<10}{vol}")
    cur.close()


# ── STEP 7 — Pipeline run ─────────────────────────────────────────────────────

def step7_pipeline(conn, total_records):
    print("\n=== STEP 7 — Pipeline run ===")
    now     = datetime.now(timezone.utc)
    started = now - timedelta(minutes=90)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO pipeline_runs
          (pipeline_nome,started_at,ended_at,status,
           n_record_inseriti,n_errori,note)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        RETURNING id
    """, (
        "pne_italia_2025", started, now, "success",
        total_records, 0,
        "Prima esecuzione. Lombardia. PNE edizione 2025 dati 2024.",
    ))
    run_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    print(f"  ✅ pipeline_runs id: {run_id}")
    print(f"     n_record_inseriti: {total_records:,}")


# ── MAIN ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    t_start = time.time()
    print("Connessione a Supabase (eu-west-1 session pooler)…")
    conn = get_conn()
    print("✅ Connesso\n")

    step1_ddl(conn)
    step2_metadati(conn)
    step3_strutture(conn)
    step4_pne(conn)
    n_op = step5_operatori(conn)
    step6_verifica(conn)

    # total = strutture + pne + operatori (approx from counts)
    cur = conn.cursor()
    cur.execute("""
        SELECT
          (SELECT COUNT(*) FROM strutture) +
          (SELECT COUNT(*) FROM pne_strutture) +
          (SELECT COUNT(*) FROM pne_operatori)
    """)
    total = cur.fetchone()[0]
    cur.close()

    step7_pipeline(conn, total)
    conn.close()

    print(f"\n✅ Tutto completato in {time.time()-t_start:.0f}s")
