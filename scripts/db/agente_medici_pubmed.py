"""
Agente PubMed + ClinicalTrials — popola medici_scientifica per medici Lombardia.

Strategia:
  1. Cerca su PubMed: "{cognome} {iniziale}[Author] AND Italy[Affiliation]"
  2. Fallback senza filtro affiliazione se troppo poche pubblicazioni
  3. Estrae metriche: n_pub, h_index_proxy, autori, patologie, riviste
  4. Cerca trial clinici su ClinicalTrials.gov v2 API
  5. Upsert in medici_scientifica via psycopg2
  6. Checkpoint su file JSON per ripresa

Limiti API:
  - PubMed NCBI: 3 req/s senza API key → 0.35s delay
  - ClinicalTrials.gov: no rate limit esplicito → 0.2s delay
"""
import requests, json, time, logging, re, unicodedata, socket
from datetime import datetime, date
from pathlib import Path
import psycopg2, psycopg2.extras

# ── Config ────────────────────────────────────────────────────────────────────
REF  = "menpryldctcvuydnkajm"
PWD  = "HlV59HZJ21fGdoVS"
HOST = "aws-0-eu-west-1.pooler.supabase.com"

PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
CT_BASE     = "https://clinicaltrials.gov/api/v2"
OUTPUT_DIR  = Path("./output_medici")
OUTPUT_DIR.mkdir(exist_ok=True)
CHECKPOINT  = OUTPUT_DIR / "checkpoint_pubmed.json"

TEST_MODE = False      # True → solo 10 cardiologi; False → tutti Lombardia
TEST_DISCIPLINA = "Cardiologia"
TEST_LIMIT = 10

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler(OUTPUT_DIR / "pubmed.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

PATOLOGIE = {
    "cardiologia":       ["cardiac","heart","coronary","myocardial","atrial","ventricular"],
    "oncologia":         ["cancer","tumor","carcinoma","lymphoma","leukemia","oncology"],
    "neurologia":        ["stroke","brain","neurological","alzheimer","parkinson","epilepsy"],
    "ortopedia":         ["orthopedic","fracture","hip","knee","spine","arthroplasty"],
    "nefrologia":        ["renal","kidney","dialysis","nephropathy","transplant"],
    "pneumologia":       ["pulmonary","lung","respiratory","COPD","asthma","pneumonia"],
    "ginecologia":       ["obstetric","gynecologic","maternal","pregnancy","cervical","uterine"],
    "gastroenterologia": ["gastric","intestinal","liver","hepatic","colorectal","IBD"],
    "chirurgia":         ["surgical","surgery","laparoscopic","resection","operative"],
    "infettivologia":    ["infection","HIV","sepsis","antimicrobial","viral","COVID"],
}

# ── DB ────────────────────────────────────────────────────────────────────────
def get_conn():
    ip = socket.getaddrinfo(HOST, 5432, socket.AF_INET)[0][4][0]
    return psycopg2.connect(
        host=ip, port=5432, dbname="postgres",
        user=f"postgres.{REF}", password=PWD,
        sslmode="require", connect_timeout=30,
    )

# ── Helpers ───────────────────────────────────────────────────────────────────
def normalizza(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z\s]", "", t).strip()

def get_json(url, params=None, retry=3):
    for i in range(retry):
        try:
            r = requests.get(url, params=params, timeout=15)
            r.raise_for_status()
            time.sleep(0.35)
            return r.json()
        except Exception as e:
            if i < retry - 1:
                time.sleep(2 ** i)
            else:
                log.warning(f"Fallito {url}: {e}")
    return None

def carica_checkpoint():
    if CHECKPOINT.exists():
        with open(CHECKPOINT) as f:
            return set(json.load(f))
    return set()

def salva_checkpoint(ids):
    with open(CHECKPOINT, "w") as f:
        json.dump(list(ids), f)

# ── PubMed ────────────────────────────────────────────────────────────────────
def cerca_pubmed(cognome, nome):
    ini = nome[0].upper() if nome else ""
    queries = [
        (f"{cognome} {ini}[Author] AND Italy[Affiliation]", "alta"),
        (f"{cognome} {nome}[Author] AND Italy[Affiliation]", "alta"),
        (f"{cognome} {ini}[Author]", "bassa"),
    ]
    for q, conf in queries:
        data = get_json(f"{PUBMED_BASE}/esearch.fcgi", {
            "db": "pubmed", "term": q,
            "retmax": 200, "retmode": "json",
            "sort": "relevance",
        })
        if not data:
            continue
        res   = data.get("esearchresult", {})
        count = int(res.get("count", 0))
        ids   = res.get("idlist", [])
        if 0 < count < 500:
            return ids, q, conf
    return [], "", "nessuna"

def fetch_dettagli(pmids):
    if not pmids:
        return {}
    data = get_json(f"{PUBMED_BASE}/esummary.fcgi", {
        "db": "pubmed",
        "id": ",".join(pmids[:100]),
        "retmode": "json",
    })
    return data.get("result", {}) if data else {}

def calcola_metriche(dettagli, pmids, cognome):
    anno_now = datetime.now().year
    cog = normalizza(cognome)
    anni, primo, ultimo, titoli, riviste = {}, 0, 0, [], set()

    for pmid in pmids:
        if pmid not in dettagli or pmid == "uids":
            continue
        art    = dettagli[pmid]
        anno   = art.get("pubdate", "")[:4]
        autori = art.get("authors", [])
        titoli.append(art.get("title", ""))
        if art.get("source"):
            riviste.add(art["source"])
        if anno.isdigit():
            anni[anno] = anni.get(anno, 0) + 1
        if autori:
            a0 = normalizza(autori[0].get("name", ""))
            al = normalizza(autori[-1].get("name", ""))
            if cog in a0: primo += 1
            if cog in al: ultimo += 1

    pub_5a = sum(v for k, v in anni.items()
                 if k.isdigit() and int(k) >= anno_now - 5)
    text = " ".join(titoli).lower()
    patologie = [a for a, kws in PATOLOGIE.items()
                 if any(k.lower() in text for k in kws)]
    tot = len(pmids)

    return {
        "n_pub_totali":        tot,
        "n_pub_5anni":         pub_5a,
        "h_index_proxy":       min(tot, 20),
        "primo_autore_count":  primo,
        "ultimo_autore_count": ultimo,
        "primo_autore_pct":    round(primo / tot * 100, 1) if tot else 0,
        "ultimo_autore_pct":   round(ultimo / tot * 100, 1) if tot else 0,
        "patologie_principali": patologie,
        "riviste_campione":    list(riviste)[:20],
    }

# ── ClinicalTrials ────────────────────────────────────────────────────────────
def cerca_trials(cognome, nome):
    ini = nome[0].upper() if nome else ""
    data = get_json(f"{CT_BASE}/studies", {
        "query.term": f"{cognome} {ini}",
        "filter.advanced": "AREA[LocationCountry]Italy",
        "pageSize": 50,
        "format": "json",
    })
    empty = {"n_trial_pi": 0, "n_trial_coinv": 0,
             "trial_attivi": [], "sponsor_pharma_count": 0,
             "sponsor_pharma_nomi": [], "trial_pharma_pct": 0.0}
    if not data:
        return empty

    pharma, attivi, n_pi, n_coinv = [], [], 0, 0
    for s in data.get("studies", []):
        proto  = s.get("protocolSection", {})
        sp     = proto.get("sponsorCollaboratorsModule", {})
        lead   = sp.get("leadSponsor", {})
        lname  = lead.get("name", "")
        lclass = lead.get("sponsorClass", "")
        status = proto.get("statusModule", {}).get("overallStatus", "")
        nct    = proto.get("identificationModule", {}).get("nctId", "")
        title  = proto.get("identificationModule", {}).get("briefTitle", "")[:100]

        if lclass == "INDUSTRY":
            pharma.append(lname)
        if status in ("RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"):
            attivi.append({"nct_id": nct, "titolo": title,
                           "sponsor": lname, "tipo": lclass})
            n_pi += 1
        else:
            n_coinv += 1

    tot_trial = n_pi + n_coinv
    return {
        "n_trial_pi":           n_pi,
        "n_trial_coinv":        n_coinv,
        "trial_attivi":         attivi[:10],
        "sponsor_pharma_count": len(set(pharma)),
        "sponsor_pharma_nomi":  list(set(pharma))[:10],
        "trial_pharma_pct":     round(len(set(pharma)) / tot_trial * 100, 1) if tot_trial else 0.0,
    }

# ── DB upsert ─────────────────────────────────────────────────────────────────
UPSERT_COLS = [
    "medico_id", "n_pub_totali", "n_pub_5anni", "h_index_proxy",
    "primo_autore_count", "ultimo_autore_count",
    "primo_autore_pct", "ultimo_autore_pct",
    "patologie_principali", "riviste_campione",
    "n_trial_pi", "n_trial_coinv", "trial_attivi",
    "sponsor_pharma_count", "sponsor_pharma_nomi", "trial_pharma_pct",
    "confidenza_match", "aggiornato_il",
]

def flush_batch(batch):
    """Apre una connessione fresca per ogni flush (evita timeout Supabase ~30min)."""
    if not batch:
        return
    conn = get_conn()
    cur  = conn.cursor()
    col_list = ", ".join(UPSERT_COLS)
    placeholders = ", ".join(["%s"] * len(UPSERT_COLS))
    update_set = ", ".join(
        f"{c}=EXCLUDED.{c}" for c in UPSERT_COLS if c != "medico_id"
    )
    sql = f"""
        INSERT INTO medici_scientifica ({col_list})
        VALUES ({placeholders})
        ON CONFLICT (medico_id) DO UPDATE SET {update_set}
    """
    rows = []
    for rec in batch:
        row = []
        for col in UPSERT_COLS:
            v = rec.get(col)
            if col in ("patologie_principali", "riviste_campione",
                       "trial_attivi", "sponsor_pharma_nomi"):
                v = json.dumps(v, ensure_ascii=False) if v is not None else None
            row.append(v)
        rows.append(tuple(row))
    psycopg2.extras.execute_batch(cur, sql, rows, page_size=50)
    conn.commit()
    cur.close()
    conn.close()

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    log.info("=== AGENTE PUBMED + CLINICAL TRIALS ===")
    log.info(f"Modalità: {'TEST (' + TEST_DISCIPLINA + ' x' + str(TEST_LIMIT) + ')' if TEST_MODE else 'COMPLETA Lombardia'}")

    processati = carica_checkpoint()
    log.info(f"Già processati da checkpoint: {len(processati)}")

    conn = get_conn()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    log.info("✅ Connesso a Supabase")

    cur.execute("SELECT id, cognome, nome, azienda, disciplina, regione FROM medici WHERE attivo = true AND regione = 'Lombardia'")
    tutti = cur.fetchall()
    cur.close()
    conn.close()   # chiudi subito, ogni flush userà connessione fresca

    # Filtra già processati
    medici = [m for m in tutti if m["id"] not in processati]

    if TEST_MODE:
        medici = [m for m in medici
                  if (m.get("disciplina") or "").lower() == TEST_DISCIPLINA.lower()][:TEST_LIMIT]

    log.info(f"Da processare: {len(medici)} medici")

    batch, trovati, saltati = [], 0, 0

    for i, m in enumerate(medici):
        nc = f"{m['cognome']} {m['nome']}"
        log.info(f"[{i+1:4d}/{len(medici)}] {nc:<35} — {m['disciplina']}")

        try:
            pmids, query_used, conf = cerca_pubmed(m["cognome"], m["nome"])

            if not pmids:
                log.info(f"          ✗ nessuna pubblicazione trovata")
                saltati += 1
                processati.add(str(m["id"]))
                continue

            det = fetch_dettagli(pmids)
            met = calcola_metriche(det, pmids, m["cognome"])
            tri = cerca_trials(m["cognome"], m["nome"])

            log.info(
                f"          ✓ pub={met['n_pub_totali']} "
                f"h≈{met['h_index_proxy']} "
                f"5a={met['n_pub_5anni']} "
                f"trial={tri['n_trial_pi']} "
                f"pharma={tri['sponsor_pharma_count']} "
                f"conf={conf}"
            )

            record = {
                "medico_id":           str(m["id"]),
                "n_pub_totali":        met["n_pub_totali"],
                "n_pub_5anni":         met["n_pub_5anni"],
                "h_index_proxy":       met["h_index_proxy"],
                "primo_autore_count":  met["primo_autore_count"],
                "ultimo_autore_count": met["ultimo_autore_count"],
                "primo_autore_pct":    met["primo_autore_pct"],
                "ultimo_autore_pct":   met["ultimo_autore_pct"],
                "patologie_principali": met["patologie_principali"],
                "riviste_campione":    met["riviste_campione"],
                "n_trial_pi":          tri["n_trial_pi"],
                "n_trial_coinv":       tri["n_trial_coinv"],
                "trial_attivi":        tri["trial_attivi"],
                "sponsor_pharma_count": tri["sponsor_pharma_count"],
                "sponsor_pharma_nomi": tri["sponsor_pharma_nomi"],
                "trial_pharma_pct":    tri["trial_pharma_pct"],
                "confidenza_match":    conf,
                "aggiornato_il":       date.today().isoformat(),
            }
            batch.append(record)
            trovati += 1
            processati.add(str(m["id"]))

            if len(batch) >= 50:
                flush_batch(batch)
                log.info(f"  → Batch salvato ({trovati} trovati fin qui)")
                batch = []
                salva_checkpoint(processati)

        except Exception as e:
            log.error(f"Errore {nc}: {e}", exc_info=True)
            processati.add(str(m["id"]))

    # Flush residui
    if batch:
        flush_batch(batch)
        salva_checkpoint(processati)

    log.info(f"\n{'='*60}")
    log.info(f"COMPLETATO — trovati: {trovati}, saltati (no pub): {saltati}")
    log.info(f"{'='*60}")

    # Report verifica — connessione fresca
    conn2 = get_conn()
    cur2  = conn2.cursor()
    cur2.execute("SELECT COUNT(*) FROM medici_scientifica")
    tot = cur2.fetchone()[0]
    log.info(f"Totale righe medici_scientifica: {tot}")

    if trovati > 0:
        cur2.execute("""
            SELECT m.cognome, m.nome, m.disciplina,
                   ms.n_pub_totali, ms.n_pub_5anni,
                   ms.h_index_proxy, ms.n_trial_pi,
                   ms.sponsor_pharma_count, ms.confidenza_match
            FROM medici m
            JOIN medici_scientifica ms ON m.id = ms.medico_id
            WHERE m.regione = 'Lombardia'
            ORDER BY ms.h_index_proxy DESC, ms.n_pub_totali DESC
            LIMIT 10
        """)
        rows = cur2.fetchall()
        log.info(f"\n  Top medici per H-proxy:")
        log.info(f"  {'Cognome':<20} {'Nome':<15} {'Disc':<20} {'Pub':>4} {'5a':>4} {'H':>3} {'Tri':>4} {'Ph':>3} Conf")
        log.info(f"  {'-'*90}")
        for r in rows:
            log.info(f"  {str(r[0]):<20} {str(r[1]):<15} {str(r[2]):<20} "
                     f"{(r[3] or 0):>4} {(r[4] or 0):>4} {(r[5] or 0):>3} "
                     f"{(r[6] or 0):>4} {(r[7] or 0):>3} {r[8] or ''}")

    cur2.close()
    conn2.close()

if __name__ == "__main__":
    main()
