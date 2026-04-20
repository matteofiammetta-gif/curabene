"""
Agente OpenAlex v3 — matching con anti-duplicati, filtro tipo, città, soglia 0.75

FIX rispetto v2:
  - NO parametro 'select' (causa 400)
  - country_code:it minuscolo (uppercase causa 400)
  - geo.region è sempre None per IT → usa type:healthcare come filtro
  - Soglia fuzzy alzata a 0.75
  - Anti-duplicati: openalex_id già assegnato → skip
  - Flag openalex_match_verificato: False se H>200
  - Salva openalex_display_name e openalex_city per revisione
  - UPDATE con parametri posizionali (non misti named+positional)
  - Checkpoint per ripresa
"""
import requests, time, logging, json, difflib, unicodedata, re, socket
from pathlib import Path
from datetime import date
import psycopg2

OPENALEX_BASE = "https://api.openalex.org"
OUTPUT_DIR    = Path("./output_pne")
OUTPUT_DIR.mkdir(exist_ok=True)
CHECKPOINT  = OUTPUT_DIR / "checkpoint_openalex_v3.json"
NON_TROVATI = OUTPUT_DIR / "openalex_v3_non_trovati.json"
DELAY_SEC   = 0.15
SOGLIA      = 0.75
BATCH_SIZE  = 30
H_SOSPETTO  = 200   # oltre questo → openalex_match_verificato=False

REF  = "menpryldctcvuydnkajm"
PWD  = "HlV59HZJ21fGdoVS"
HOST = "aws-0-eu-west-1.pooler.supabase.com"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler(OUTPUT_DIR / "openalex_v3.log"),
        logging.StreamHandler()
    ])
log = logging.getLogger(__name__)

STOP_WORDS = {
    "irccs","fondazione","istituto","azienda","ospedale","ospedaliero",
    "ospedaliera","universitaria","universitario","policlinico","centro",
    "nazionale","regionale","civile","generale","asst","asl","presidio",
    "di","della","del","degli","delle","lo","la","le","il","e","per",
    "san","santa","santo","ss","pres","az","osp",
}

def get_conn():
    ip = socket.getaddrinfo(HOST, 5432, socket.AF_INET)[0][4][0]
    return psycopg2.connect(host=ip, port=5432, dbname="postgres",
        user=f"postgres.{REF}", password=PWD, sslmode="require", connect_timeout=30)

def norm(t):
    if not t: return ""
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return " ".join(p for p in re.sub(r"[^a-z\s]", "", t).split()
                    if p not in STOP_WORDS and len(p) > 2)

def carica_checkpoint():
    if CHECKPOINT.exists():
        with open(CHECKPOINT) as f: return set(json.load(f))
    return set()

def salva_checkpoint(done):
    with open(CHECKPOINT, "w") as f: json.dump(list(done), f)

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "CuraBene/3.0 (mailto:info@curabene.it)"})

def cerca_openalex(nome):
    """
    Due passaggi:
    1. filter=country_code:it,type:healthcare (solo ospedali)
    2. Se 0 risultati, filter=country_code:it (tutti tipi IT)
    NO parametro 'select' (causa 400).
    country_code minuscolo (uppercase causa 400).
    """
    for filtro in [
        "country_code:it,type:healthcare",
        "country_code:it",
    ]:
        for attempt in range(3):
            try:
                r = SESSION.get(f"{OPENALEX_BASE}/institutions",
                    params={"search": nome, "filter": filtro, "per_page": 10,
                            "mailto": "info@curabene.it"},
                    timeout=15)
                if r.status_code == 429:
                    time.sleep(2 ** attempt + 1); continue
                time.sleep(DELAY_SEC)
                if r.status_code != 200:
                    log.warning(f"OpenAlex {r.status_code} per '{nome}'")
                    break
                results = r.json().get("results", [])
                if results:
                    return results
                break   # 0 risultati con questo filtro, prova il prossimo
            except requests.RequestException as e:
                log.error(f"Request error: {e}")
                time.sleep(1)
    return []

def trova_best(nome_db, results, id_gia_usati):
    """
    Fuzzy match con:
    - Soglia 0.75
    - Bonus +0.05 se tipo 'healthcare'
    - Penalità -0.15 se H > 250 (probabile università, non ospedale)
    - Skip se openalex_id già assegnato ad altra struttura
    """
    n1 = norm(nome_db)
    best, best_score, best_meta = None, 0.0, {}

    for inst in results:
        oid = inst.get("id", "").replace("https://openalex.org/", "")
        if oid in id_gia_usati:
            continue  # anti-duplicati

        n2 = norm(inst.get("display_name", ""))
        score = difflib.SequenceMatcher(None, n1, n2).ratio()

        tipo = inst.get("type", "")
        if tipo == "healthcare":
            score = min(1.0, score + 0.05)

        h = (inst.get("summary_stats") or {}).get("h_index") or 0
        if h > 250:
            score -= 0.15

        if score > best_score:
            best_score = score
            best = inst
            geo = inst.get("geo") or {}
            best_meta = {"tipo": tipo, "h": h, "city": geo.get("city", ""),
                         "country": geo.get("country_code", "")}

    if best and best_score >= SOGLIA:
        return best, best_score, best_meta
    return None, best_score, {}

def flush_batch(batch):
    """Apre connessione fresca per ogni flush (evita timeout Supabase)."""
    if not batch: return
    conn = get_conn()
    cur  = conn.cursor()
    for rec in batch:
        cur.execute("""
            UPDATE strutture SET
              openalex_id                  = %s,
              openalex_h_index             = %s,
              openalex_i10_index           = %s,
              openalex_cited_by_count      = %s,
              openalex_works_count         = %s,
              openalex_mean_citedness      = %s,
              openalex_cited_by_2024       = %s,
              openalex_cited_by_2023       = %s,
              openalex_works_2024          = %s,
              openalex_anno_aggiornamento  = %s,
              openalex_match_score         = %s,
              openalex_match_verificato    = %s,
              openalex_display_name        = %s,
              openalex_city                = %s
            WHERE pne_id = %s
        """, (
            rec["oid"],          rec["h_index"],     rec["i10_index"],
            rec["cited_count"],  rec["works_count"], rec["mean_cit"],
            rec["cit_2024"],     rec["cit_2023"],    rec["works_2024"],
            rec["anno"],         rec["score"],       rec["verificato"],
            rec["display_name"], rec["city"],         rec["pne_id"],
        ))
    conn.commit()
    cur.close(); conn.close()

def main():
    log.info("=== AGENTE OPENALEX V3 ===")
    log.info(f"Soglia={SOGLIA} | Anti-dup=ON | Filtro type:healthcare + fallback IT")

    done = carica_checkpoint()
    non_trovati = []

    # Carica strutture + set ID già usati
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""INSERT INTO agent_runs (agent_id, status, run_at, last_heartbeat_at)
        VALUES (%s,'running',NOW(),NOW()) RETURNING id""", ("L1-3_openalex_v3",))
    run_id = cur.fetchone()[0]
    conn.commit()

    cur.execute("SELECT pne_id, nome, regione, comune FROM strutture ORDER BY nome")
    strutture = cur.fetchall()

    cur.execute("SELECT openalex_id FROM strutture WHERE openalex_id IS NOT NULL")
    id_gia_usati = {r[0] for r in cur.fetchall()}
    cur.close(); conn.close()

    da_fare = [(p, n, reg, com) for p, n, reg, com in strutture if p not in done]
    log.info(f"Strutture: {len(strutture)} totali | {len(da_fare)} da processare | "
             f"{len(id_gia_usati)} ID già usati")

    matchati = 0
    sospetti = 0
    batch    = []

    for i, (pne_id, nome, regione, comune) in enumerate(da_fare):
        log.info(f"[{i+1:4d}/{len(da_fare)}] {nome[:50]:<50} [{regione}]")

        results = cerca_openalex(nome)
        best, score, meta = trova_best(nome, results, id_gia_usati)

        if best:
            ss   = best.get("summary_stats") or {}
            cby  = {item["year"]: item for item in best.get("counts_by_year", [])}
            oid  = best.get("id", "").replace("https://openalex.org/", "")
            h    = ss.get("h_index") or 0
            verificato = h <= H_SOSPETTO

            if not verificato:
                sospetti += 1
                log.warning(f"  SOSPETTO H={h} → {best.get('display_name','')}")

            batch.append({
                "pne_id":       pne_id,
                "oid":          oid,
                "h_index":      h,
                "i10_index":    ss.get("i10_index"),
                "cited_count":  best.get("cited_by_count"),
                "works_count":  best.get("works_count"),
                "mean_cit":     ss.get("2yr_mean_citedness"),
                "cit_2024":     cby.get(2024, {}).get("cited_by_count"),
                "cit_2023":     cby.get(2023, {}).get("cited_by_count"),
                "works_2024":   cby.get(2024, {}).get("works_count"),
                "anno":         date.today().year,
                "score":        round(score, 3),
                "verificato":   verificato,
                "display_name": best.get("display_name", ""),
                "city":         meta.get("city", ""),
            })
            id_gia_usati.add(oid)
            matchati += 1

            v_flag = "✓" if verificato else "⚠"
            log.info(f"  {v_flag} {score:.2f} H={h:<4} {best.get('display_name','')[:40]} [{meta.get('city','')}]")
        else:
            top = results[0].get("display_name", "—") if results else "—"
            log.info(f"  ✗ score={score:.2f} top='{top[:40]}'")
            non_trovati.append({"pne_id": pne_id, "nome": nome, "regione": regione,
                                 "score": round(score, 3), "top": top})

        done.add(pne_id)

        if len(batch) >= BATCH_SIZE:
            flush_batch(batch)
            matchati_flush = matchati  # già aggiornato sopra
            log.info(f"  → Flush {len(batch)} | matchati={matchati} sospetti={sospetti}")
            batch = []
            salva_checkpoint(done)

            # Heartbeat
            c = get_conn(); cu = c.cursor()
            cu.execute("UPDATE agent_runs SET last_heartbeat_at=NOW(), rows_written=%s WHERE id=%s",
                       (matchati, run_id))
            c.commit(); cu.close(); c.close()

    # Flush finale
    if batch:
        flush_batch(batch)
        salva_checkpoint(done)

    # Salva non trovati
    with open(NON_TROVATI, "w", encoding="utf-8") as f:
        json.dump(non_trovati, f, ensure_ascii=False, indent=2)

    # Chiudi run
    c = get_conn(); cu = c.cursor()
    cu.execute("""UPDATE agent_runs SET status='success', rows_written=%s, rows_expected=%s,
        quality_passed=%s, notes=%s WHERE id=%s""",
        (matchati, len(strutture), sospetti == 0,
         f"{matchati} matchati. {sospetti} sospetti H>{H_SOSPETTO}. {len(non_trovati)} non trovati.",
         run_id))
    c.commit(); cu.close(); c.close()

    # ── Verifica qualità ──────────────────────────────────────────────────────
    c = get_conn(); cu = c.cursor()
    cu.execute("""
        SELECT
          COUNT(*)                                                     AS con_oa,
          COUNT(CASE WHEN openalex_match_verificato THEN 1 END)       AS verificati,
          COUNT(CASE WHEN NOT openalex_match_verificato
                          AND openalex_id IS NOT NULL THEN 1 END)     AS sospetti,
          MAX(openalex_h_index)                                        AS h_max,
          ROUND(AVG(openalex_h_index),1)                              AS h_medio,
          COUNT(DISTINCT openalex_id)                                  AS id_unici,
          COUNT(openalex_id)                                           AS id_tot
        FROM strutture WHERE openalex_id IS NOT NULL
    """)
    r = cu.fetchone()
    log.info(f"\n{'='*60}")
    log.info(f"COMPLETATO: {matchati} matchati su {len(strutture)} strutture")
    log.info(f"{'='*60}")
    log.info(f"  Con OpenAlex:       {r[0]}")
    log.info(f"  Match verificati:   {r[1]}")
    log.info(f"  Match sospetti:     {r[2]}")
    log.info(f"  H-index max:        {r[3]}")
    log.info(f"  H-index medio:      {r[4]}")
    log.info(f"  ID unici:           {r[5]}")
    log.info(f"  ID totali:          {r[6]}")
    log.info(f"  Duplicati rimasti:  {(r[6] or 0) - (r[5] or 0)}")

    cu.execute("""
        SELECT nome, openalex_display_name, openalex_city,
               openalex_h_index, openalex_match_score, openalex_match_verificato
        FROM strutture WHERE openalex_id IS NOT NULL
        ORDER BY openalex_h_index DESC NULLS LAST LIMIT 20
    """)
    rows = cu.fetchall()
    cu.close(); c.close()

    log.info(f"\n  Top 20 per H-index:")
    log.info(f"  {'DB nome':<38} {'OA nome':<32} {'Città':<15} {'H':>4} {'sc':>5} V")
    log.info(f"  {'-'*98}")
    for r2 in rows:
        v = "✓" if r2[5] else "?"
        log.info(f"  {str(r2[0])[:37]:<38} {str(r2[1])[:31]:<32} "
                 f"{str(r2[2])[:14]:<15} {(r2[3] or 0):>4} "
                 f"{float(r2[4] or 0):>5.2f} {v}")

if __name__ == "__main__":
    main()
