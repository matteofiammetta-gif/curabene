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

const COSTI_KM_AUTO   = 0.26;
const COSTI_TRENO_BASE = 0.12;
const COSTI_AEREO_BASE = 80;

const DISTANZE: Record<string, Record<string, number>> = {
  Milano:   { Roma: 572, Napoli: 771, Palermo: 1403, Bologna: 210, Torino: 140, Firenze: 298, Venezia: 267, Bari: 879 },
  Roma:     { Milano: 572, Napoli: 225, Palermo: 1043, Bologna: 378, Torino: 670, Firenze: 277, Venezia: 527, Bari: 458 },
  Napoli:   { Milano: 771, Roma: 225, Palermo: 720, Bologna: 571, Torino: 867, Firenze: 494, Venezia: 738, Bari: 263 },
  Bologna:  { Milano: 210, Roma: 378, Napoli: 571, Palermo: 1180, Torino: 295, Firenze: 105, Venezia: 152, Bari: 641 },
  Palermo:  { Milano: 1403, Roma: 1043, Napoli: 720, Bologna: 1180, Torino: 1470, Firenze: 1093, Venezia: 1292, Bari: 668 },
  Torino:   { Milano: 140, Roma: 670, Napoli: 867, Bologna: 295, Palermo: 1470, Firenze: 400, Venezia: 390, Bari: 974 },
  Firenze:  { Milano: 298, Roma: 277, Napoli: 494, Bologna: 105, Palermo: 1093, Torino: 400, Venezia: 257, Bari: 633 },
  Venezia:  { Milano: 267, Roma: 527, Napoli: 738, Bologna: 152, Palermo: 1292, Torino: 390, Firenze: 257, Bari: 793 },
  Bari:     { Milano: 879, Roma: 458, Napoli: 263, Bologna: 641, Palermo: 668, Torino: 974, Firenze: 633, Venezia: 793 },
  Catania:  { Milano: 1453, Roma: 1093, Napoli: 770, Bologna: 1230, Palermo: 210, Torino: 1520, Firenze: 1143, Venezia: 1342 },
  Pavia:    { Milano: 36, Roma: 588, Napoli: 797, Bologna: 236, Torino: 170, Firenze: 324 },
  "San Donato Milanese": { Milano: 12, Roma: 578, Napoli: 783, Bologna: 218 },
  Meldola:  { Milano: 310, Roma: 378, Napoli: 640, Bologna: 81 },
  Parma:    { Milano: 122, Roma: 447, Napoli: 638, Bologna: 100 },
  Enna:     { Milano: 1450, Roma: 1035, Napoli: 720, Bologna: 1220, Palermo: 135 },
};

const CITTA_OSPEDALE: Record<string, string> = {
  "ieo-milano": "Milano", "int-milano": "Milano", "monzino-milano": "Milano",
  "besta-milano": "Milano", "galeazzi-milano": "Milano",
  "san-donato-milano": "San Donato Milanese", "mondino-pavia": "Pavia",
  "gemelli-roma": "Roma", "san-camillo-roma": "Roma",
  "pascale-napoli": "Napoli", "colli-napoli": "Napoli",
  "federico-ii-napoli": "Napoli", "cardarelli-napoli": "Napoli",
  "arnas-civico-palermo": "Palermo", "vittorio-emanuele-catania": "Catania",
  "cannizzaro-catania": "Catania", "garibaldi-catania": "Catania",
  "asp-enna": "Enna", "santorsola-bologna": "Bologna",
  "rizzoli-bologna": "Bologna", "irst-meldola": "Meldola", "parma-aou": "Parma",
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

const COSTO_HOTEL_NOTTE = 90;
const COSTO_PASTI_GIORNO = 35;

const MEZZO_OPTS: { value: Mezzo; label: string; icon: string }[] = [
  { value: "treno", label: "Treno", icon: "🚆" },
  { value: "aereo", label: "Aereo", icon: "✈️" },
  { value: "auto",  label: "Auto",  icon: "🚗" },
];

const PERSONE_OPTS: NumPersone[] = [1, 2, 3, 4];

export default function Step4Costi({ state, onNext, onBack }: Step4Props) {
  const [cittaPartenza, setCittaPartenza] = useState("");
  const [mezzo, setMezzo]   = useState<Mezzo>("treno");
  const [persone, setPersone] = useState<NumPersone>(1);

  const ospedale  = state.ospedaleSelezionato;
  const cittaDest = ospedale ? (CITTA_OSPEDALE[ospedale.id] ?? ospedale.citta) : null;
  const spec = ospedale?.specialita.find((s) => s.specialitaId === state.specialitaSelezionata?.id) ?? null;
  const degenza = spec?.degenzaMedia ?? 3;
  const notti   = Math.ceil(degenza);
  const camere  = Math.ceil(persone / 2);

  const costi = useMemo(() => {
    if (!cittaPartenza || !cittaDest) return null;
    const km = getDistanza(cittaPartenza, cittaDest);
    if (km === null) return null;
    const trasporto = calcolaTrasporto(km, mezzo, persone);
    const hotel     = notti * camere * COSTO_HOTEL_NOTTE;
    const pasti     = notti * persone * COSTO_PASTI_GIORNO;
    return { km, trasporto, hotel, pasti, totale: trasporto + hotel + pasti, notti };
  }, [cittaPartenza, cittaDest, mezzo, persone, notti, camere]);

  return (
    <div className="px-5 pb-6 space-y-6">
      <p className="text-xs" style={{ color: "var(--cb-text3)" }}>
        Calcolo orientativo per pianificare il viaggio verso{" "}
        <strong style={{ color: "var(--cb-text1)" }}>{cittaDest ?? "la struttura"}</strong>
      </p>

      {/* Città partenza */}
      <div>
        <label htmlFor="citta-partenza" className="block text-sm font-medium mb-1" style={{ color: "var(--cb-text1)" }}>
          La tua città di partenza
        </label>
        <select
          id="citta-partenza"
          value={cittaPartenza}
          onChange={(e) => setCittaPartenza(e.target.value)}
          className="cb-select w-full sm:w-64"
        >
          <option value="">Seleziona città…</option>
          {CITTA_COMUNI.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Persone */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: "var(--cb-text1)" }}>
          Chi viene con te?
        </p>
        <div className="flex gap-2">
          {PERSONE_OPTS.map((n) => (
            <button
              key={n}
              onClick={() => setPersone(n)}
              className={`toggle-pill${persone === n ? " active" : ""}`}
            >
              {n === 1 ? "Solo" : `+${n - 1}`}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--cb-text3)" }}>
          {persone === 1 ? "Solo tu" : `Tu + ${persone - 1} accompagnator${persone === 2 ? "e" : "i"}`}
        </p>
      </div>

      {/* Mezzo */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: "var(--cb-text1)" }}>
          Come vuoi viaggiare?
        </p>
        <div className="flex gap-2 flex-wrap">
          {MEZZO_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMezzo(opt.value)}
              className={`toggle-pill${mezzo === opt.value ? " active" : ""}`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabella costi */}
      {costi && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--cb-border)" }}
        >
          {/* Header tabella */}
          <div
            className="px-4 py-2.5"
            style={{ background: "var(--cb-surface2)", borderBottom: "1px solid var(--cb-border)" }}
          >
            <p className="text-xs" style={{ color: "var(--cb-text3)" }}>
              Stima per {costi.km} km · degenza media {costi.notti} notti
            </p>
          </div>

          {/* Righe */}
          {[
            { icon: "🚆", label: `Trasporto (${mezzo}) A/R × ${persone} ${persone === 1 ? "persona" : "persone"}`, value: costi.trasporto },
            { icon: "🏨", label: `Hotel ${costi.notti} nott${costi.notti === 1 ? "e" : "i"} × ${camere} camera/e`, value: costi.hotel },
            { icon: "🍽️", label: `Pasti ${costi.notti} giorni × ${persone} ${persone === 1 ? "persona" : "persone"}`, value: costi.pasti },
          ].map((row, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--cb-border)" }}
            >
              <span className="text-sm" style={{ color: "var(--cb-text2)" }}>
                {row.icon} {row.label}
              </span>
              <span className="text-sm font-medium" style={{ color: "var(--cb-text1)" }}>
                € {row.value.toFixed(0)}
              </span>
            </div>
          ))}

          {/* Totale — box ambra */}
          <div
            className="flex items-center justify-between px-4 py-4"
            style={{ background: "var(--cb-amber-light)" }}
          >
            <span className="text-sm font-medium" style={{ color: "var(--cb-amber)" }}>
              Totale stimato
            </span>
            <span className="font-fraunces text-2xl font-normal" style={{ color: "var(--cb-amber)" }}>
              € {costi.totale.toFixed(0)}
            </span>
          </div>
        </div>
      )}

      {!costi && cittaPartenza && (
        <p
          className="text-sm rounded-xl px-4 py-3"
          style={{ background: "var(--cb-amber-light)", color: "var(--cb-amber)" }}
        >
          Non ho dati sulla distanza tra {cittaPartenza} e {cittaDest}. Prova un&apos;altra città.
        </p>
      )}

      {/* Nota SSN */}
      <div
        className="rounded-xl px-4 py-4 text-sm space-y-1"
        style={{ background: "var(--cb-green-light)", border: "1px solid rgba(26,107,60,0.15)" }}
      >
        <p className="font-medium" style={{ color: "var(--cb-green)" }}>
          💡 Rimborso SSN
        </p>
        <p style={{ color: "var(--cb-text1)" }}>
          Se la prestazione non è disponibile nella tua regione potresti avere diritto al{" "}
          <strong>rimborso delle spese di viaggio</strong> (L. 833/1978). Chiedi al medico di
          base il modulo per la mobilità sanitaria interregionale.
        </p>
      </div>

      <div className="flex justify-between pt-1">
        <button onClick={onBack} className="btn-secondary">← Indietro</button>
        <button onClick={onNext} className="btn-primary">Avanti → Piano d&apos;azione</button>
      </div>
    </div>
  );
}
