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
  { value: "fuori"   as const, label: "Anche fuori regione" },
  { value: "italia"  as const, label: "Tutta Italia" },
];

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </span>
  );
}

export default function Step1Diagnosi({ specialita, state, onChange, onNext }: Step1Props) {
  const [loading, setLoading] = useState(false);
  const [errore, setErrore]   = useState<string | null>(null);

  const canAnalyze  = state.specialitaSelezionata !== null && state.diagnosi.trim().length > 3;
  const canContinue = canAnalyze && state.analisiAI !== null;

  async function handleAnalyze() {
    if (!canAnalyze || !state.specialitaSelezionata) return;
    setLoading(true);
    setErrore(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosi: state.diagnosi, specialitaId: state.specialitaSelezionata.id }),
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
    <div className="space-y-6 px-5 pb-6">

      {/* 1. Selezione specialità */}
      <div>
        <label className="block mb-1 text-sm font-medium" style={{ color: "var(--cb-text1)" }}>
          Area clinica
        </label>
        <p className="text-xs mb-3" style={{ color: "var(--cb-text3)" }}>
          Seleziona la specialità più vicina alla tua condizione
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {specialita.map((s) => {
            const isSelected = state.specialitaSelezionata?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onChange({ specialitaSelezionata: isSelected ? null : s, analisiAI: null })}
                className={`spec-card text-left${isSelected ? " selected" : ""}`}
                aria-pressed={isSelected}
              >
                {/* Icona quadrata */}
                <div
                  className="flex items-center justify-center rounded-lg mb-2"
                  style={{
                    width: 26,
                    height: 26,
                    background: isSelected ? "var(--cb-blue)" : "var(--cb-surface2)",
                    fontSize: 14,
                    transition: "background 0.15s",
                  }}
                >
                  {s.icona}
                </div>
                <span
                  className="block text-xs font-medium leading-tight"
                  style={{ color: "var(--cb-text1)" }}
                >
                  {s.nome}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Diagnosi libera */}
      <div>
        <label htmlFor="diagnosi" className="block mb-1 text-sm font-medium" style={{ color: "var(--cb-text1)" }}>
          Descrivi la tua condizione
        </label>
        <textarea
          id="diagnosi"
          rows={3}
          placeholder="Es. tumore al colon stadio II, fibrillazione atriale persistente, ernia del disco L4-L5…"
          value={state.diagnosi}
          onChange={(e) => onChange({ diagnosi: e.target.value, analisiAI: null })}
          className="cb-input"
          style={{ resize: "none" }}
        />
      </div>

      {/* 3. Raggio */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: "var(--cb-text1)" }}>
          Quanto sei disposto/a a spostarti?
        </p>
        <div className="flex flex-wrap gap-2">
          {RAGGIO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ raggio: opt.value })}
              className={`toggle-pill${state.raggio === opt.value ? " active" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Regione */}
      <div>
        <label htmlFor="regione" className="block mb-1 text-sm font-medium" style={{ color: "var(--cb-text1)" }}>
          La tua regione
        </label>
        <select
          id="regione"
          value={state.regione ?? ""}
          onChange={(e) => onChange({ regione: (e.target.value as RegioneItaliana) || null })}
          className="cb-select w-full sm:w-64"
        >
          <option value="">Seleziona regione…</option>
          {REGIONI.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* 5. Bottone analisi AI */}
      <div>
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze || loading}
          className="btn-primary"
        >
          {loading ? (
            <><LoadingDots /><span className="ml-2">Analisi in corso…</span></>
          ) : (
            <>✨ Analizza con AI</>
          )}
        </button>
        {errore && (
          <p className="mt-2 text-sm" style={{ color: "#B91C1C" }}>{errore}</p>
        )}
      </div>

      {/* 6. Box AI result */}
      {state.analisiAI && (
        <div className="ai-box">
          <span className="ai-box-label">✨ Analisi AI</span>
          <div
            className="ai-box-text"
            dangerouslySetInnerHTML={{ __html: state.analisiAI.sommario }}
          />
          {state.analisiAI.domandeDaPorre.length > 0 && (
            <div
              className="mt-4 rounded-xl p-4"
              style={{ background: "var(--cb-amber-light)" }}
            >
              <span className="eyebrow mb-2" style={{ color: "var(--cb-amber)", fontSize: 11 }}>
                Domande utili da fare al medico
              </span>
              <ol className="space-y-1 mt-2">
                {state.analisiAI.domandeDaPorre.map((d, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--cb-text1)" }}>
                    <span className="font-medium flex-shrink-0" style={{ color: "var(--cb-amber)" }}>
                      {i + 1}.
                    </span>
                    {d}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Avanti */}
      <div className="flex justify-end pt-2">
        <button onClick={onNext} disabled={!canContinue} className="btn-primary">
          Avanti → Trova centri
        </button>
      </div>
    </div>
  );
}
