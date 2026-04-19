"""
Agente OpenAlex v2 — H-index istituzionale per ospedali italiani.
Aggiunge openalex_mean_citedness + pipeline_runs logging.

Fix noti:
  - filter=country_code:it (minuscolo — uppercase dà 400)
  - NO parametro 'select' (dà 400)
  - summary_stats.h_index (NON top-level)
  - Retry con backoff su 429
"""
import requests, time, json, logging, difflib, unicodedata, re, socket
from datetime import date
import psycopg2, psycopg2.extras

REF  = "menpryldctcvuydnkajm"
PWD  = "HlV59HZJ21fGdoVS"
HOST = "aws-0-eu-west-1.pooler.supabase.com"
OPENALEX_BASE = "https://api.openalex.org"
MAILTO = "info@curabene.it"

SOGLIA_SCIMAGO = 0.50
SOGLIA_PNE     = 0.62
DELAY_SEC      = 0.15
BATCH_UPDATE   = 50

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

STOP_WORDS = {
    "irccs","fondazione","istituto","istituti","azienda","aziende",
    "ospedale","ospedaliero","ospedaliera","universitaria","universitario",
    "policlinico","centro","nazionale","regionale","civile","generale",
    "asst","asl","aziendale","presidio","casa","cura","clinica","clinico",
    "della","delle","degli","dello","del","dal","di","da","in","per",
    "al","alla","allo","ai","agli","alle","il","lo","la","le","gli","i",
    "un","una","e","ed","o","san","santa","sant","santi","ss",
    "spa","srl","scpa","societa","benefit",
}

def get_conn():
    ip = socket.getaddrinfo(HOST, 5432, socket.AF_INET)[0][4][0]
    return psycopg2.connect(host=ip, port=5432, dbname="postgres",
        user=f"postgres.{REF}", password=PWD,
        sslmode="require", connect_timeout=30)

def normalizza(s):
    if not s: return ""
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return " ".join(t for t in s.split() if t not in STOP_WORDS and len(t) > 1)

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": f"CuraBene/2.0 (mailto:{MAILTO})"})

def cerca_openalex(query, country="it", n=5):
    params = {"search": query, "filter": f"country_code:{country}",
              "per_page": n, "mailto": MAILTO}
    for attempt in range(3):
        try:
            r = SESSION.get(f"{OPENALEX_BASE}/institutions", params=params, timeout=15)
            if r.status_code == 429:
                wait = 2 ** attempt + 1
                log.warning(f"429 rate limit, attendo {wait}s")
                time.sleep(wait)
                continue
            time.sleep(DELAY_SEC)
            if r.status_code != 200:
                log.warning(f"OpenAlex {r.status_code} per '{query}'")
                return []
            return r.json().get("results", [])
        except requests.RequestException as e:
            log.error(f"Request error: {e}")
            time.sleep(1)
    return []

def trova_miglior_match(query, results, soglia):
    if not results: return None, 0.0
    q_norm = normalizza(query)
    best, best_score = None, 0.0
    for inst in results:
        nome_oa = inst.get("display_name", "")
        score = difflib.SequenceMatcher(None, q_norm, normalizza(nome_oa)).ratio()
        tipo = inst.get("type", "")
        if tipo in ("healthcare", "government", "facility"):
            score = min(1.0, score + 0.05)
        if score > best_score:
            best_score = score
            best = inst
    return (best, best_score) if best and best_score >= soglia else (None, best_score)

def estrai_metriche(inst):
    ss  = inst.get("summary_stats", {})
    cby = {item["year"]: item for item in inst.get("counts_by_year", [])}
    oa_id = inst.get("id", "").replace("https://openalex.org/", "")
    return {
        "openalex_id":                oa_id,
        "openalex_h_index":           ss.get("h_index"),
        "openalex_i10_index":         ss.get("i10_index"),
        "openalex_mean_citedness":    ss.get("2yr_mean_citedness"),
        "openalex_cited_by_count":    inst.get("cited_by_count"),
        "openalex_works_count":       inst.get("works_count"),
        "openalex_cited_by_2024":     cby.get(2024, {}).get("cited_by_count"),
        "openalex_cited_by_2023":     cby.get(2023, {}).get("cited_by_count"),
        "openalex_cited_by_2022":     cby.get(2022, {}).get("cited_by_count"),
        "openalex_works_2024":        cby.get(2024, {}).get("works_count"),
        "openalex_anno_aggiornamento": date.today().year,
    }

def log_pipeline_run(conn, status, run_id=None, n_inseriti=None):
    cur = conn.cursor()
    if run_id is None:
        cur.execute("""INSERT INTO pipeline_runs (pipeline_nome, status, started_at)
            VALUES (%s, %s, NOW()) RETURNING id""", ("openalex_ospedali", status))
        run_id = cur.fetchone()[0]
    else:
        cur.execute("""UPDATE pipeline_runs SET status=%s, ended_at=NOW(),
            n_record_inseriti=%s WHERE id=%s""", (status, n_inseriti, run_id))
    conn.commit()
    cur.close()
    return run_id

def main():
    log.info("=== AGENTE OPENALEX OSPEDALI v2 ===")
    conn = get_conn()
    run_id = log_pipeline_run(conn, "running")
    log.info(f"✅ Connesso — pipeline_run id={run_id}")

    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT pne_id, nome, scimago_nome_originale
        FROM strutture
        ORDER BY CASE WHEN scimago_nome_originale IS NOT NULL THEN 0 ELSE 1 END, nome
    """)
    strutture = cur.fetchall()
    cur.close()
    conn.close()
    log.info(f"Strutture da processare: {len(strutture)}")

    matchati = 0
    non_trovati = []
    pending = []

    def flush():
        nonlocal matchati
        if not pending: return
        c = get_conn()
        cur2 = c.cursor()
        for metriche, pne_id in pending:
            cols = list(metriche.keys())
            vals = [metriche[k] for k in cols] + [pne_id]
            cur2.execute(
                f"UPDATE strutture SET {', '.join(f'{k}=%s' for k in cols)} WHERE pne_id=%s", vals)
        c.commit(); cur2.close(); c.close()
        matchati += len(pending)
        pending.clear()

    for i, row in enumerate(strutture):
        pne_id = row["pne_id"]
        nome_pne    = row["nome"] or ""
        nome_scimago = row["scimago_nome_originale"]

        if nome_scimago:
            query, soglia = nome_scimago, SOGLIA_SCIMAGO
        else:
            query, soglia = nome_pne, SOGLIA_PNE

        results = cerca_openalex(query)
        best, score = trova_miglior_match(query, results, soglia)

        if best:
            metriche = estrai_metriche(best)
            h = metriche.get("openalex_h_index", "?")
            cit = metriche.get("openalex_cited_by_count") or 0
            mc  = metriche.get("openalex_mean_citedness")
            log.info(f"[{i+1:4d}/{len(strutture)}] ✓ {score:.2f} {nome_pne[:40]:<40} "
                     f"H={h} cit={cit:,} mc={mc}")
            pending.append((metriche, pne_id))
        else:
            top = results[0]["display_name"] if results else "—"
            log.info(f"[{i+1:4d}/{len(strutture)}] ✗ score={score:.2f} top='{top[:35]}'")
            non_trovati.append({"pne_id": pne_id, "nome": nome_pne,
                                 "score": round(score, 3), "top": top})

        if len(pending) >= BATCH_UPDATE:
            flush()
            log.info(f"  → Batch commit ({matchati} totali)")

    flush()

    # Pipeline run chiusura
    c = get_conn()
    log_pipeline_run(c, "success", run_id, matchati)
    c.close()

    # Report finale
    c2 = get_conn()
    cur3 = c2.cursor()
    cur3.execute("""
        SELECT nome, openalex_h_index, openalex_i10_index,
               openalex_cited_by_count, openalex_works_count,
               openalex_mean_citedness, scimago_percentile
        FROM strutture WHERE openalex_h_index IS NOT NULL
        ORDER BY openalex_h_index DESC LIMIT 20
    """)
    rows = cur3.fetchall()
    log.info(f"\n{'='*70}")
    log.info(f"COMPLETATO: {matchati} matchati, {len(non_trovati)} non trovati")
    log.info(f"{'='*70}")
    log.info(f"\nTop 20 per H-index:")
    log.info(f"  {'Nome':<42} {'H':>4} {'i10':>6} {'Citazioni':>10} {'MC':>6}")
    log.info(f"  {'-'*72}")
    for r in rows:
        log.info(f"  {str(r[0])[:41]:<42} {str(r[1] or ''):>4} {str(r[2] or ''):>6} "
                 f"{(r[3] or 0):>10,} {str(round(r[5],1) if r[5] else ''):>6}")

    cur3.execute("SELECT COUNT(*) FROM strutture WHERE openalex_h_index IS NOT NULL")
    n = cur3.fetchone()[0]
    log.info(f"\n  Strutture con OpenAlex: {n}")
    cur3.close(); c2.close()

    import json as _json
    with open("output_pne/openalex_non_trovati.json", "w", encoding="utf-8") as f:
        _json.dump(non_trovati, f, ensure_ascii=False, indent=2)
    log.info(f"  Non trovati salvati")

if __name__ == "__main__":
    main()
