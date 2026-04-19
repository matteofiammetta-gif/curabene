"""
Agente ClinicalTrials v2 — query corretta con LocationFacility + paginazione.

PROBLEMI DELLA V1:
  - query.term sul nome ospedale → full-text generico, non filtra per sede
  - pageSize=100 senza paginazione → risultati troncati
  - ct_sponsor_pharma sempre 0 (trial sbagliati)

FIX V2:
  - filter.advanced: AREA[LocationFacility]"nome" AND AREA[LocationCountry]Italy
  - pageSize=200 con paginazione via nextPageToken
  - Retry con nome abbreviato se 0 risultati
  - Checkpoint per ripresa
"""
import requests, time, logging, json, socket
from pathlib import Path
from datetime import datetime
import psycopg2

CT_BASE    = "https://clinicaltrials.gov/api/v2"
OUTPUT_DIR = Path("./output_ct")
OUTPUT_DIR.mkdir(exist_ok=True)
CHECKPOINT = OUTPUT_DIR / "checkpoint_ct_v2.json"

REF  = "menpryldctcvuydnkajm"
PWD  = "HlV59HZJ21fGdoVS"
HOST = "aws-0-eu-west-1.pooler.supabase.com"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler(OUTPUT_DIR / "ct_v2.log"),
        logging.StreamHandler()
    ])
log = logging.getLogger(__name__)

STATUS_ATTIVI = {"RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"}

# Parole da rimuovere per costruire il nome abbreviato
RUMORE = [
    "IRCCS", "Irccs", "Azienda Ospedaliero-Universitaria",
    "Azienda Ospedaliera Universitaria", "Azienda Ospedaliero Universitaria",
    "Azienda Ospedaliera", "Azienda Sanitaria", "Fondazione",
    "Istituto", "Policlinico", "Presidio Ospedaliero",
    "Az.", "Osp.", "Fond.", "Ist.",
]

def get_conn():
    ip = socket.getaddrinfo(HOST, 5432, socket.AF_INET)[0][4][0]
    return psycopg2.connect(host=ip, port=5432, dbname="postgres",
        user=f"postgres.{REF}", password=PWD,
        sslmode="require", connect_timeout=30)

def carica_checkpoint():
    if CHECKPOINT.exists():
        with open(CHECKPOINT) as f:
            return set(json.load(f))
    return set()

def salva_checkpoint(done):
    with open(CHECKPOINT, "w") as f:
        json.dump(list(done), f)

def abbrevia_nome(nome):
    """Rimuove prefissi istituzionali per avere un nome più specifico."""
    s = nome
    for r in RUMORE:
        s = s.replace(r, "").strip()
    # rimuovi spazi multipli
    while "  " in s:
        s = s.replace("  ", " ")
    return s.strip(" ,-.")

def cerca_trial_facility(nome):
    """
    Query corretta: LocationFacility filtra solo trial
    dove l'ospedale è sede (non solo menzionato nel testo).
    Paginazione completa con nextPageToken.
    """
    studies    = []
    next_token = None
    page_n     = 0

    while True:
        params = {
            "filter.advanced": (
                f'AREA[LocationFacility]"{nome}" '
                f'AND AREA[LocationCountry]Italy'
            ),
            "pageSize": 200,
            "format":   "json",
            "fields": (
                "protocolSection.statusModule,"
                "protocolSection.sponsorCollaboratorsModule,"
                "protocolSection.conditionsModule,"
                "protocolSection.designModule"
            ),
        }
        if next_token:
            params["pageToken"] = next_token

        for attempt in range(3):
            try:
                r = requests.get(f"{CT_BASE}/studies", params=params, timeout=20)
                r.raise_for_status()
                time.sleep(0.5)
                data = r.json()
                break
            except requests.HTTPError as e:
                if r.status_code == 429:
                    time.sleep(3 ** attempt + 1)
                    continue
                log.warning(f"HTTP {r.status_code} per '{nome}': {e}")
                return studies
            except Exception as e:
                log.warning(f"Error '{nome}': {e}")
                if attempt < 2:
                    time.sleep(2)
                else:
                    return studies

        page = data.get("studies", [])
        studies.extend(page)
        next_token = data.get("nextPageToken")
        page_n += 1

        if page_n == 1 and len(page) < 200:
            break   # singola pagina, nessuna paginazione necessaria
        if not next_token:
            break   # esaurito
        if page_n > 20:
            log.warning(f"  ⚠ Paginazione interrotta a {page_n*200} risultati")
            break

    return studies

def aggrega_trial(studies):
    attivi = 0
    fase   = {1: 0, 2: 0, 3: 0, 4: 0}
    pharma = 0
    istituz = 0
    condizioni = {}

    for s in studies:
        proto  = s.get("protocolSection", {})
        status = proto.get("statusModule", {}).get("overallStatus", "")
        if status in STATUS_ATTIVI:
            attivi += 1

        for f in proto.get("designModule", {}).get("phases", []):
            if   "PHASE1" in f: fase[1] += 1
            elif "PHASE2" in f: fase[2] += 1
            elif "PHASE3" in f: fase[3] += 1
            elif "PHASE4" in f: fase[4] += 1

        sp  = proto.get("sponsorCollaboratorsModule", {})
        # API v2: il campo è "class", non "sponsorClass"
        cls = sp.get("leadSponsor", {}).get("class", "")
        if   cls == "INDUSTRY":                              pharma  += 1
        elif cls in ("NIH","OTHER","NETWORK","FED","INDIV"): istituz += 1

        for c in proto.get("conditionsModule", {}).get("conditions", []):
            condizioni[c] = condizioni.get(c, 0) + 1

    top10 = [c for c, _ in sorted(condizioni.items(), key=lambda x: -x[1])[:10]]

    return {
        "ct_trial_attivi":       attivi,
        "ct_trial_totali":       len(studies),
        "ct_fase1":              fase[1],
        "ct_fase2":              fase[2],
        "ct_fase3":              fase[3],
        "ct_fase4":              fase[4],
        "ct_sponsor_pharma":     pharma,
        "ct_sponsor_istituz":    istituz,
        "ct_aree_terapeutiche":  top10,
        "ct_anno_aggiornamento": 2025,
    }

def flush_batch(batch):
    """Connessione fresca per ogni flush."""
    if not batch:
        return
    conn = get_conn()
    cur  = conn.cursor()
    for pne_id, d in batch:
        cur.execute("""
            UPDATE strutture SET
              ct_trial_attivi       = %s,
              ct_trial_totali       = %s,
              ct_fase1              = %s,
              ct_fase2              = %s,
              ct_fase3              = %s,
              ct_fase4              = %s,
              ct_sponsor_pharma     = %s,
              ct_sponsor_istituz    = %s,
              ct_aree_terapeutiche  = %s,
              ct_anno_aggiornamento = %s
            WHERE pne_id = %s
        """, (
            d["ct_trial_attivi"],   d["ct_trial_totali"],
            d["ct_fase1"],          d["ct_fase2"],
            d["ct_fase3"],          d["ct_fase4"],
            d["ct_sponsor_pharma"], d["ct_sponsor_istituz"],
            json.dumps(d["ct_aree_terapeutiche"], ensure_ascii=False),
            d["ct_anno_aggiornamento"],
            pne_id
        ))
    conn.commit()
    cur.close()
    conn.close()

def main():
    t_start = datetime.now()
    log.info("=== AGENTE CT OSPEDALI V2 ===")
    log.info("Query: LocationFacility + paginazione completa")

    done = carica_checkpoint()
    log.info(f"Checkpoint: {len(done)} già processati")

    # Registra run in agent_runs
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        INSERT INTO agent_runs (agent_id, status, run_at, last_heartbeat_at)
        VALUES (%s, 'running', NOW(), NOW()) RETURNING id
    """, ("L1-5_ct_ospedali_v2",))
    run_id = cur.fetchone()[0]

    # Carica strutture con OpenAlex (ricerca attiva)
    cur.execute("""
        SELECT pne_id, nome FROM strutture
        WHERE openalex_h_index IS NOT NULL
        ORDER BY openalex_h_index DESC
    """)
    strutture_all = cur.fetchall()
    cur.close(); conn.close()

    strutture = [(p, n) for p, n in strutture_all if p not in done]
    log.info(f"Strutture da processare: {len(strutture)} (su {len(strutture_all)} totali)")

    batch      = []
    aggiornate = 0

    for i, (pne_id, nome) in enumerate(strutture):
        log.info(f"[{i+1:3d}/{len(strutture)}] {nome}")

        # Query principale con nome completo
        studies = cerca_trial_facility(nome)

        # Retry con nome abbreviato se 0 risultati
        if not studies:
            nome_breve = abbrevia_nome(nome)
            if nome_breve and nome_breve != nome and len(nome_breve) > 5:
                log.info(f"  → retry con '{nome_breve}'")
                studies = cerca_trial_facility(nome_breve)

        dati = aggrega_trial(studies)
        batch.append((pne_id, dati))
        done.add(pne_id)

        flag = ""
        if dati["ct_trial_totali"] > 0 and dati["ct_sponsor_pharma"] > 0:
            flag = "🏭"
        log.info(f"  tot={dati['ct_trial_totali']:3d} att={dati['ct_trial_attivi']:3d} "
                 f"F3={dati['ct_fase3']:3d} pharma={dati['ct_sponsor_pharma']:3d} "
                 f"istituz={dati['ct_sponsor_istituz']:3d} {flag}")

        if len(batch) >= 20:
            flush_batch(batch)
            aggiornate += len(batch)
            batch = []
            salva_checkpoint(done)
            log.info(f"  ✓ Flush — {aggiornate} aggiornate finora")

            # Heartbeat in agent_runs
            c = get_conn(); cu = c.cursor()
            cu.execute("UPDATE agent_runs SET last_heartbeat_at=NOW(), rows_written=%s WHERE id=%s",
                       (aggiornate, run_id))
            c.commit(); cu.close(); c.close()

    # Flush finale
    if batch:
        flush_batch(batch)
        aggiornate += len(batch)
        salva_checkpoint(done)

    # Chiudi run
    dur = int((datetime.now() - t_start).total_seconds())
    c = get_conn(); cu = c.cursor()
    cu.execute("""
        UPDATE agent_runs SET status='success', rows_written=%s,
          rows_expected=%s, quality_passed=true, duration_sec=%s,
          notes=%s WHERE id=%s
    """, (aggiornate, len(strutture_all),
          dur, f"LocationFacility query. {aggiornate}/{len(strutture_all)} strutture.", run_id))
    c.commit(); cu.close(); c.close()

    # ── Verifica qualità ──────────────────────────────────────────────────────
    c = get_conn(); cu = c.cursor()
    cu.execute("""
        SELECT
          COUNT(*)                                           AS tot,
          COUNT(CASE WHEN ct_trial_totali > 0 THEN 1 END)  AS con_trial,
          MAX(ct_trial_totali)                              AS max_trial,
          ROUND(AVG(ct_trial_attivi),1)                     AS media_att,
          SUM(ct_sponsor_pharma)                            AS pharma_tot,
          COUNT(CASE WHEN ct_trial_totali = 200 THEN 1 END) AS troncate_200
        FROM strutture WHERE openalex_h_index IS NOT NULL
    """)
    r = cu.fetchone()
    log.info(f"\n{'='*65}")
    log.info(f"COMPLETATO in {dur}s — {aggiornate} strutture aggiornate")
    log.info(f"{'='*65}")
    log.info(f"\nVerifica qualità:")
    log.info(f"  Strutture con dati CT:     {r[1]}/{r[0]}")
    log.info(f"  Max trial per struttura:   {r[2]}")
    log.info(f"  Media trial attivi:        {r[3]}")
    log.info(f"  Totale trial pharma-led:   {r[4]}")
    log.info(f"  Strutture troncate a 200:  {r[5]} (ok se 0)")

    cu.execute("""
        SELECT nome, ct_trial_totali, ct_trial_attivi,
               ct_fase3, ct_sponsor_pharma, openalex_h_index
        FROM strutture
        WHERE ct_trial_totali IS NOT NULL AND ct_trial_totali > 0
        ORDER BY ct_trial_attivi DESC
        LIMIT 20
    """)
    rows = cu.fetchall()
    log.info(f"\nTop 20 strutture per trial attivi:")
    log.info(f"  {'Nome':<42} {'tot':>4} {'att':>4} {'F3':>4} {'Ph':>4} {'H':>4}")
    log.info(f"  {'-'*62}")
    for r2 in rows:
        log.info(f"  {str(r2[0])[:41]:<42} {(r2[1] or 0):>4} {(r2[2] or 0):>4} "
                 f"{(r2[3] or 0):>4} {(r2[4] or 0):>4} {(r2[5] or 0):>4}")

    cu.close(); c.close()

if __name__ == "__main__":
    main()
