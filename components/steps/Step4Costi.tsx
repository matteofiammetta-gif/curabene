"use client";

import { useState, useMemo } from "react";
import { AppState } from "@/lib/types";

interface Step4Props {
  state: AppState;
  onNext: () => void;
  onBack: () => void;
}

type Mezzo = "treno" | "aereo" | "auto";
type NumPersone = 1 | 2 | 3 | 4;

const COSTI_KM_AUTO    = 0.26;
const COSTI_TRENO_BASE = 0.12;
const COSTI_AEREO_BASE = 80;

const DISTANZE: Record<string, Record<string, number>> = {
  Milano:   { Roma: 572, Napoli: 771, Palermo: 1403, Bologna: 210, Torino: 140, Firenze: 298, Venezia: 267, Bari: 879, Padova: 245 },
  Roma:     { Milano: 572, Napoli: 225, Palermo: 1043, Bologna: 378, Torino: 670, Firenze: 277, Venezia: 527, Bari: 458, Padova: 498 },
  Napoli:   { Milano: 771, Roma: 225, Palermo: 720, Bologna: 571, Torino: 867, Firenze: 494, Venezia: 738, Bari: 263, Padova: 718 },
  Bologna:  { Milano: 210, Roma: 378, Napoli: 571, Palermo: 1180, Torino: 295, Firenze: 105, Venezia: 152, Bari: 641, Padova: 120 },
  Palermo:  { Milano: 1403, Roma: 1043, Napoli: 720, Bologna: 1180, Torino: 1470, Firenze: 1093, Venezia: 1292, Bari: 668, Padova: 1260 },
  Torino:   { Milano: 140, Roma: 670, Napoli: 867, Bologna: 295, Palermo: 1470, Firenze: 400, Venezia: 390, Bari: 974, Padova: 310 },
  Firenze:  { Milano: 298, Roma: 277, Napoli: 494, Bologna: 105, Palermo: 1093, Torino: 400, Venezia: 257, Bari: 633, Padova: 250 },
  Venezia:  { Milano: 267, Roma: 527, Napoli: 738, Bologna: 152, Palermo: 1292, Torino: 390, Firenze: 257, Bari: 793, Padova: 37 },
  Bari:     { Milano: 879, Roma: 458, Napoli: 263, Bologna: 641, Palermo: 668, Torino: 974, Firenze: 633, Venezia: 793, Padova: 790 },
  Catania:  { Milano: 1453, Roma: 1093, Napoli: 770, Bologna: 1230, Palermo: 210, Torino: 1520, Firenze: 1143, Venezia: 1342 },
  Padova:   { Milano: 245, Roma: 498, Napoli: 718, Bologna: 120, Palermo: 1260, Torino: 310, Firenze: 250, Venezia: 37, Bari: 790 },
  Pavia:    { Milano: 36, Roma: 588, Napoli: 797, Bologna: 236, Torino: 170, Firenze: 324 },
  "San Donato Milanese": { Milano: 12, Roma: 578, Napoli: 783, Bologna: 218 },
  Meldola:  { Milano: 310, Roma: 378, Napoli: 640, Bologna: 81 },
  Parma:    { Milano: 122, Roma: 447, Napoli: 638, Bologna: 100 },
  Enna:     { Milano: 1450, Roma: 1035, Napoli: 720, Bologna: 1220, Palermo: 135 },
};

const CITTA_OSPEDALE: Record<string, string> = {
  "ieo-milano": "Milano", "int-milano": "Milano", "monzino-milano": "Milano",
  "besta-milano": "Milano", "galeazzi-milano": "Milano",
  "fondazione-policlinico-milano": "Milano",
  "san-donato-milano": "San Donato Milanese", "mondino-pavia": "Pavia",
  "gemelli-roma": "Roma", "san-camillo-roma": "Roma",
  "pascale-napoli": "Napoli", "colli-napoli": "Napoli",
  "federico-ii-napoli": "Napoli", "cardarelli-napoli": "Napoli",
  "arnas-civico-palermo": "Palermo", "vittorio-emanuele-catania": "Catania",
  "cannizzaro-catania": "Catania", "garibaldi-catania": "Catania",
  "asp-enna": "Enna", "santorsola-bologna": "Bologna",
  "rizzoli-bologna": "Bologna", "irst-meldola": "Meldola", "parma-aou": "Parma",
  "aou-padova": "Padova",
  "citta-salute-torino": "Torino",
  "careggi-firenze": "Firenze",
  "policlinico-bari": "Bari",
};

const CITTA_COMUNI = [
  "Milano","Roma","Napoli","Torino","Palermo","Genova","Bologna",
  "Firenze","Bari","Catania","Venezia","Verona","Messina","Padova",
  "Trieste","Brescia","Taranto","Prato","Modena","Reggio Calabria",
];

function getDistanza(da: string, a: string): number | null {
  if (da === a) return 0;
  return DISTANZE[da]?.[a] ?? DISTANZE[a]?.[da] ?? null;
}

function calcolaTrasporto(km: number, mezzo: Mezzo, persone: NumPersone): number {
  if (km === 0) return 0;
  if (mezzo === "auto")  return km * 2 * COSTI_KM_AUTO * persone;
  if (mezzo === "treno") return km * 2 * COSTI_TRENO_BASE * persone;
  return km > 400 ? COSTI_AEREO_BASE * 2 * persone : km * 2 * COSTI_TRENO_BASE * persone;
}

const MEZZO_OPTS: { value: Mezzo; icon: string; label: string }[] = [
  { value: "treno", icon: "🚆", label: "Treno" },
  { value: "aereo", icon: "✈️", label: "Aereo" },
  { value: "auto",  icon: "🚗", label: "Auto"  },
];

const PERSONE_OPTS: { value: NumPersone; label: string }[] = [
  { value: 1, label: "Solo" },
  { value: 2, label: "+1" },
  { value: 3, label: "+2" },
  { value: 4, label: "+3" },
];

export default function Step4Costi({ state, onNext, onBack }: Step4Props) {
  const [cittaPartenza, setCittaPartenza] = useState("");
  const [mezzo, setMezzo]     = useState<Mezzo>("treno");
  const [persone, setPersone] = useState<NumPersone>(1);

  const ospedale  = state.ospedaleSelezionato;
  const cittaDest = ospedale ? (CITTA_OSPEDALE[ospedale.id] ?? ospedale.citta) : null;
  const spec = ospedale?.specialita.find((s) => s.specialitaId === state.specialitaSelezionata?.id) ?? null;
  const notti  = Math.ceil(spec?.degenzaMedia ?? 3);
  const camere = Math.ceil(persone / 2);

  const costi = useMemo(() => {
    if (!cittaPartenza || !cittaDest) return null;
    const km = getDistanza(cittaPartenza, cittaDest);
    if (km === null) return null;
    const trasporto = calcolaTrasporto(km, mezzo, persone);
    const hotel     = notti * camere * 90;
    const pasti     = notti * persone * 35;
    return { km, trasporto, hotel, pasti, totale: trasporto + hotel + pasti };
  }, [cittaPartenza, cittaDest, mezzo, persone, notti, camere]);

  const mezzoIcon = MEZZO_OPTS.find((m) => m.value === mezzo)?.icon ?? "";

  return (
    <div className="step-body">
      <p className="section-note">
        Calcolo orientativo per il viaggio verso{" "}
        <strong style={{ color: "#1A1814" }}>{cittaDest ?? "la struttura"}</strong>
      </p>

      {/* Città partenza */}
      <div className="field-group">
        <label htmlFor="citta-partenza" className="field-label">La tua città di partenza</label>
        <select
          id="citta-partenza"
          value={cittaPartenza}
          onChange={(e) => setCittaPartenza(e.target.value)}
          className="field-input"
          style={{ maxWidth: 280 }}
        >
          <option value="">Seleziona città…</option>
          {CITTA_COMUNI.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Persone */}
      <div className="field-group">
        <label className="field-label">Chi viene con te?</label>
        <div className="toggle-group">
          {PERSONE_OPTS.map((opt) => (
            <button key={opt.value} onClick={() => setPersone(opt.value)}
                    className={`toggle-btn${persone === opt.value ? " active" : ""}`}>
              {opt.label}
            </button>
          ))}
        </div>
        <p className="field-hint">
          {persone === 1 ? "Solo tu" : `Tu + ${persone - 1} accompagnator${persone === 2 ? "e" : "i"}`}
        </p>
      </div>

      {/* Mezzo */}
      <div className="field-group">
        <label className="field-label">Come vuoi viaggiare?</label>
        <div className="toggle-group">
          {MEZZO_OPTS.map((opt) => (
            <button key={opt.value} onClick={() => setMezzo(opt.value)}
                    className={`toggle-btn${mezzo === opt.value ? " active" : ""}`}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabella costi */}
      {costi && (
        <div style={{ marginBottom: "1rem" }}>
          <p className="field-hint" style={{ marginBottom: 8 }}>
            Stima per {costi.km} km · degenza media {notti} notti
          </p>
          <div className="cost-table">
            <div className="cost-table-row">
              <span className="cost-key">{mezzoIcon} Trasporto ({mezzo}) A/R × {persone} {persone === 1 ? "persona" : "persone"}</span>
              <span className="cost-val">€ {costi.trasporto.toFixed(0)}</span>
            </div>
            <div className="cost-table-row">
              <span className="cost-key">🏨 Hotel {notti} nott{notti === 1 ? "e" : "i"} × {camere} camera/e</span>
              <span className="cost-val">€ {costi.hotel.toFixed(0)}</span>
            </div>
            <div className="cost-table-row">
              <span className="cost-key">🍽️ Pasti {notti} giorni × {persone} {persone === 1 ? "persona" : "persone"}</span>
              <span className="cost-val">€ {costi.pasti.toFixed(0)}</span>
            </div>
          </div>
          <div className="cost-total-row">
            <span className="cost-total-lbl">Totale stimato</span>
            <span className="cost-total-amt">€ {costi.totale.toFixed(0)}</span>
          </div>
        </div>
      )}

      {!costi && cittaPartenza && (
        <div className="note-box" style={{ marginBottom: "1rem" }}>
          Non ho dati sulla distanza tra {cittaPartenza} e {cittaDest}. Prova un&apos;altra città.
        </div>
      )}

      {/* Nota SSN */}
      <div className="rimborso-note">
        <strong>💡 Rimborso SSN —</strong> Se la prestazione non è disponibile nella tua regione
        potresti avere diritto al rimborso delle spese di viaggio (L. 833/1978).
        Chiedi al medico di base il modulo per la mobilità sanitaria interregionale.
      </div>

      <div className="step-nav">
        <button onClick={onBack} className="btn-secondary">← Indietro</button>
        <button onClick={onNext} className="btn-primary">Avanti → Piano d&apos;azione</button>
      </div>
    </div>
  );
}
