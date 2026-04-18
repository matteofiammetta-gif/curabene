"""
Scimago → Supabase enrichment  v3 — comprehensive manual + fuzzy mapping
"""
import json, socket, difflib, unicodedata, re
import psycopg2

REF  = "menpryldctcvuydnkajm"
PWD  = "HlV59HZJ21fGdoVS"
USER = f"postgres.{REF}"
HOST = "aws-0-eu-west-1.pooler.supabase.com"
PORT = 5432

SCIMAGO_FILE = "/Users/matteofiammetta/Downloads/scimago_ita_health_2024.json"
ANNO  = 2024
FUZZY_THRESHOLD = 0.90   # solo match quasi-esatti come fallback

# ── Manual map: scimago nome → strutture.pne_id  (None = no match in DB) ──────
MANUAL = {
    # rank 1 & 43 — Gruppo San Donato / Policlinico San Donato
    "Gruppo San Donato":                            "72e8d3b7-234e-49cc-b709-a034fbb40adc",
    "Istituto Policlinico San Donato":              "72e8d3b7-234e-49cc-b709-a034fbb40adc",
    # rank 2 — Gemelli
    "Fondazione Policlinico Universitario Agostino Gemelli IRCCS":
                                                    "d397a6ff-af27-4f7b-bd0a-892bf88e3273",
    # rank 3 — San Raffaele Milano
    "IRCCS Ospedale San Raffaele":                  "16fa9317-1f2b-4fe5-b762-704bce314462",
    # rank 4 — Spallanzani
    "Istituto Nazionale Malattie Infettive Lazzaro Spallanzani IRCCS":
                                                    "36315c23-7cc6-4b84-b8cf-c8f1f6139980",
    # rank 6 — Humanitas
    "Istituto Clinico Humanitas":                   "d14300ab-fcb1-4899-90c4-955646698665",
    # rank 7 — Policlinico Maggiore Milano
    "Fondazione IRCCS Ospedale Maggiore Policlinico, Mangiagalli e Regina Elena":
                                                    "8d78e55d-c94a-484d-b92e-d82f506662a7",
    # rank 10 — INT Milano
    "Fondazione IRCCS Istituto Nazionale Tumori di Milano":
                                                    "7eaa2982-b329-415d-9333-a41e2ff36b08",
    # rank 11 — Sant'Orsola Bologna
    "Azienda Ospedaliero Universitaria di Bologna - Policlinico di Sant'Orsola Malpighi":
                                                    "b3340ea0-e260-4fa7-a95e-dd536c7c825f",
    # rank 12 — Pascale Napoli
    "Istituto Nazionale dei Tumori Fondazione Giovanni Pascale IRCCS":
                                                    "0754f1e0-779a-44f5-af50-40e7f28eda10",
    # rank 13 — Ministero della Salute: no hospital record
    "Ministero della Salute":                       None,
    # rank 16 — Spedali Civili Brescia
    "Spedali Civili di Brescia":                    "37f434b5-3144-4bbd-806a-583ded7ef13b",
    # rank 17 — Candiolo (Piemonte): not in strutture
    "IRCCS Istituto di Candiolo":                   None,
    # rank 20 — ISS: no hospital record
    "Istituto Superiore di Sanita":                 None,
    # rank 23 — Careggi Firenze
    "Azienda Ospedaliera Careggi":                  "c0b7d0dd-e0c7-4d84-8147-c56ad46b60e2",
    # rank 24 — San Matteo Pavia
    "Fondazione IRCCS Policlinico San Matteo":      "b7546d90-b60c-419e-bf0b-dc64b6f37ee7",
    # rank 25 — Galeazzi Milano
    "Istituto Ortopedico Galeazzi":                 "a088bfd1-0c2c-4292-bcc2-0df619b15cec",
    # rank 27 — AOUI Verona
    "Azienda Ospedaliera di Verona":                "ed155099-bf77-4fdf-8cd9-2f08554cb9a4",
    # rank 29 — Mario Negri Bergamo: not in strutture
    "Mario Negri Istituto di Ricerche Farmacologiche": None,
    # rank 31 — Neuromed: check
    "Istituto Neurologico Mediterraneo Neuromed IRCCS": None,
    # rank 32 — Bologna neurological
    "IRCCS Istituto delle Scienze Neurologiche di Bologna": None,
    # rank 34 — Santa Lucia Roma: no specific match
    "Fondazione Santa Lucia IRCCS":                 None,
    # rank 35 — MultiMedica
    "Gruppo MultiMedica":                           "4cdc4b9f-b088-4635-8865-2692fcffd3d0",
    # rank 36 — Mondino Pavia
    "Fondazione Istituto Neurologico Casimiro Mondino IRCCS":
                                                    "108073f9-b83c-48f4-801b-d1fae5c3e1f6",
    # rank 38 — Fatebenefratelli Brescia: generic Fatebenefratelli in strutture
    "IRCCS Istituto Centro San Giovanni di Dio Fatebenefratelli":
                                                    "2630ee45-09ac-47ff-8aa0-e06c9573e28c",
    # rank 41 — Gaslini Genova
    "Istituto Giannina Gaslini Ospedale Pediatrico IRCCS":
                                                    "7a01e72c-0000-0000-0000-000000000000",  # TBD
    # rank 46 — Maugeri (use Societa Benefit branch)
    "Istituti Clinici Scientifici Maugeri":         "7288b3ab-b6c0-49ed-9f76-aa4b8954e941",
    "IRCCS Istituti Clinici Scientifici Maugeri, Pavia": "7288b3ab-b6c0-49ed-9f76-aa4b8954e941",
    # rank 46 — Besta Milano
    "Fondazione IRCCS Istituto Neurologico Carlo Besta":
                                                    "f85f9cb3-9592-4b70-8d44-b408393d2bba",
    # rank 47 — Stella Maris
    "Fondazione Stella Maris IRCCS":               "0cc233ff-3874-4c25-bec0-9cef933cb124",
    # rank 52 — San Camillo Forlanini Roma
    "Azienda Ospedaliera San Camillo Forlanini":    "1ab7e6a8-0b9e-44ee-85d6-ab760d61c149",
    # rank 53 — San Gerardo Monza
    "Azienda Ospedaliera San Gerardo Monza":        "d3e2618f-dea0-49f8-a564-e5f1b155be3b",
    # rank 56 — Burlo Garofolo Trieste
    "Ospedale Infantile Burlo Garofolo IRCCS":      "388a27e5-94ed-42d2-a5d4-cf5df52853b3",
    # rank 59 — San Giovanni Bosco Torino
    "Ospedale San Giovanni Bosco":                  "07add5c5-8b1f-4413-9012-bbb8ca07161c",
    # rank 60 — Bietti Roma
    "IRCCS Fondazione GB Bietti per lo Studio e la Ricerca in Oftalmologia":
                                                    "6b5cf2da-2947-4f31-8c25-b0bbe953e478",
    # rank 61 — Tor Vergata Roma
    "Policlinico Tor Vergata":                      "97505e3b-c952-4755-9843-efa3d77831f2",
    # rank 63 — Campus Bio-Medico Roma
    "Fondazione Policlinico Universitario Campus Bio-Medico":
                                                    "5f89d4d0-deaa-4382-9960-d0c1e23a42e7",
    # rank 67 — Umberto I Roma
    "Umberto I Policlinico di Roma":                "43e5533d-100d-4da0-9497-a435a50f1aff",
    # rank 68 — Don Gnocchi
    "Fondazione Don Carlo Gnocchi IRCCS":           "99e471a3-d9d1-4841-bfd9-a119f856d153",
    # rank 5/9 — IFOM / Istituto Veneto: pure research, not in strutture
    "Istituto Veneto di Medicina Molecolare":       None,
    "Fondazione IFOM Istituto Firc di Oncologia Molecolare": None,
    # others not in strutture
    "Istituto per la Ricerca e l'Innovazione Biomedica": None,
    "L'Azienda Socio Sanitaria Territoriale Santi Paolo e Carlo": None,
    "Istituto Scientifico Romagnolo per lo Studio e la Cura dei Tumori": None,
    "IRCCS SYNLAB SDN":                             None,
    "IRCCS Centro Neurolesi Bonino Pulejo":         None,
    "Azienda Provinciale per i Servizi Sanitari":   None,
    "Istituto per lo Studio, la Prevenzione e la Rete Oncologica": None,
    "Istituto Nazionale di Riposo e Cura per Anziani IRCCS": None,
    "Istituti Fisioterapici Ospitalieri IRCCS":     None,
    "Azienda Sanitaria Universitaria Friuli Centrale": None,
    "Azienda Sanitaria Ulss 6 Vicenza":             None,
    "Azienda Usl di Reggio Emilia":                 None,
    "Leonardo SpA, Italy":                          None,
    "Istituto Dermopatico Dell'Immacolata IRCCS":   None,
    "Azienda Ospedaliera Universitaria Policlino Paolo Giaccone di Palermo": None,
    "Azienda Ospedaliera Universitaria Policlinico Gaetano Martino": None,
    "Istituto Oncologico Veneto":                   None,
}

# ── helpers ───────────────────────────────────────────────────────────────────
def get_conn():
    ip = socket.getaddrinfo(HOST, PORT, socket.AF_INET)[0][4][0]
    return psycopg2.connect(host=ip, port=PORT, dbname="postgres",
        user=USER, password=PWD, sslmode="require", connect_timeout=30)

def normalize(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii","ignore").decode("ascii")
    s = re.sub(r"[^\w\s]", " ", s.lower())
    s = re.sub(r"\s+", " ", s).strip()
    for n in [" irccs"," fondazione"," istituto"," ospedale"," policlinico",
              " universita"," university"," azienda ospedaliera universitaria",
              " azienda ospedaliera"," aou"," spa"," srl"]:
        s = s.replace(n, "")
    return s.strip()

def fuzzy_best(query, candidates, thr):
    q = normalize(query)
    best_s, best_c = 0.0, None
    for c in candidates:
        s = difflib.SequenceMatcher(None, q, normalize(c)).ratio()
        if s > best_s:
            best_s, best_c = s, c
    return (best_c, best_s) if best_s >= thr else (None, best_s)

# ── main ──────────────────────────────────────────────────────────────────────
print("=== Carico Scimago ===")
with open(SCIMAGO_FILE) as f:
    scimago = json.load(f)
print(f"  {len(scimago)} istituzioni")

print("\n=== Connessione ===")
conn = get_conn(); cur = conn.cursor()
print("  ✅ Connesso")

cur.execute("SELECT pne_id, nome FROM strutture ORDER BY nome")
rows = cur.fetchall()
strutture_map  = {r[1]: r[0] for r in rows}
strutture_nomi = list(strutture_map.keys())

# Verify Gaslini (needed to fix placeholder)
cur.execute("SELECT pne_id, nome FROM strutture WHERE nome ILIKE '%gaslini%' ORDER BY length(nome) LIMIT 1")
gaslini = cur.fetchone()
if gaslini:
    MANUAL["Istituto Giannina Gaslini Ospedale Pediatrico IRCCS"] = gaslini[0]
    print(f"  Gaslini → {gaslini[1]} ({gaslini[0]})")

# Reset all scimago columns
cur.execute("""UPDATE strutture SET scimago_rank=NULL, scimago_global_rank=NULL,
               scimago_percentile=NULL, scimago_anno=NULL,
               scimago_nome_originale=NULL, scimago_idp=NULL""")
conn.commit()
print(f"  Reset {cur.rowcount} righe")

# ── Matching ──────────────────────────────────────────────────────────────────
print("\n=== Matching ===")
matches, no_match = [], []

for inst in scimago:
    nome_raw = inst["nome"].rstrip(" *")

    if nome_raw in MANUAL:
        pne_id = MANUAL[nome_raw]
        if pne_id:
            struttura_nome = next((n for n, p in strutture_map.items() if p == pne_id), "?")
            matches.append({**inst, "nome_scimago": nome_raw, "pne_id": pne_id,
                             "struttura_nome": struttura_nome, "score": 1.0, "src": "manual"})
        else:
            no_match.append((nome_raw, 0.0, "no_record"))
        continue

    mn, sc = fuzzy_best(nome_raw, strutture_nomi, FUZZY_THRESHOLD)
    if mn:
        matches.append({**inst, "nome_scimago": nome_raw, "pne_id": strutture_map[mn],
                         "struttura_nome": mn, "score": round(sc,3), "src": "fuzzy"})
    else:
        no_match.append((nome_raw, round(sc,3), "fuzzy_miss"))

print(f"  Matched:   {len(matches)}/86")
print(f"  No match:  {len(no_match)}/86")

# ── UPDATE ────────────────────────────────────────────────────────────────────
print("\n=== UPDATE strutture ===")
updated = 0
for m in matches:
    cur.execute("""UPDATE strutture SET
        scimago_rank=%s, scimago_global_rank=%s, scimago_percentile=%s,
        scimago_anno=%s, scimago_nome_originale=%s, scimago_idp=%s
        WHERE pne_id=%s""",
        (m["rank"], m["global_rank"], m["percentile"],
         ANNO, m["nome_scimago"], m["idp"], m["pne_id"]))
    updated += cur.rowcount
conn.commit(); cur.close()
print(f"  ✅ Aggiornate: {updated} righe")

# ── Report ────────────────────────────────────────────────────────────────────
print(f"\n{'='*135}")
print(f"  {'Rk':>3}  {'GRk':>5}  {'P%':>3}  {'Scimago nome':<50}  {'Struttura match':<40}  Score Src")
print(f"  {'-'*130}")
for m in sorted(matches, key=lambda x: x["rank"]):
    print(f"  {m['rank']:>3}  {m['global_rank']:>5}  {m['percentile']:>3}  "
          f"{m['nome_scimago'][:49]:<50}  {m['struttura_nome'][:39]:<40}  "
          f"{m['score']:.3f} {m['src']}")

print(f"\n  Non matchati ({len(no_match)}):")
for nome, sc, src in sorted(no_match, key=lambda x: -x[1]):
    print(f"    {sc:.3f}  [{src}]  {nome}")

# Verify final DB state
conn2 = get_conn(); cur2 = conn2.cursor()
cur2.execute("SELECT COUNT(*) FROM strutture WHERE scimago_rank IS NOT NULL")
n_enriched = cur2.fetchone()[0]
cur2.close(); conn2.close()
print(f"\n✅ Completato! {n_enriched} strutture arricchite con dati Scimago.")
