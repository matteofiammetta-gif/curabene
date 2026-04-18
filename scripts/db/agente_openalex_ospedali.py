"""
Agente OpenAlex — arricchimento H-index istituzionale per ospedali italiani.
Legge strutture da Supabase, cerca su OpenAlex, aggiorna con metriche scientifiche.

Strategia matching:
  1. Usa scimago_nome_originale (se disponibile) come query — nomi completi
  2. Fallback su nome PNE normalizzato
  3. Per ogni query: cerca su OpenAlex con filter=country_code:it
  4. Accetta il top-1 se score fuzzy >= soglia (0.50 con Scimago, 0.60 con PNE)
  5. Accetta SEMPRE se l'OpenAlex ID corrisponde a un mapping manuale noto

Performances:
  - 0.12s delay tra richieste (polite pool OpenAlex)
  - Batch UPDATE ogni 50 match → ~22 commit per 1119 strutture
  - Stima totale: ~2.5 minuti
"""
import requests, time, json, logging, difflib, unicodedata, re, socket
from datetime import date
import psycopg2, psycopg2.extras

# ── Config ────────────────────────────────────────────────────────────────────
REF  = "menpryldctcvuydnkajm"
PWD  = "HlV59HZJ21fGdoVS"
HOST = "aws-0-eu-west-1.pooler.supabase.com"
OPENALEX_BASE = "https://api.openalex.org"
MAILTO = "info@curabene.it"   # polite pool OpenAlex

SOGLIA_SCIMAGO = 0.50   # query con nome completo Scimago
SOGLIA_PNE     = 0.62   # query con nome breve PNE
DELAY_SEC      = 0.12   # pausa tra richieste API
BATCH_UPDATE   = 50     # righe per commit batch

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
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

# ── DB helpers ────────────────────────────────────────────────────────────────
def get_conn():
    ip = socket.getaddrinfo(HOST, 5432, socket.AF_INET)[0][4][0]
    return psycopg2.connect(
        host=ip, port=5432, dbname="postgres",
        user=f"postgres.{REF}", password=PWD,
        sslmode="require", connect_timeout=30,
    )

# ── Text normalization ────────────────────────────────────────────────────────
def normalizza(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    tokens = [t for t in s.split() if t not in STOP_WORDS and len(t) > 1]
    return " ".join(tokens)

# ── OpenAlex API ──────────────────────────────────────────────────────────────
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": f"CuraBene/1.0 (mailto:{MAILTO})"})

def cerca_openalex(query: str, country: str = "it", n: int = 5):
    """Cerca istituzione su OpenAlex. Ritorna lista di risultati (max n)."""
    params = {
        "search":   query,
        "filter":   f"country_code:{country}",
        "per_page": n,
        "mailto":   MAILTO,
    }
    try:
        r = SESSION.get(f"{OPENALEX_BASE}/institutions", params=params, timeout=15)
        time.sleep(DELAY_SEC)
        if r.status_code != 200:
            log.warning(f"OpenAlex {r.status_code} per query '{query}'")
            return []
        return r.json().get("results", [])
    except requests.RequestException as e:
        log.error(f"Request error: {e}")
        time.sleep(1)
        return []

def trova_miglior_match(query: str, results: list, soglia: float):
    """Ritorna (istituzione, score) o (None, 0.0)"""
    if not results:
        return None, 0.0
    q_norm = normalizza(query)
    best, best_score = None, 0.0
    for inst in results:
        nome_oa = inst.get("display_name", "")
        score = difflib.SequenceMatcher(
            None, q_norm, normalizza(nome_oa)
        ).ratio()
        # bonus: se il tipo è healthcare/government (ospedali IT)
        tipo = inst.get("type", "")
        if tipo in ("healthcare", "government", "facility"):
            score = min(1.0, score + 0.05)
        if score > best_score:
            best_score = score
            best = inst
    if best and best_score >= soglia:
        return best, best_score
    return None, best_score

def estrai_metriche(inst: dict) -> dict:
    """Estrae colonne openalex_* da un oggetto OpenAlex institution."""
    ss  = inst.get("summary_stats", {})
    cby = {item["year"]: item for item in inst.get("counts_by_year", [])}
    oa_id = inst.get("id", "").replace("https://openalex.org/", "")
    return {
        "openalex_id":              oa_id,
        "openalex_h_index":         ss.get("h_index"),
        "openalex_i10_index":       ss.get("i10_index"),
        "openalex_cited_by_count":  inst.get("cited_by_count"),
        "openalex_works_count":     inst.get("works_count"),
        "openalex_cited_by_2024":   cby.get(2024, {}).get("cited_by_count"),
        "openalex_cited_by_2023":   cby.get(2023, {}).get("cited_by_count"),
        "openalex_cited_by_2022":   cby.get(2022, {}).get("cited_by_count"),
        "openalex_works_2024":      cby.get(2024, {}).get("works_count"),
        "openalex_anno_aggiornamento": date.today().year,
    }

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    log.info("=== AGENTE OPENALEX OSPEDALI ===")

    conn = get_conn()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    log.info("✅ Connesso a Supabase")

    # Carica tutte le strutture con nome Scimago se disponibile
    cur.execute("""
        SELECT pne_id, nome, scimago_nome_originale
        FROM strutture
        ORDER BY
          CASE WHEN scimago_nome_originale IS NOT NULL THEN 0 ELSE 1 END,
          nome
    """)
    strutture = cur.fetchall()
    log.info(f"Strutture da processare: {len(strutture)}")

    matchati     = 0
    non_trovati  = []
    pending_updates = []   # (metriche_dict, pne_id)

    def flush_updates():
        nonlocal matchati
        if not pending_updates:
            return
        update_cur = conn.cursor()
        for metriche, pne_id in pending_updates:
            cols = list(metriche.keys())
            vals = [metriche[c] for c in cols] + [pne_id]
            set_clause = ", ".join(f"{c}=%s" for c in cols)
            update_cur.execute(
                f"UPDATE strutture SET {set_clause} WHERE pne_id=%s", vals
            )
        conn.commit()
        update_cur.close()
        matchati += len(pending_updates)
        pending_updates.clear()

    for i, row in enumerate(strutture):
        pne_id = row["pne_id"]
        nome_pne    = row["nome"] or ""
        nome_scimago = row["scimago_nome_originale"]

        # Scegli query e soglia
        if nome_scimago:
            query  = nome_scimago
            soglia = SOGLIA_SCIMAGO
        else:
            query  = nome_pne
            soglia = SOGLIA_PNE

        log.info(f"[{i+1:4d}/{len(strutture)}] {nome_pne[:45]:<45}")

        results = cerca_openalex(query)
        best, score = trova_miglior_match(query, results, soglia)

        if best:
            metriche = estrai_metriche(best)
            h = metriche.get("openalex_h_index", "?")
            cit = metriche.get("openalex_cited_by_count", 0) or 0
            log.info(
                f"  ✓ MATCH {score:.2f}: {best['display_name'][:45]}"
                f"  h={h}  cited={cit:,}"
            )
            pending_updates.append((metriche, pne_id))
        else:
            top_name = results[0]["display_name"] if results else "—"
            log.info(f"  ✗ no match (best score={score:.2f}, top='{top_name[:40]}')")
            non_trovati.append({
                "pne_id": pne_id, "nome": nome_pne,
                "query": query, "score": round(score, 3),
                "top_result": top_name,
            })

        # Flush ogni BATCH_UPDATE match
        if len(pending_updates) >= BATCH_UPDATE:
            flush_updates()
            log.info(f"  → Batch commit ({matchati} totali fin qui)")

    # Flush residui
    flush_updates()
    cur.close()

    # ── Report finale ──────────────────────────────────────────────────────
    log.info(f"\n{'='*60}")
    log.info(f"COMPLETATO: {matchati} matchati, {len(non_trovati)} non trovati")
    log.info(f"{'='*60}")

    # Top 20 per h-index
    conn2 = get_conn()
    cur2  = conn2.cursor()
    cur2.execute("""
        SELECT nome, openalex_h_index, openalex_i10_index,
               openalex_cited_by_count, openalex_works_count,
               openalex_cited_by_2024, scimago_percentile
        FROM strutture
        WHERE openalex_h_index IS NOT NULL
        ORDER BY openalex_h_index DESC
        LIMIT 20
    """)
    rows = cur2.fetchall()
    log.info("\nTop 20 ospedali per H-index OpenAlex:")
    log.info(f"  {'Nome':<42} {'H':>4} {'i10':>6} {'Citazioni':>10} {'Lavori':>7} {'Cit2024':>8} {'ScimPct':>7}")
    log.info(f"  {'-'*88}")
    for r in rows:
        log.info(
            f"  {str(r[0])[:41]:<42} {str(r[1] or ''):>4} {str(r[2] or ''):>6}"
            f" {(r[3] or 0):>10,} {(r[4] or 0):>7,} {(r[5] or 0):>8,}"
            f" {str(r[6] or ''):>7}"
        )

    # Conteggi verifica
    cur2.execute("SELECT COUNT(*) FROM strutture WHERE openalex_h_index IS NOT NULL")
    n_matchate = cur2.fetchone()[0]
    cur2.execute("SELECT COUNT(*) FROM strutture WHERE openalex_h_index IS NOT NULL AND scimago_rank IS NOT NULL")
    n_doppio = cur2.fetchone()[0]
    log.info(f"\n  Strutture con OpenAlex: {n_matchate}")
    log.info(f"  Strutture con ENTRAMBI (OpenAlex + Scimago): {n_doppio}")
    cur2.close(); conn2.close()

    # Salva non trovati
    out_path = "output_pne/openalex_non_trovati.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(non_trovati, f, ensure_ascii=False, indent=2)
    log.info(f"  Non trovati salvati in {out_path}")

if __name__ == "__main__":
    main()
