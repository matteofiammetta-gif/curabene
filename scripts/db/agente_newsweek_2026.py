"""
Agente Newsweek 2026 — inserisce ranking globali e specialità per ospedali italiani.
Dati: Newsweek World's Best Hospitals 2026.
"""
import socket, logging, json
import psycopg2

REF  = "menpryldctcvuydnkajm"
PWD  = "HlV59HZJ21fGdoVS"
HOST = "aws-0-eu-west-1.pooler.supabase.com"

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

def get_conn():
    ip = socket.getaddrinfo(HOST, 5432, socket.AF_INET)[0][4][0]
    return psycopg2.connect(host=ip, port=5432, dbname="postgres",
        user=f"postgres.{REF}", password=PWD, sslmode="require", connect_timeout=30)

# (rank_globale, rank_italia, WHERE clause SQL)
RANKINGS_GLOBALI = [
    (33,   1, "nome ILIKE '%gemelli%'"),
    (43,   2, "nome ILIKE '%niguarda%'"),
    (51,   3, "nome ILIKE '%humanitas%' AND nome NOT ILIKE '%university%'"),
    (57,   4, "nome ILIKE '%raffaele%'"),
    (76,   5, "nome ILIKE '%orsola%'"),
    (104,  6, "nome ILIKE '%papa giovanni%'"),
    (127,  7, "nome ILIKE '%padov%' AND nome ILIKE '%universitari%'"),
    (134,  8, "nome ILIKE '%matteo%' AND nome ILIKE '%pavia%'"),
    (142,  9, "nome ILIKE '%borgo trento%' OR (nome ILIKE '%verona%' AND nome ILIKE '%universitari%')"),
    (192, 10, "nome ILIKE '%careggi%'"),
    (198, 11, "nome ILIKE '%modena%' AND nome ILIKE '%policlinico%'"),
]

# (WHERE clause SQL, dict specialità)
RANKINGS_SPECIALITA = [
    ("nome ILIKE '%gemelli%'",
     {"oncologia":29,"cardiologia":34,"pneumologia":1,"gastroenterologia":10,"endocrinologia":34}),
    ("nome ILIKE '%ieo%' OR nome ILIKE '%europeo oncologia%'",
     {"oncologia":11}),
    ("nome ILIKE '%istituto nazionale tumori%' AND nome ILIKE '%milano%'",
     {"oncologia":27}),
    ("nome ILIKE '%humanitas%' AND nome NOT ILIKE '%university%'",
     {"oncologia":45,"cardiologia":51}),
    ("nome ILIKE '%niguarda%'",
     {"oncologia":62}),
    ("nome ILIKE '%raffaele%'",
     {"oncologia":70,"cardiologia":23,"endocrinologia":36}),
    ("nome ILIKE '%monzino%'",
     {"cardiologia":14}),
    ("nome ILIKE '%rizzoli%'",
     {"ortopedia":11}),
    ("nome ILIKE '%galeazzi%'",
     {"ortopedia":41}),
    ("nome ILIKE '%bambin%' OR nome ILIKE '%bambino%'",
     {"pediatria":6}),
    ("nome ILIKE '%pascale%'",
     {"oncologia":60}),
]

def main():
    log.info("=== AGENTE NEWSWEEK 2026 ===")
    conn = get_conn()
    cur  = conn.cursor()

    cur.execute("""INSERT INTO pipeline_runs (pipeline_nome, status, started_at)
        VALUES ('newsweek_2026', 'running', NOW()) RETURNING id""")
    run_id = cur.fetchone()[0]
    conn.commit()
    log.info(f"✅ Connesso — run_id={run_id}")

    # Reset precedenti
    cur.execute("UPDATE strutture SET newsweek_rank_globale=NULL, newsweek_rank_italia=NULL, newsweek_anno=NULL, newsweek_specialita_ranks=NULL")
    conn.commit()
    log.info("  Reset precedenti newsweek")

    totale_aggiornati = 0

    log.info("\n--- Rankings globali ---")
    for rg, ri, where in RANKINGS_GLOBALI:
        # Escape % per psycopg2 (ILIKE usa %, psycopg2 usa %s)
        safe_where = where.replace("%", "%%")
        cur.execute(
            f"UPDATE strutture SET newsweek_rank_globale=%s, newsweek_rank_italia=%s, newsweek_anno=2026 WHERE {safe_where}",
            (rg, ri))
        n = cur.rowcount
        totale_aggiornati += n
        log.info(f"  Italia #{ri:2d} | Global #{rg:3d} | {n} riga/e | {where[:60]}")

    conn.commit()

    log.info("\n--- Specialità ---")
    for where, specs in RANKINGS_SPECIALITA:
        safe_where = where.replace("%", "%%")
        cur.execute(
            f"UPDATE strutture SET newsweek_specialita_ranks=%s WHERE {safe_where}",
            (json.dumps(specs),))
        n = cur.rowcount
        log.info(f"  {n} riga/e | {specs} | {where[:50]}")

    conn.commit()

    cur.execute("""UPDATE pipeline_runs SET status='success', ended_at=NOW(),
        n_record_inseriti=%s WHERE id=%s""", (totale_aggiornati, run_id))
    conn.commit()

    # Verifica
    cur.execute("""
        SELECT nome, newsweek_rank_italia, newsweek_rank_globale, newsweek_specialita_ranks
        FROM strutture
        WHERE newsweek_rank_globale IS NOT NULL
        ORDER BY newsweek_rank_italia
    """)
    rows = cur.fetchall()
    log.info(f"\n{'='*85}")
    log.info(f"COMPLETATO: {totale_aggiornati} strutture con ranking globale")
    log.info(f"{'='*85}")
    log.info(f"\n  {'#IT':>4} {'#GL':>5}  {'Nome':<45}  Specialità")
    log.info(f"  {'-'*95}")
    for r in rows:
        specs = ""
        if r[3]:
            d = r[3] if isinstance(r[3], dict) else {}
            specs = ", ".join(f"{k}:{v}" for k, v in d.items())
        log.info(f"  {(r[1] or 0):>4} {(r[2] or 0):>5}  {str(r[0])[:44]:<45}  {specs}")

    cur.close(); conn.close()

if __name__ == "__main__":
    main()
