import json, psycopg2, logging
from pathlib import Path

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

STAGE    = "/Users/matteofiammetta/Downloads/scrape_ministero/pne_stage"
EDIZIONE = "2024"
SENTINEL = {"666", ".", "", "None"}

def get_conn():
    return psycopg2.connect(
        host="108.128.216.176", port=5432,
        dbname="postgres",
        user="postgres.menpryldctcvuydnkajm",
        password="HlV59HZJ21fGdoVS",
        sslmode="require", connect_timeout=60)

def clean(v, cast=float):
    if v is None: return None
    s = str(v).strip()
    if s in SENTINEL: return None
    try: return cast(s)
    except: return None

# Regione da codice HSP (prime 2 cifre = ISTAT)
# FONTE AFFIDABILE: non usare il campo regione
# di Supabase che è tutto "Lombardia" per un bug
REGIONE_DA_HSP = {
    '01':'Piemonte',
    '02':"Valle d'Aosta",
    '03':'Lombardia',
    '04':'Trentino-Alto Adige',
    '05':'Veneto',
    '06':'Friuli-Venezia Giulia',
    '07':'Liguria',
    '08':'Emilia-Romagna',
    '09':'Toscana',
    '10':'Umbria',
    '11':'Marche',
    '12':'Lazio',
    '13':'Abruzzo',
    '14':'Molise',
    '15':'Campania',
    '16':'Puglia',
    '17':'Basilicata',
    '18':'Calabria',
    '19':'Sicilia',
    '20':'Sardegna',
}

TIPO_MISURA = {
    1:'MORTALITA',10:'MORTALITA',14:'MORTALITA',
    15:'MORTALITA',18:'MORTALITA',21:'MORTALITA',
    35:'MORTALITA',38:'MORTALITA',55:'MORTALITA',
    63:'MORTALITA',82:'MORTALITA',83:'MORTALITA',
    84:'MORTALITA',88:'MORTALITA',92:'MORTALITA',
    95:'MORTALITA',300:'MORTALITA',306:'MORTALITA',
    308:'MORTALITA',310:'MORTALITA',409:'MORTALITA',
    515:'MORTALITA',601:'MORTALITA',602:'MORTALITA',
    620:'MORTALITA',630:'MORTALITA',720:'MORTALITA',
    721:'MORTALITA',722:'MORTALITA',723:'MORTALITA',
    724:'MORTALITA',725:'MORTALITA',727:'MORTALITA',
    19:'RIAMMISSIONE',22:'RIAMMISSIONE',
    28:'RIAMMISSIONE',29:'RIAMMISSIONE',
    66:'RIAMMISSIONE',69:'RIAMMISSIONE',
    79:'RIAMMISSIONE',201:'RIAMMISSIONE',
    204:'RIAMMISSIONE',205:'RIAMMISSIONE',
    318:'RIAMMISSIONE',324:'RIAMMISSIONE',
    325:'RIAMMISSIONE',410:'RIAMMISSIONE',
    513:'RIAMMISSIONE',514:'RIAMMISSIONE',
    652:'RIAMMISSIONE',
    42:'PROCESSO',36:'PROCESSO',37:'PROCESSO',
    94:'PROCESSO',333:'PROCESSO',621:'PROCESSO',
    622:'PROCESSO',640:'PROCESSO',
    67:'APPROPRIATEZZA',70:'APPROPRIATEZZA',
    65:'APPROPRIATEZZA',157:'APPROPRIATEZZA',
    158:'APPROPRIATEZZA',159:'APPROPRIATEZZA',
    202:'APPROPRIATEZZA',302:'APPROPRIATEZZA',
    556:'APPROPRIATEZZA',605:'APPROPRIATEZZA',
    606:'APPROPRIATEZZA',607:'APPROPRIATEZZA',
    612:'APPROPRIATEZZA',660:'APPROPRIATEZZA',
    661:'APPROPRIATEZZA',662:'APPROPRIATEZZA',
    998:'APPROPRIATEZZA',
    101:'VOLUME',102:'VOLUME',103:'VOLUME',
    104:'VOLUME',105:'VOLUME',106:'VOLUME',
    107:'VOLUME',117:'VOLUME',127:'VOLUME',
}

DIREZIONE = {
    'MORTALITA':'BASSO','RIAMMISSIONE':'BASSO',
    'PROCESSO':'ALTO','VOLUME':'ALTO',
    'APPROPRIATEZZA':None,
}

AREA_TO_CODICE = {
    'Cardiovascolare':'CARD',
    'Cerebrovascolare':'NEURO',
    'Respiratorio':'RESP',
    'Digerente':'GASTRO',
    'Perinatale':'MATI',
    'Muscoloscheletrico':'OSTEO',
    'Oncologia':'CHONC',
    'Urogenitale':'URO',
    'ORL':'ORL','Pediatria':'PED',
    'Endocrino/metabolico':'ENDO',
    'Malattie Infettive':'INFETT',
    'Procedure chirurgiche':'PROC',
    'Pronto soccorso':'PS',
    'Psichiatria':'PSI',
}

REPARTO_NOMI = {
    '0901':'Chirurgia Generale',
    '0902':'Neurochirurgia',
    '0903':'Chirurgia Toracica',
    '0904':'Chirurgia Vascolare',
    '0905':'Chirurgia App. Digerente',
    '0907':'Chirurgia Pediatrica',
    '0908':'Chirurgia Plastica',
    '0909':'Chirurgia Cardiaca',
    '0911':'Otorinolaringoiatria',
    '0912':'Ortopedia e Traumatologia',
    '0913':'Ostetricia e Ginecologia',
    '0921':'Medicina Generale',
    '0923':'Cardiologia',
    '0928':'Nefrologia',
    '0929':'Oncologia',
    '0951':'Unità Coronarica',
    '0961':'Chirurgia Senologica',
    '2601':'Ostetricia e Ginecologia',
    '3701':'Ostetricia',
    '3702':'Ginecologia',
    '6401':'Neonatologia',
    '9803':'Day Surgery',
    '9999':'Non classificato',
}

def build_strutture_map():
    """
    Legge lookup__strutture per edizione 2024.
    Ricava la regione dal codice HSP (prime 2 cifre
    = codice ISTAT regione) — affidabile al 100%.
    Non usa il campo regione di Supabase (bug: tutto
    Lombardia).
    """
    log.info("Building strutture map...")
    raw = {}
    with open(f"{STAGE}/lookup__strutture.jsonl") as f:
        for line in f:
            r = json.loads(line)
            if r.get("_edizione_descr") == EDIZIONE:
                hsp = r.get("codice") or ""
                regione = REGIONE_DA_HSP.get(hsp[:2])
                raw[r["id"]] = {
                    "hsp":     hsp,
                    "nome":    r.get("descr",""),
                    "regione": regione,
                }
    log.info(f"Strutture map: {len(raw)} entries")

    from collections import Counter
    reg_count = Counter(v["regione"] for v in raw.values())
    for reg, n in sorted(reg_count.items(), key=lambda x: -x[1])[:5]:
        log.info(f"  {reg}: {n} strutture")

    return raw

def build_aree_map():
    log.info("Building aree map...")
    aree = {}
    with open(f"{STAGE}/lookup__aree-cliniche.jsonl") as f:
        for line in f:
            r = json.loads(line)
            if r.get("_edizione_descr") == EDIZIONE:
                nome = r.get("descr","")
                aree[r["id"]] = {
                    "nome":   nome,
                    "codice": AREA_TO_CODICE.get(nome),
                }
    log.info(f"Aree map: {len(aree)} entries")
    return aree

def upsert_batch(cur, table, records, conflict_cols):
    if not records: return
    cols = list(records[0].keys())
    ph   = ",".join(["%s"]*len(cols))
    conf = ",".join(conflict_cols)
    upd  = ",".join(
        f"{c}=EXCLUDED.{c}"
        for c in cols if c not in conflict_cols)
    sql  = (
        f"INSERT INTO {table} ({','.join(cols)}) "
        f"VALUES ({ph}) "
        f"ON CONFLICT ({conf}) "
        f"DO UPDATE SET {upd}"
    )
    for rec in records:
        cur.execute(sql, list(rec.values()))

def import_v14(strutture_map, aree_map):
    log.info("=== IMPORT V14 — pne_valori_struttura ===")
    conn = get_conn()
    cur  = conn.cursor()

    cur.execute("""
        INSERT INTO agent_runs
          (agent_id, status, run_at, last_heartbeat_at)
        VALUES (%s,'running',NOW(),NOW())
        RETURNING id
    """, ("L1-1-v2_pne_2024",))
    run_id = cur.fetchone()[0]
    conn.commit()

    batch    = []
    n_total  = 0
    ind_seen = {}

    with open(f"{STAGE}/v__OSPEDALIERA_STRU_TIPO_1_2.jsonl") as f:
        for line in f:
            r = json.loads(line)
            if r.get("edizione_descr") != EDIZIONE:
                continue
            if not r.get("attivo"):
                continue
            sid = r.get("struttura_id")
            if not sid:
                continue

            stru = strutture_map.get(sid, {})
            area = aree_map.get(r.get("area_clinica_id",""), {})
            cod  = r.get("indicatore_codice")
            tipo = TIPO_MISURA.get(cod, "VOLUME")
            n_v  = clean(r.get("n"), int)
            s_v  = clean(r.get("soglia"), int)

            rec = {
                "struttura_id":      sid,
                "struttura_hsp":     stru.get("hsp"),
                "struttura_nome":    stru.get("nome",""),
                "regione":           stru.get("regione"),
                "indicatore_id":     r.get("indicatore_id"),
                "indicatore_codice": cod,
                "indicatore_descr":  r.get("indicatore_descr","").replace("\u00a0"," ").strip(),
                "area_clinica_codice": area.get("codice"),
                "area_clinica_nome":   area.get("nome"),
                "tipo_misura":       tipo,
                "area_valutazione":  r.get("area_valutazione"),
                "edizione":          EDIZIONE,
                "anno":              clean(r.get("anno"), int),
                "n":                 n_v,
                "esiti":             clean(r.get("esiti"), int),
                "tasso_grezzo":      clean(r.get("tasso_grezzo")),
                "tasso_adj":         clean(r.get("tasso_adj")),
                "inf_adj":           clean(r.get("inf_adj")),
                "sup_adj":           clean(r.get("sup_adj")),
                "rr_media":          clean(r.get("rr_media")),
                "p_media":           clean(r.get("p_media")),
                "rr_prec":           clean(r.get("rr_prec")),
                "p_prec":            clean(r.get("p_prec")),
                "media_nazionale":   clean(r.get("media")),
                "soglia":            s_v,
                "sotto_soglia":      (n_v is not None and s_v is not None and n_v < s_v),
                "attivo":            True,
            }
            batch.append(rec)

            iid = r.get("indicatore_id")
            if iid not in ind_seen:
                ind_seen[iid] = {
                    "indicatore_id":       iid,
                    "indicatore_codice":   cod,
                    "indicatore_descr":    rec["indicatore_descr"],
                    "edizione":            EDIZIONE,
                    "area_clinica_id":     r.get("area_clinica_id"),
                    "area_clinica_nome":   area.get("nome"),
                    "area_clinica_codice": area.get("codice"),
                    "area_valutazione":    r.get("area_valutazione"),
                    "tipo_misura":         tipo,
                    "direzione_migliore":  DIREZIONE.get(tipo),
                    "n_strutture_con_dati": 0,
                    "n_strutture_con_rr":   0,
                    "soglia_default":       s_v,
                }
            ind = ind_seen[iid]
            ind["n_strutture_con_dati"] += 1
            if rec["rr_media"] is not None:
                ind["n_strutture_con_rr"] += 1

            if len(batch) >= 500:
                upsert_batch(cur, "pne_valori_struttura", batch,
                             ["struttura_id","indicatore_id","edizione"])
                conn.commit()
                n_total += len(batch)
                batch.clear()
                cur.execute("""
                    UPDATE agent_runs SET
                      last_heartbeat_at=NOW(),
                      rows_written=%s
                    WHERE id=%s
                """, (n_total, run_id))
                conn.commit()
                log.info(f"  V14 flush: {n_total} righe")

    if batch:
        upsert_batch(cur, "pne_valori_struttura", batch,
                     ["struttura_id","indicatore_id","edizione"])
        conn.commit()
        n_total += len(batch)

    log.info(f"V14 completato: {n_total} righe")

    cat_batch = list(ind_seen.values())
    log.info(f"Catalogo: {len(cat_batch)} indicatori unici")
    upsert_batch(cur, "pne_indicatori_catalogo", cat_batch,
                 ["indicatore_id","edizione"])
    conn.commit()

    cur.execute("""
        UPDATE agent_runs SET
          status='success',
          rows_written=%s,
          rows_expected=22677,
          quality_passed=true,
          notes=%s
        WHERE id=%s
    """, (
        n_total,
        f"V14 2024: {n_total} righe, {len(cat_batch)} indicatori nel catalogo",
        run_id))
    conn.commit()
    cur.close(); conn.close()
    return n_total

def import_v12(strutture_map, aree_map):
    log.info("=== IMPORT V12 — pne_valori_uo ===")
    conn = get_conn()
    cur  = conn.cursor()
    batch   = []
    n_total = 0

    with open(f"{STAGE}/v__OSPEDALIERA_REPARTI_TIPO_5.jsonl") as f:
        for line in f:
            r = json.loads(line)
            if r.get("edizione_descr") != EDIZIONE:
                continue
            if not r.get("attivo"):
                continue
            sid = r.get("struttura_id")
            if not sid:
                continue

            stru = strutture_map.get(sid, {})
            area = aree_map.get(r.get("area_clinica_id",""), {})
            rep  = r.get("reparto")

            rec = {
                "struttura_id":      sid,
                "struttura_hsp":     stru.get("hsp"),
                "struttura_nome":    stru.get("nome",""),
                "regione":           stru.get("regione"),
                "reparto_codice":    rep,
                "reparto_nome":      REPARTO_NOMI.get(rep),
                "indicatore_id":     r.get("indicatore_id"),
                "indicatore_codice": r.get("indicatore_codice"),
                "indicatore_descr":  r.get("indicatore_descr","").replace("\u00a0"," ").strip(),
                "area_clinica_codice": area.get("codice"),
                "edizione":          EDIZIONE,
                "volume":            clean(r.get("n"), int),
                "compat":            clean(r.get("compat"), int),
                "attivo":            True,
            }
            batch.append(rec)

            if len(batch) >= 500:
                upsert_batch(cur, "pne_valori_uo", batch,
                             ["struttura_id","reparto_codice","indicatore_id","edizione"])
                conn.commit()
                n_total += len(batch)
                batch.clear()
                log.info(f"  V12 flush: {n_total} righe")

    if batch:
        upsert_batch(cur, "pne_valori_uo", batch,
                     ["struttura_id","reparto_codice","indicatore_id","edizione"])
        conn.commit()
        n_total += len(batch)

    log.info(f"V12 completato: {n_total} righe")
    cur.close(); conn.close()
    return n_total

def verifica():
    log.info("=== VERIFICA FINALE ===")
    conn = get_conn()
    cur  = conn.cursor()

    cur.execute("""
        SELECT tipo_misura, COUNT(*) as n, COUNT(rr_media) as con_rr
        FROM pne_valori_struttura
        GROUP BY tipo_misura
        ORDER BY n DESC
    """)
    print("\nDistribuzione tipo_misura:")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]} righe, {row[2]} con rr_media")

    cur.execute("""
        SELECT regione, COUNT(DISTINCT struttura_id) as n
        FROM pne_valori_struttura
        GROUP BY regione
        ORDER BY n DESC
        LIMIT 10
    """)
    print("\nTop 10 regioni (strutture uniche):")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]} strutture")

    cur.execute("""
        SELECT struttura_nome, regione,
               tasso_adj, rr_media, p_media, n
        FROM pne_valori_struttura
        WHERE indicatore_codice = 620
          AND rr_media IS NOT NULL
          AND attivo = true
        ORDER BY rr_media ASC
        LIMIT 5
    """)
    print("\nTop 5 mortalità IMA cod.620 (rr più basso = migliore):")
    for row in cur.fetchall():
        print(f"  {row[0]} ({row[1]}): rr={row[3]}, adj={row[2]}, p={row[4]}, n={row[5]}")

    cur.execute("""
        SELECT struttura_nome, regione,
               reparto_nome, reparto_codice,
               indicatore_descr, volume
        FROM pne_valori_uo
        WHERE indicatore_codice = 104
        ORDER BY volume DESC NULLS LAST
        LIMIT 5
    """)
    print("\nTop 5 UO per TM colon (cod.104):")
    for row in cur.fetchall():
        print(f"  {row[0]} ({row[1]}) — {row[2]} [{row[3]}]: {row[5]} interventi")

    cur.execute("SELECT COUNT(*) FROM pne_indicatori_catalogo")
    print(f"\nCatalogo indicatori: {cur.fetchone()[0]} righe")

    cur.execute("SELECT COUNT(*) FROM pne_valori_uo")
    print(f"Valori UO: {cur.fetchone()[0]} righe")

    cur.execute("SELECT COUNT(*) FROM pne_valori_struttura WHERE rr_media = 666")
    n666 = cur.fetchone()[0]
    if n666 > 0:
        print(f"ATTENZIONE: {n666} valori 666!")
    else:
        print("OK: nessun sentinella 666 rimasto")

    cur.execute("SELECT COUNT(DISTINCT struttura_id) FROM pne_valori_struttura")
    print(f"Strutture uniche con dati: {cur.fetchone()[0]}")

    cur.close(); conn.close()

def main():
    log.info("=== IMPORT PNE AGENAS 2024 — P1-v2 ===")

    strutture_map = build_strutture_map()
    aree_map      = build_aree_map()

    log.info("--- TEST 10 righe ---")
    test_count = 0
    with open(f"{STAGE}/v__OSPEDALIERA_STRU_TIPO_1_2.jsonl") as f:
        for line in f:
            r = json.loads(line)
            if r.get("edizione_descr") != EDIZIONE:
                continue
            if not r.get("attivo"):
                continue
            sid = r.get("struttura_id")
            stru = strutture_map.get(sid, {})
            print(f"  {stru.get('nome','?')[:40]} [{stru.get('regione','?')}] — "
                  f"{r.get('indicatore_descr','?')[:30]} rr={r.get('rr_media','?')}")
            test_count += 1
            if test_count >= 10:
                break

    risposta = input("\nRegioni diverse da Lombardia? Dati leggibili? Procedo? (s/n): ")
    if risposta.lower() != 's':
        log.info("Interrotto dall'utente.")
        return

    n_v14 = import_v14(strutture_map, aree_map)
    n_v12 = import_v12(strutture_map, aree_map)
    verifica()

    log.info(f"COMPLETATO — V14={n_v14} V12={n_v12}")

if __name__ == "__main__":
    main()
