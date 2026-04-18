"""
Carica CSV direttori struttura complessa → Supabase (tabella medici)
Steps: leggi CSV → dedup → fuzzy match azienda→struttura_pne_id → upsert
"""
import csv, socket, difflib, unicodedata, re
from datetime import date, datetime
import psycopg2, psycopg2.extras

CSV_PATH = "/Users/matteofiammetta/Documents/Downloads/END_62_20260418.csv"
REF  = "menpryldctcvuydnkajm"
PWD  = "HlV59HZJ21fGdoVS"
HOST = "aws-0-eu-west-1.pooler.supabase.com"
TODAY = date.today()

STOP_WORDS = [
    "asst", "asl", "irccs", "fondazione", "istituto", "istituti",
    "azienda ospedaliero universitaria", "azienda ospedaliera universitaria",
    "azienda ospedaliero-universitaria", "azienda ospedaliera",
    "azienda sanitaria locale", "azienda sanitaria",
    "azienda usl", "azienda ulss", "azienda usl toscana",
    "ospedale", "policlinico", "centro", "presidio", "presidi",
    "societa", "s.p.a", "spa", "srl", "s.r.l",
]

def get_conn():
    ip = socket.getaddrinfo(HOST, 5432, socket.AF_INET)[0][4][0]
    return psycopg2.connect(
        host=ip, port=5432, dbname="postgres",
        user=f"postgres.{REF}", password=PWD,
        sslmode="require", connect_timeout=30,
    )

def normalize(s: str) -> str:
    """Lowercase, strip accents, remove stop words, collapse spaces."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^\w\s]", " ", s.lower())
    # remove stop words (longest first to avoid partial removal)
    for w in sorted(STOP_WORDS, key=len, reverse=True):
        s = re.sub(r'\b' + re.escape(w) + r'\b', " ", s)
    return re.sub(r"\s+", " ", s).strip()

def parse_date(s: str):
    if not s or not s.strip():
        return None
    s = s.strip().split(" ")[0]   # "1962-11-09 00:00:00" → "1962-11-09"
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None

def anni_da(d: date) -> int:
    if not d:
        return 0
    delta = TODAY - d
    return max(0, delta.days // 365)

# ── STEP 1: leggi CSV ─────────────────────────────────────────────────────────
print("=== STEP 1 — Lettura CSV ===")
raw_rows = []
with open(CSV_PATH, encoding="utf-8") as f:
    reader = csv.DictReader(f, delimiter=";")
    for row in reader:
        raw_rows.append(row)

print(f"  Righe totali CSV: {len(raw_rows):,}")

# ── STEP 2: normalizza e dedup ────────────────────────────────────────────────
print("\n=== STEP 2 — Normalizzazione e dedup ===")

def row_to_medico(row):
    cognome = row["cognome_direttore"].strip().title()
    nome    = row["nome_direttore"].strip().title()
    nascita = parse_date(row["data_nascita_direttore"])
    inizio  = parse_date(row["data_inizio_incarico"])
    fine    = parse_date(row["data_fine_incarico"])
    attivo  = (fine is None) or (fine >= TODAY)
    return {
        "cognome":          cognome,
        "nome":             nome,
        "data_nascita":     nascita,
        "codice_regione":   row["codice_regione"].strip(),
        "regione":          row["regione"].strip().title(),
        "codice_azienda":   row["codice_azienda_sanitaria"].strip(),
        "azienda":          row["azienda_sanitaria"].strip().title(),
        "disciplina":       row["disciplina"].strip().title(),
        "codice_disciplina":row["codice_disciplina"].strip(),
        "data_inizio":      inizio,
        "data_fine":        fine,
        "attivo":           attivo,
        "anni_incarico":    anni_da(inizio),
        "_data_fine_raw":   fine,
        "_inizio_ts":       inizio,
    }

all_medici = [row_to_medico(r) for r in raw_rows]

# Dedup: chiave (cognome, nome, data_nascita)
# Priorità: 1) attivo (data_fine None/futura), 2) data_inizio più recente
dedup = {}
for m in all_medici:
    key = (m["cognome"], m["nome"], m["data_nascita"])
    if key not in dedup:
        dedup[key] = m
    else:
        existing = dedup[key]
        # prefer active
        if m["attivo"] and not existing["attivo"]:
            dedup[key] = m
        # same activeness: prefer later start date
        elif m["attivo"] == existing["attivo"]:
            if (m["_inizio_ts"] or date.min) > (existing["_inizio_ts"] or date.min):
                dedup[key] = m

medici_unici = list(dedup.values())
n_attivi = sum(1 for m in medici_unici if m["attivo"])

print(f"  Medici unici dopo dedup: {len(medici_unici):,}")
print(f"  Attivi (data_fine vuota o futura): {n_attivi:,}")
print(f"  Rimossi come duplicati: {len(all_medici) - len(medici_unici):,}")

# ── STEP 3: carica strutture per fuzzy match ──────────────────────────────────
print("\n=== STEP 3 — Fuzzy match azienda → struttura_pne_id ===")
conn = get_conn()
cur  = conn.cursor()
print("  ✅ Connesso a Supabase")

cur.execute("SELECT pne_id, nome FROM strutture ORDER BY nome")
strutture_rows = cur.fetchall()
strutture_map  = {r[1]: r[0] for r in strutture_rows}
strutture_norm = {normalize(nome): (nome, pne_id) for nome, pne_id in strutture_map.items()}
strutture_norm_keys = list(strutture_norm.keys())

def fuzzy_match_azienda(azienda_raw: str, threshold=0.70):
    q = normalize(azienda_raw)
    if not q:
        return None
    # First try exact normalized match
    if q in strutture_norm:
        return strutture_norm[q][1]
    # Fuzzy
    matches = difflib.get_close_matches(q, strutture_norm_keys, n=1, cutoff=threshold)
    if matches:
        return strutture_norm[matches[0]][1]
    return None

# Build pne_id cache keyed by azienda (avoid repeating the match for same azienda)
azienda_cache = {}
matched = 0
unmatched_aziende = set()

for m in medici_unici:
    az = m["azienda"]
    if az not in azienda_cache:
        pne_id = fuzzy_match_azienda(az)
        azienda_cache[az] = pne_id
        if pne_id is None:
            unmatched_aziende.add(az)
    m["struttura_pne_id"] = azienda_cache[az]
    if m["struttura_pne_id"]:
        matched += 1

print(f"  Match trovati: {matched:,}/{len(medici_unici):,} "
      f"({100*matched/len(medici_unici):.1f}%)")
print(f"  Aziende distinte non matchate: {len(unmatched_aziende)}")
if unmatched_aziende:
    for az in sorted(unmatched_aziende)[:10]:
        print(f"    ✗ {az}")
    if len(unmatched_aziende) > 10:
        print(f"    … e altri {len(unmatched_aziende)-10}")

# ── STEP 4: upsert in batch ───────────────────────────────────────────────────
print("\n=== STEP 4 — Upsert in batch ===")
COLS = ["cognome","nome","data_nascita","codice_regione","regione",
        "codice_azienda","azienda","disciplina","codice_disciplina",
        "data_inizio","data_fine","attivo","anni_incarico","struttura_pne_id"]

rows_to_insert = []
for m in medici_unici:
    rows_to_insert.append(tuple(m.get(c) for c in COLS))

col_list   = ", ".join(COLS)
placeholders = f"({', '.join(['%s']*len(COLS))})"
upsert_sql = f"""
INSERT INTO medici ({col_list}) VALUES %s
ON CONFLICT (cognome, nome, data_nascita) DO UPDATE SET
  {', '.join(f'{c}=EXCLUDED.{c}' for c in COLS if c not in ('cognome','nome','data_nascita'))}
"""

BATCH = 500
total_inserted = 0
for i in range(0, len(rows_to_insert), BATCH):
    chunk = rows_to_insert[i:i+BATCH]
    psycopg2.extras.execute_values(cur, upsert_sql, chunk, page_size=BATCH)
    total_inserted += len(chunk)
    pct = total_inserted / len(rows_to_insert) * 100
    print(f"  … {total_inserted:,}/{len(rows_to_insert):,} ({pct:.0f}%)")

conn.commit()
print(f"\n  ✅ Inseriti/aggiornati: {total_inserted:,} medici")

# ── STEP 5: verifica ──────────────────────────────────────────────────────────
print("\n=== STEP 5 — Verifica ===")
cur.execute("SELECT COUNT(*) FROM medici")
print(f"  totale medici:      {cur.fetchone()[0]:>8,}")

cur.execute("SELECT COUNT(*) FROM medici WHERE attivo = true")
print(f"  attivi:             {cur.fetchone()[0]:>8,}")

cur.execute("SELECT COUNT(*) FROM medici WHERE struttura_pne_id IS NOT NULL")
print(f"  con struttura match:{cur.fetchone()[0]:>8,}")

print("\n  Top 10 regioni:")
cur.execute("""
    SELECT regione, COUNT(*) AS n
    FROM medici GROUP BY regione ORDER BY n DESC LIMIT 10
""")
for reg, n in cur.fetchall():
    print(f"    {str(reg):<35} {n:>5}")

print("\n  Top 10 discipline:")
cur.execute("""
    SELECT disciplina, COUNT(*) AS n
    FROM medici GROUP BY disciplina ORDER BY n DESC LIMIT 10
""")
for disc, n in cur.fetchall():
    print(f"    {str(disc):<40} {n:>5}")

cur.close(); conn.close()
print("\n✅ Caricamento medici completato!")
