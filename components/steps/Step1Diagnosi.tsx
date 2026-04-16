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

const DOMANDE_STANDARD = [
  "Qual è la diagnosi precisa e lo stadio della mia condizione?",
  "Quali sono le opzioni terapeutiche disponibili per me?",
  "Quanto tempo richiede il percorso di cura?",
  "Ci sono trial clinici o terapie innovative a cui potrei accedere?",
  "Come si monitora l'efficacia del trattamento nel tempo?",
];

// Sfondi icona personalizzati per alcune specialità
const SPEC_ICON_BG: Record<string, string> = {
  pronto_soccorso:    "#FEE2E2",
  urologia:           "#EDE9FE",
  ginecologia:        "#FCE7F3",
  malattie_infettive: "#ECFDF5",
};

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
  const [loading, setLoading]         = useState(false);
  const [streamingText, setStreaming] = useState<string>("");
  const [errore, setErrore]           = useState<string | null>(null);

  const isPSSelected = state.specialitaSelezionata?.id === "pronto_soccorso";
  const canAnalyze  = !isPSSelected && state.specialitaSelezionata !== null && state.diagnosi.trim().length > 3;
  const canContinue = isPSSelected
    ? state.specialitaSelezionata !== null
    : canAnalyze && state.analisiAI !== null;

  // True while we have streaming content but haven't committed to appState yet
  const isStreaming = streamingText !== "" && state.analisiAI === null;

  async function handleAnalyze() {
    if (!canAnalyze || !state.specialitaSelezionata) return;
    setLoading(true);
    setErrore(null);
    setStreaming("");
    onChange({ analisiAI: null });

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
        const errBody = await res.json().catch(() => ({ errore: "Errore sconosciuto" }));
        throw new Error(errBody.errore ?? "Errore del server");
      }

      if (!res.body) throw new Error("Risposta vuota dal server");

      // Switch from spinner to inline streaming display
      setLoading(false);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setStreaming(fullText);
      }

      if (!fullText.trim()) throw new Error("Risposta AI vuota");

      const analisi: AnalisiAI = {
        sommario: fullText,
        domandeDaPorre: DOMANDE_STANDARD,
        coseDaSapere: [
          "Chiedere una seconda opinione è un tuo diritto e può essere prezioso",
          "Portare tutti gli esami precedenti alla prima visita",
          "Il SSN copre la maggior parte dei percorsi diagnostici e terapeutici",
          "I centri ad alto volume hanno spesso risultati migliori per condizioni complesse",
        ],
        livelloUrgenza: "media",
      };
      onChange({ analisiAI: analisi });

    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : "Errore di rete");
    } finally {
      setLoading(false);
      setStreaming("");
    }
  }

  // Displayed HTML: streaming content while in flight, committed analisi once done
  const displayedHtml = isStreaming
    ? streamingText
    : (state.analisiAI?.sommario ?? "");

  const showBox = isStreaming || state.analisiAI !== null;

  return (
    <div className="step-body">
      {/* Griglia specialità */}
      <div className="field-group">
        <label className="field-label">Area clinica</label>
        <div className="specialty-grid">
          {specialita.map((s) => {
            const isSelected = state.specialitaSelezionata?.id === s.id;
            const isPS = s.id === "pronto_soccorso";
            const cardStyle = isPS ? {
              borderColor: isSelected ? "#DC2626" : "rgba(220,38,38,0.3)",
              background: isSelected ? "#FFF5F5" : undefined,
              boxShadow: isSelected ? "0 0 0 2px rgba(220,38,38,0.15)" : undefined,
            } : {};
            const iconBg = SPEC_ICON_BG[s.id];
            const iconStyle = iconBg ? { background: iconBg } : {};
            const descStyle = isPS ? { color: "#DC2626" } : {};
            return (
              <button
                key={s.id}
                onClick={() => onChange({ specialitaSelezionata: isSelected ? null : s, analisiAI: null })}
                className={`spec-card${isSelected ? " selected" : ""}`}
                aria-pressed={isSelected}
                style={cardStyle}
              >
                <div className="spec-icon" style={iconStyle}>{s.icona}</div>
                <span className="spec-name">{s.nome}</span>
                <span className="spec-desc" style={descStyle}>{s.descrizione}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Diagnosi — hide for PS */}
      {!isPSSelected && (
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
      )}

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

      {/* Bottone AI — hide for PS */}
      {!isPSSelected && (
        <div style={{ marginBottom: "1rem" }}>
          <button onClick={handleAnalyze} disabled={!canAnalyze || loading || isStreaming} className="btn-primary">
            {loading
              ? <><LoadingDots /><span style={{ marginLeft: 6 }}>Analisi in corso…</span></>
              : "✨ Analizza con AI"}
          </button>
          {errore && (
            <p style={{ fontSize: 13, color: "#B91C1C", marginTop: 8 }}>{errore}</p>
          )}
        </div>
      )}

      {/* Box AI result — visibile sia durante lo streaming che a fine — hide for PS */}
      {!isPSSelected && showBox && (
        <div className="ai-box">
          <span className="ai-label">
            ✨ Analisi AI
            {isStreaming && <LoadingDots />}
          </span>
          <div
            className="ai-content"
            dangerouslySetInnerHTML={{ __html: displayedHtml }}
          />
          {/* Domande utili — mostrate solo quando lo streaming è completo */}
          {state.analisiAI && state.analisiAI.domandeDaPorre.length > 0 && (
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
          {isPSSelected ? "Avanti → Pronto Soccorso" : "Avanti → Trova centri"}
        </button>
      </div>
    </div>
  );
}
