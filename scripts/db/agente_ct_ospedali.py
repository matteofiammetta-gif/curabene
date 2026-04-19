"""
Agente ClinicalTrials.gov per strutture ospedaliere italiane.
Processa solo strutture con openalex_h_index (ricerca attiva).
Usa ClinicalTrials.gov API v2.
"""
import requests, time, logging, json, socket
import psycopg2, psycopg2.extras
from datetime import date

REF  = "menpryldctcvuydnkajm"
PWD  = "HlV59HZJ21fGdoVS"
HOST = "aws-0-eu-west-1.pooler.supabase.com"
CT_BASE = "https://clinicaltrials.gov/api/v2"
DELAY_SEC = 0.5

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

STATUS_ATTIVI = {"RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"}

def get_conn():
    ip = socket.getaddrinfo(HOST, 5432, socket.AF_INET)[0][4][0]
    return psycopg2.connect(host=ip, port=5432, dbname="postgres",
        user=f"postgres.{REF}", password=PWD,
        sslmode="require", connect_timeout=30)

def cerca_trial(nome):
    """Cerca trial ClinicalTrials.gov per nome ospedale in Italia."""
    # Usa le prime 2-3 parole significative del nome (evita query troppo generiche)
    parole = [p for p in nome.split() if len(p) > 3 and p.lower() not in
              {"ospedale","azienda","istituto","fondazione","irccs","centro","civile",
               "universitaria","universitario","policlinico","presidio"}]
    query_term = " ".join(parole[:3]) if parole else nome[:40]

    params = {
        "query.term": query_term,
        "filter.advanced": "AREA[LocationCountry]Italy",
        "pageSize": 100,
        "format": "json",
    }
    for attempt in range(3):
        try:
            r = requests.get(f"{CT_BASE}/studies", params=params, timeout=20)
            r.raise_for_status()
            time.sleep(DELAY_SEC)
            return r.json().get("studies", [])
        except requests.HTTPError as e:
            if r.status_code == 429:
                time.sleep(2 ** attempt + 2)
                continue
            log.warning(f"CT HTTP error {nome}: {e}")
            return []
        except Exception as e:
            log.warning(f"CT error {nome}: {e}")
            if attempt < 2: time.sleep(2)
    return []

def aggrega_trial(studies):
    attivi = totali = fase1 = fase2 = fase3 = fase4 = pharma = istituz = 0
    condizioni = {}
    totali = len(studies)

    for s in studies:
        proto  = s.get("protocolSection", {})
        status = proto.get("statusModule", {}).get("overallStatus", "")
        if status in STATUS_ATTIVI:
            attivi += 1

        # Fasi
        fasi = proto.get("designModule", {}).get("phases", [])
        for f in fasi:
            if "PHASE1" in f:   fase1 += 1
            elif "PHASE2" in f: fase2 += 1
            elif "PHASE3" in f: fase3 += 1
            elif "PHASE4" in f: fase4 += 1

        # Sponsor
        sp    = proto.get("sponsorCollaboratorsModule", {})
        cls   = sp.get("leadSponsor", {}).get("sponsorClass", "")
        if cls == "INDUSTRY":            pharma  += 1
        elif cls in ("NIH","OTHER","NETWORK"): istituz += 1

        # Condizioni
        for c in proto.get("conditionsModule", {}).get("conditions", []):
            condizioni[c] = condizioni.get(c, 0) + 1

    top_cond = [c for c, _ in sorted(condizioni.items(), key=lambda x: -x[1])[:10]]

    return {
        "ct_trial_attivi":        attivi,
        "ct_trial_totali":        totali,
        "ct_fase1":               fase1,
        "ct_fase2":               fase2,
        "ct_fase3":               fase3,
        "ct_fase4":               fase4,
        "ct_sponsor_pharma":      pharma,
        "ct_sponsor_istituz":     istituz,
        "ct_aree_terapeutiche":   json.dumps(top_cond, ensure_ascii=False),
        "ct_anno_aggiornamento":  date.today().year,
    }

def main():
    log.info("=== AGENTE CLINICAL TRIALS OSPEDALI ===")
    conn = get_conn()
    cur  = conn.cursor()

    cur.execute("""INSERT INTO pipeline_runs (pipeline_nome, status, started_at)
        VALUES ('ct_ospedali', 'running', NOW()) RETURNING id""")
    run_id = cur.fetchone()[0]
    conn.commit()
    log.info(f"✅ Connesso — run_id={run_id}")

    # Solo strutture con ricerca attiva (hanno OpenAlex)
    cur.execute("""
        SELECT pne_id, nome FROM strutture
        WHERE openalex_h_index IS NOT NULL
        ORDER BY openalex_h_index DESC
    """)
    strutture = cur.fetchall()
    cur.close()
    conn.close()
    log.info(f"Strutture da processare: {len(strutture)}")

    aggiornate = 0

    for i, (pne_id, nome) in enumerate(strutture):
        log.info(f"[{i+1:3d}/{len(strutture)}] {nome[:50]}")
        studies = cerca_trial(nome)

        dati = aggrega_trial(studies) if studies else {
            "ct_trial_attivi": 0, "ct_trial_totali": 0,
            "ct_fase1": 0, "ct_fase2": 0, "ct_fase3": 0, "ct_fase4": 0,
            "ct_sponsor_pharma": 0, "ct_sponsor_istituz": 0,
            "ct_aree_terapeutiche": json.dumps([]),
            "ct_anno_aggiornamento": date.today().year,
        }

        # Connessione fresca per ogni update (evita timeout)
        c = get_conn()
        cur2 = c.cursor()
        cols = list(dati.keys())
        vals = [dati[k] for k in cols] + [pne_id]
        cur2.execute(
            f"UPDATE strutture SET {', '.join(f'{k}=%s' for k in cols)} WHERE pne_id=%s",
            vals)
        c.commit(); cur2.close(); c.close()

        if studies:
            aggiornate += 1
            log.info(f"  att={dati['ct_trial_attivi']} tot={dati['ct_trial_totali']} "
                     f"F3={dati['ct_fase3']} pharma={dati['ct_sponsor_pharma']}")

    # Pipeline run chiusura
    c = get_conn()
    cur3 = c.cursor()
    cur3.execute("""UPDATE pipeline_runs SET status='success', ended_at=NOW(),
        n_record_inseriti=%s WHERE id=%s""", (aggiornate, run_id))
    c.commit()

    # Report finale
    cur3.execute("""
        SELECT s.nome, s.ct_trial_attivi, s.ct_trial_totali,
               s.ct_fase3, s.ct_sponsor_pharma, s.newsweek_rank_italia,
               s.openalex_h_index
        FROM strutture s
        WHERE s.ct_trial_totali IS NOT NULL AND s.ct_trial_totali > 0
        ORDER BY s.ct_trial_attivi DESC, s.ct_trial_totali DESC
        LIMIT 20
    """)
    rows = cur3.fetchall()
    log.info(f"\n{'='*75}")
    log.info(f"COMPLETATO: {aggiornate} strutture con trial")
    log.info(f"{'='*75}")
    log.info(f"\n  {'Nome':<40} {'att':>4} {'tot':>5} {'F3':>4} {'ph':>4} {'NW':>4} {'H':>4}")
    log.info(f"  {'-'*65}")
    for r in rows:
        log.info(f"  {str(r[0])[:39]:<40} {(r[1] or 0):>4} {(r[2] or 0):>5} "
                 f"{(r[3] or 0):>4} {(r[4] or 0):>4} "
                 f"{str(r[5] or ''):>4} {(r[6] or 0):>4}")

    cur3.close(); c.close()

if __name__ == "__main__":
    main()
