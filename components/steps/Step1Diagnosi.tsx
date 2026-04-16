"use client";

import { useState } from "react";
import { Specialita, AppState, RegioneItaliana, AnalisiAI } from "@/lib/types";

interface Step1Props {
  specialita: Specialita[];
  state: AppState;
  onChange: (patch: Partial<AppState>) => void;
  onNext: () => void;
}

const REGIONI: RegioneItaliana[] = [
  "Abruzzo","Basilicata","Calabria","Campania","Emilia-Romagna",
  "Friuli-Venezia Giulia","Lazio","Liguria","Lombardia","Marche",
  "Molise","Piemonte","Puglia","Sardegna","Sicilia","Toscana",
  "Trentino-Alto Adige","Umbria","Valle d'Aosta","Veneto",
];

const RAGGIO_OPTIONS = [
  { value: "regione" as const, label: "Nella mia regione" },
  { value: "fuori" as const, label: "Anche fuori regione" },
  { value: "italia" as const, label: "Tutta Italia" },
];

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export default function Step1Diagnosi({
  specialita,
  state,
  onChange,
  onNext,
}: Step1Props) {
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const canAnalyze =
    state.specialitaSelezionata !== null && state.diagnosi.trim().length > 3;

  const canContinue = canAnalyze && state.analisiAI !== null;

  async function handleAnalyze() {
    if (!canAnalyze || !state.specialitaSelezionata) return;
    setLoading(true);
    setErrore(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosi: state.diagnosi,
          specialitaId: state.specialitaSelezionata.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ errore: "Errore sconosciuto" }));
        throw new Error(err.errore ?? "Errore del server");
      }
      const data = await res.json();
      const analisi: AnalisiAI = data.analisi;
      onChange({ analisiAI: analisi });
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : "Errore di rete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* 1. Selezione specialità */}
      <section>
        <h2 className="font-fraunces text-2xl font-semibold text-gray-900 mb-1">
          Di cosa hai bisogno?
        </h2>
        <p className="text-gray-500 text-sm mb-4">
          Seleziona l&apos;area clinica più vicina alla tua situazione
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {specialita.map((s) => {
            const isSelected = state.specialitaSelezionata?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() =>
                  onChange({ specialitaSelezionata: isSelected ? null : s, analisiAI: null })
                }
                className={[
                  "rounded-2xl border-2 p-4 text-left transition-all duration-150 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                  isSelected
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-200 bg-white hover:border-brand-200",
                ].join(" ")}
                aria-pressed={isSelected}
              >
                <span className="text-2xl block mb-2">{s.icona}</span>
                <span className="font-semibold text-sm text-gray-900 block">
                  {s.nome}
                </span>
                <span className="text-xs text-gray-500 mt-0.5 block">
                  {s.descrizione}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Diagnosi libera */}
      <section>
        <label htmlFor="diagnosi" className="block font-medium text-gray-900 mb-2">
          Descrivi la tua condizione
        </label>
        <textarea
          id="diagnosi"
          rows={3}
          placeholder="Es. tumore al colon stadio II, fibrillazione atriale persistente, ernia del disco L4-L5…"
          value={state.diagnosi}
          onChange={(e) => onChange({ diagnosi: e.target.value, analisiAI: null })}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
        />
      </section>

      {/* 3. Raggio */}
      <section>
        <p className="font-medium text-gray-900 mb-2">Quanto sei disposto/a a spostarti?</p>
        <div className="flex flex-wrap gap-2">
          {RAGGIO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ raggio: opt.value })}
              className={[
                "px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors",
                state.raggio === opt.value
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-brand-300",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* 4. Regione */}
      <section>
        <label htmlFor="regione" className="block font-medium text-gray-900 mb-2">
          La tua regione
        </label>
        <select
          id="regione"
          value={state.regione ?? ""}
          onChange={(e) =>
            onChange({ regione: (e.target.value as RegioneItaliana) || null })
          }
          className="w-full sm:w-64 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="">Seleziona regione…</option>
          {REGIONI.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </section>

      {/* 5. Bottone AI */}
      <section>
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze || loading}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <LoadingDots /> Analisi in corso…
            </>
          ) : (
            <>✨ Analizza con AI</>
          )}
        </button>
        {errore && (
          <p className="mt-2 text-sm text-red-600">{errore}</p>
        )}
      </section>

      {/* 6. Box risultato AI */}
      {state.analisiAI && (
        <section className="rounded-2xl bg-white border border-brand-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h3 className="font-fraunces text-lg font-semibold text-gray-900">
              Analisi AI
            </h3>
          </div>

          {/* Sommario HTML */}
          <div
            className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: state.analisiAI.sommario }}
          />

          {state.analisiAI.domandeDaPorre.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">
                Domande utili da fare al medico
              </p>
              <ul className="space-y-1">
                {state.analisiAI.domandeDaPorre.map((d, i) => (
                  <li key={i} className="text-sm text-amber-900 flex gap-2">
                    <span className="text-amber-400 font-bold">{i + 1}.</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Avanti */}
      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Avanti → Trova centri
        </button>
      </div>
    </div>
  );
}
