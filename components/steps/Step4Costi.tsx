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

const COSTI_KM_AUTO = 0.26; // €/km (rimborso ACI 2024)
const COSTI_TRENO_BASE = 0.12; // €/km medio Trenitalia
const COSTI_AEREO_BASE = 80; // tariffa media low-cost andata

// Distanze indicative (km) tra le principali città italiane
const DISTANZE: Record<string, Record<string, number>> = {
  Milano: { Roma: 572, Napoli: 771, Palermo: 1403, Bologna: 210, Torino: 140, Firenze: 298, Venezia: 267, Bari: 879 },
  Roma: { Milano: 572, Napoli: 225, Palermo: 1043, Bologna: 378, Torino: 670, Firenze: 277, Venezia: 527, Bari: 458 },
  Napoli: { Milano: 771, Roma: 225, Palermo: 720, Bologna: 571, Torino: 867, Firenze: 494, Venezia: 738, Bari: 263 },
  Bologna: { Milano: 210, Roma: 378, Napoli: 571, Palermo: 1180, Torino: 295, Firenze: 105, Venezia: 152, Bari: 641 },
  Palermo: { Milano: 1403, Roma: 1043, Napoli: 720, Bologna: 1180, Torino: 1470, Firenze: 1093, Venezia: 1292, Bari: 668 },
  Torino: { Milano: 140, Roma: 670, Napoli: 867, Bologna: 295, Palermo: 1470, Firenze: 400, Venezia: 390, Bari: 974 },
  Firenze: { Milano: 298, Roma: 277, Napoli: 494, Bologna: 105, Palermo: 1093, Torino: 400, Venezia: 257, Bari: 633 },
  Venezia: { Milano: 267, Roma: 527, Napoli: 738, Bologna: 152, Palermo: 1292, Torino: 390, Firenze: 257, Bari: 793 },
  Bari: { Milano: 879, Roma: 458, Napoli: 263, Bologna: 641, Palermo: 668, Torino: 974, Firenze: 633, Venezia: 793 },
  Catania: { Milano: 1453, Roma: 1093, Napoli: 770, Bologna: 1230, Palermo: 210, Torino: 1520, Firenze: 1143, Venezia: 1342 },
  Pavia: { Milano: 36, Roma: 588, Napoli: 797, Bologna: 236, Torino: 170, Firenze: 324 },
  "San Donato Milanese": { Milano: 12, Roma: 578, Napoli: 783, Bologna: 218 },
  "Meldola": { Milano: 310, Roma: 378, Napoli: 640, Bologna: 81 },
  Parma: { Milano: 122, Roma: 447, Napoli: 638, Bologna: 100 },
  Enna: { Milano: 1450, Roma: 1035, Napoli: 720, Bologna: 1220, Palermo: 135 },
};

const CITTA_OSPEDALE: Record<string, string> = {
  "ieo-milano": "Milano",
  "int-milano": "Milano",
  "monzino-milano": "Milano",
  "besta-milano": "Milano",
  "galeazzi-milano": "Milano",
  "san-donato-milano": "San Donato Milanese",
  "mondino-pavia": "Pavia",
  "gemelli-roma": "Roma",
  "san-camillo-roma": "Roma",
  "pascale-napoli": "Napoli",
  "colli-napoli": "Napoli",
  "federico-ii-napoli": "Napoli",
  "cardarelli-napoli": "Napoli",
  "arnas-civico-palermo": "Palermo",
  "vittorio-emanuele-catania": "Catania",
  "cannizzaro-catania": "Catania",
  "garibaldi-catania": "Catania",
  "asp-enna": "Enna",
  "santorsola-bologna": "Bologna",
  "rizzoli-bologna": "Bologna",
  "irst-meldola": "Meldola",
  "parma-aou": "Parma",
};

const CITTA_COMUNI = [
  "Milano", "Roma", "Napoli", "Torino", "Palermo", "Genova", "Bologna",
  "Firenze", "Bari", "Catania", "Venezia", "Verona", "Messina", "Padova",
  "Trieste", "Brescia", "Taranto", "Prato", "Modena", "Reggio Calabria",
];

function getDistanza(da: string, a: string): number | null {
  if (da === a) return 0;
  return DISTANZE[da]?.[a] ?? DISTANZE[a]?.[da] ?? null;
}

function calcolaCostoTrasporto(km: number, mezzo: Mezzo, persone: NumPersone): number {
  if (km === 0) return 0;
  if (mezzo === "auto") return km * 2 * COSTI_KM_AUTO * persone; // A/R
  if (mezzo === "treno") return km * 2 * COSTI_TRENO_BASE * persone;
  // aereo: tariffa fissa * persone (solo se km > 400)
  return km > 400 ? COSTI_AEREO_BASE * 2 * persone : km * 2 * COSTI_TRENO_BASE * persone;
}

const COSTO_HOTEL_NOTTE = 90;  // €/camera/notte
const COSTO_PASTI_GIORNO = 35; // €/persona/giorno

export default function Step4Costi({ state, onNext, onBack }: Step4Props) {
  const [cittaPartenza, setCittaPartenza] = useState("");
  const [mezzo, setMezzo] = useState<Mezzo>("treno");
  const [persone, setPersone] = useState<NumPersone>(1);

  const ospedale = state.ospedaleSelezionato;
  const cittaDest = ospedale ? (CITTA_OSPEDALE[ospedale.id] ?? ospedale.citta) : null;
  const spec = ospedale?.specialita.find(
    (s) => s.specialitaId === state.specialitaSelezionata?.id
  ) ?? null;
  const degenza = spec?.degenzaMedia ?? 3;
  const notti = Math.ceil(degenza);
  const camere = Math.ceil(persone / 2);

  const costi = useMemo(() => {
    if (!cittaPartenza || !cittaDest) return null;
    const km = getDistanza(cittaPartenza, cittaDest);
    if (km === null) return null;

    const trasporto = calcolaCostoTrasporto(km, mezzo, persone);
    const hotel = notti * camere * COSTO_HOTEL_NOTTE;
    const pasti = notti * persone * COSTO_PASTI_GIORNO;
    const totale = trasporto + hotel + pasti;

    return { km, trasporto, hotel, pasti, totale, notti };
  }, [cittaPartenza, cittaDest, mezzo, persone, notti, camere]);

  const MEZZO_OPTS: { value: Mezzo; label: string; icon: string }[] = [
    { value: "treno", label: "Treno", icon: "🚆" },
    { value: "aereo", label: "Aereo", icon: "✈️" },
    { value: "auto", label: "Auto", icon: "🚗" },
  ];

  const PERSONE_OPTS: NumPersone[] = [1, 2, 3, 4];

  return (
    <div className="space-y-7">
      <div>
        <h2 className="font-fraunces text-2xl font-semibold text-gray-900 mb-1">
          Stima dei costi
        </h2>
        <p className="text-gray-500 text-sm">
          Calcolo orientativo per pianificare il viaggio verso{" "}
          <strong>{cittaDest ?? "la struttura"}</strong>
        </p>
      </div>

      {/* Input città */}
      <div>
        <label htmlFor="citta-partenza" className="block font-medium text-gray-900 mb-2">
          La tua città di partenza
        </label>
        <select
          id="citta-partenza"
          value={cittaPartenza}
          onChange={(e) => setCittaPartenza(e.target.value)}
          className="w-full sm:w-72 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="">Seleziona città…</option>
          {CITTA_COMUNI.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Numero persone */}
      <div>
        <p className="font-medium text-gray-900 mb-2">Chi viene con te?</p>
        <div className="flex gap-2">
          {PERSONE_OPTS.map((n) => (
            <button
              key={n}
              onClick={() => setPersone(n)}
              className={[
                "w-12 h-12 rounded-xl border-2 text-sm font-semibold transition-colors",
                persone === n
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-brand-300",
              ].join(" ")}
            >
              {n === 1 ? "Solo" : `+${n - 1}`}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {persone === 1 ? "Solo tu" : `Tu + ${persone - 1} accompagnator${persone === 2 ? "e" : "i"}`}
        </p>
      </div>

      {/* Mezzo */}
      <div>
        <p className="font-medium text-gray-900 mb-2">Come vuoi viaggiare?</p>
        <div className="flex gap-2">
          {MEZZO_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMezzo(opt.value)}
              className={[
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors",
                mezzo === opt.value
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-brand-300",
              ].join(" ")}
            >
              <span>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabella costi */}
      {costi && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs text-gray-500">
              Stima per {costi.km} km · degenza media {costi.notti} notti
            </p>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr className="px-5">
                <td className="px-5 py-3 text-gray-700">
                  🚆 Trasporto ({mezzo}) A/R × {persone}{" "}
                  {persone === 1 ? "persona" : "persone"}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-gray-900">
                  € {costi.trasporto.toFixed(0)}
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-gray-700">
                  🏨 Hotel {costi.notti} nott{costi.notti === 1 ? "e" : "i"} ×{" "}
                  {Math.ceil(persone / 2)} camera/e
                </td>
                <td className="px-5 py-3 text-right font-semibold text-gray-900">
                  € {costi.hotel.toFixed(0)}
                </td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-gray-700">
                  🍽️ Pasti {costi.notti} giorni × {persone}{" "}
                  {persone === 1 ? "persona" : "persone"}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-gray-900">
                  € {costi.pasti.toFixed(0)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-brand-50">
                <td className="px-5 py-4 font-bold text-brand-900">
                  Totale stimato
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="text-2xl font-bold text-brand-700">
                    € {costi.totale.toFixed(0)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!costi && cittaPartenza && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
          Non ho dati sulla distanza tra {cittaPartenza} e {cittaDest}. Prova un&apos;altra città di partenza.
        </p>
      )}

      {/* Nota SSN */}
      <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">💡 Rimborso SSN</p>
        <p>
          Se la prestazione non è disponibile nella tua regione, potresti avere
          diritto al <strong>rimborso delle spese di viaggio</strong> (L. 833/1978).
          Chiedi al tuo medico di base il modulo per la mobilità sanitaria
          interregionale.
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ← Indietro
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
        >
          Avanti → Piano d&apos;azione
        </button>
      </div>
    </div>
  );
}
