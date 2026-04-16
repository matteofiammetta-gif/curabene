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
    <span className="ai-dots">
      <span className="ai-dot" />
      <span className="ai-dot" />
      <span className="ai-dot" />
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
    <div className="step-body">
      {/* Griglia specialità */}
      <div className="field-group">
        <label className="field-label">Area clinica</label>
        <div className="specialty-grid">
          {specialita.map((s) => {
            const isSelected = state.specialitaSelezionata?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onChange({ specialitaSelezionata: isSelected ? null : s, analisiAI: null })}
                className={`spec-card${isSelected ? " selected" : ""}`}
                aria-pressed={isSelected}
              >
                <div className="spec-icon">{s.icona}</div>
                <span className="spec-name">{s.nome}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Diagnosi */}
      <div className="field-group">
        <label htmlFor="diagnosi" className="field-label">
          Descrivi la tua condizione
        </label>
        <textarea
          id="diagnosi"
          rows={3}
          placeholder="Es. tumore al colon stadio II, fibrillazione atriale persistente, ernia del disco L4-L5…"
          value={state.diagnosi}
          onChange={(e) => onChange({ diagnosi: e.target.value, analisiAI: null })}
          className="field-input"
        />
      </div>

      {/* Raggio */}
      <div className="field-group">
        <label className="field-label">Quanto sei disposto/a a spostarti?</label>
        <div className="toggle-group">
          {RAGGIO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ raggio: opt.value })}
              className={`toggle-btn${state.raggio === opt.value ? " active" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Regione */}
      <div className="field-group">
        <label htmlFor="regione" className="field-label">La tua regione</label>
        <select
          id="regione"
          value={state.regione ?? ""}
          onChange={(e) => onChange({ regione: (e.target.value as RegioneItaliana) || null })}
          className="field-input"
          style={{ maxWidth: 280 }}
        >
          <option value="">Seleziona regione…</option>
          {REGIONI.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Bottone AI */}
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={handleAnalyze} disabled={!canAnalyze || loading} className="btn-primary">
          {loading ? <><LoadingDots /> <span style={{ marginLeft: 6 }}>Analisi in corso…</span></> : "✨ Analizza con AI"}
        </button>
        {errore && (
          <p style={{ fontSize: 13, color: "#B91C1C", marginTop: 8 }}>{errore}</p>
        )}
      </div>

      {/* Box AI result */}
      {state.analisiAI && (
        <div className="ai-box">
          <span className="ai-label">✨ Analisi AI</span>
          <div className="ai-content" dangerouslySetInnerHTML={{ __html: state.analisiAI.sommario }} />
          {state.analisiAI.domandeDaPorre.length > 0 && (
            <div className="ai-questions">
              <span className="ai-questions-title">Domande utili da fare al medico</span>
              <ol style={{ paddingLeft: 0, listStyle: "none" }}>
                {state.analisiAI.domandeDaPorre.map((d, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#5C5852", marginBottom: 6 }}>
                    <span className="q-num" style={{ background: "rgba(139,90,0,0.12)", color: "#8B5A00" }}>{i + 1}</span>
                    {d}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <div className="step-nav">
        <span />
        <button onClick={onNext} disabled={!canContinue} className="btn-primary">
          Avanti → Trova centri
        </button>
      </div>
    </div>
  );
}
