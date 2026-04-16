"use client";

import { useState, useCallback } from "react";
import { Ospedale, OspedaleSpecialita, AppState, Specialita } from "@/lib/types";
import HospitalCard from "@/components/HospitalCard";

interface AttesaResult {
  classe: string;
  classeLabel: string;
  giorniAttesa: number;
  motivazione: string;
  fonte: string;
  avvertenza: string;
}

const ATTESA_BADGE_STYLE: Record<string, { background: string; color: string }> = {
  U: { background: "#FEE2E2", color: "#7F1D1D" },
  B: { background: "#FEF3C7", color: "#78350F" },
  D: { background: "#FEF9C3", color: "#713F12" },
  P: { background: "#DCFCE7", color: "#14532D" },
};

interface Step2Props {
  ospedali: Ospedale[];
  specialita: Specialita[];
  state: AppState;
  onChange: (patch: Partial<AppState>) => void;
  onNext: () => void;
  onBack: () => void;
}

const MIN_RISULTATI = 4;

function getSpec(ospedale: Ospedale, specialitaId: string): OspedaleSpecialita | null {
  return ospedale.specialita.find((s) => s.specialitaId === specialitaId) ?? null;
}

function volumeDesc(a: { spec: OspedaleSpecialita }, b: { spec: OspedaleSpecialita }): number {
  return b.spec.volumeAnnuo - a.spec.volumeAnnuo;
}

interface FilterResult {
  items: Array<{ ospedale: Ospedale; spec: OspedaleSpecialita }>;
  usedFallback: boolean;
}

function filterOspedali(ospedali: Ospedale[], state: AppState): FilterResult {
  if (!state.specialitaSelezionata) return { items: [], usedFallback: false };

  const specId = state.specialitaSelezionata.id;

  // All hospitals matching the selected specialty, sorted by volume desc
  const allMatching = ospedali
    .flatMap((o) => {
      const spec = getSpec(o, specId);
      if (!spec) return [];
      return [{ ospedale: o, spec }];
    })
    .sort(volumeDesc);

  if (state.raggio === "italia") {
    return { items: allMatching, usedFallback: false };
  }

  const regioneUtente = (state.regione ?? "").toLowerCase();

  const locali = allMatching.filter(({ ospedale }) =>
    ospedale.regione.toLowerCase() === regioneUtente
  );

  if (state.raggio === "regione") {
    if (locali.length >= MIN_RISULTATI) {
      return { items: locali, usedFallback: false };
    }

    // Fallback: fill up to MIN_RISULTATI with best national hospitals not already in locali
    const idLocali = new Set(locali.map(({ ospedale }) => ospedale.id));
    const nazionali = allMatching
      .filter(({ ospedale }) => !idLocali.has(ospedale.id))
      .slice(0, MIN_RISULTATI - locali.length);

    return {
      items: [...locali, ...nazionali],
      usedFallback: nazionali.length > 0,
    };
  }

  if (state.raggio === "fuori") {
    const fuori = allMatching.filter(({ ospedale }) =>
      ospedale.regione.toLowerCase() !== regioneUtente
    );
    const seen = new Set<string>();
    const combinati = [...locali, ...fuori].filter(({ ospedale }) => {
      if (seen.has(ospedale.id)) return false;
      seen.add(ospedale.id);
      return true;
    });
    return { items: combinati, usedFallback: false };
  }

  return { items: locali, usedFallback: false };
}

function LoadingDots() {
  return (
    <span className="ai-dots" style={{ marginLeft: 4 }}>
      <span className="ai-dot" />
      <span className="ai-dot" />
      <span className="ai-dot" />
    </span>
  );
}

export default function Step2Centri({ ospedali, specialita, state, onChange, onNext, onBack }: Step2Props) {
  const { items: filtered, usedFallback } = filterOspedali(ospedali, state);
  const mediaNazionale =
    specialita.find((s) => s.id === state.specialitaSelezionata?.id)?.mediaNazionaleMortalita ?? 2.0;

  const [attesaResult, setAttesaResult] = useState<AttesaResult | null>(null);
  const [attesaLoading, setAttesaLoading] = useState(false);

  const hasDiagnosi = state.diagnosi.trim().length > 3;

  const handleSelect = useCallback(
    async (ospedale: Ospedale) => {
      const isAlreadySelected = state.ospedaleSelezionato?.id === ospedale.id;
      const newSelected = isAlreadySelected ? null : ospedale;
      onChange({ ospedaleSelezionato: newSelected });

      if (!newSelected || !hasDiagnosi || !state.specialitaSelezionata) {
        setAttesaResult(null);
        setAttesaLoading(false);
        return;
      }

      setAttesaLoading(true);
      setAttesaResult(null);
      try {
        const res = await fetch("/api/triage-attesa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            diagnosi: state.diagnosi,
            specialita: state.specialitaSelezionata.id,
          }),
        });
        if (res.ok) {
          const data: AttesaResult = await res.json();
          setAttesaResult(data);
        }
      } catch {
        // silent fail — box semplicemente non appare
      } finally {
        setAttesaLoading(false);
      }
    },
    [state.ospedaleSelezionato, state.diagnosi, state.specialitaSelezionata, hasDiagnosi, onChange]
  );

  // Box tempi attesa da passare alla card selezionata
  const attesaBox = (() => {
    if (!hasDiagnosi) return null;
    if (attesaLoading) {
      return (
        <div className="attesa-box">
          <div className="attesa-label">Tempi di attesa SSN stimati</div>
          <div className="attesa-content" style={{ fontSize: 13, color: "var(--text2)" }}>
            Stimo i tempi di attesa SSN…
            <LoadingDots />
          </div>
        </div>
      );
    }
    if (!attesaResult) return null;
    const badgeStyle = ATTESA_BADGE_STYLE[attesaResult.classe] ?? ATTESA_BADGE_STYLE["D"];
    return (
      <div className="attesa-box">
        <div className="attesa-label">Tempi di attesa SSN stimati</div>
        <div className="attesa-content">
          <span style={{
            fontSize: 12, fontWeight: 600, padding: "3px 8px",
            borderRadius: 6, ...badgeStyle,
          }}>
            {attesaResult.classeLabel}
          </span>
          <span className="attesa-giorni">~{attesaResult.giorniAttesa} giorni (media nazionale)</span>
        </div>
        <div className="attesa-motivazione">{attesaResult.motivazione}</div>
        <div className="attesa-fonte">
          Fonte: {attesaResult.fonte} ·{" "}
          <a
            href="https://www.portaletrasparenzaservizisanitari.it/pnla"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Verifica nella tua regione →
          </a>
        </div>
      </div>
    );
  })();

  return (
    <div className="step-body">
      <div style={{ marginBottom: "0.75rem" }}>
        <p className="section-note" style={{ marginBottom: 4 }}>
          {filtered.length === 0
            ? "Nessun centro trovato con i filtri selezionati — prova a espandere il raggio."
            : `${filtered.length} ${filtered.length === 1 ? "centro trovato" : "centri trovati"} · ordinati per volume`}
        </p>
        {filtered.length > 0 && (
          <p style={{ fontSize: 12, color: "var(--text3)", margin: 0 }}>
            Centri con valutazione AGENAS PNE 2025 &ldquo;molto alto&rdquo; nell&apos;area clinica selezionata.{" "}
            <a href="https://pne.agenas.it" target="_blank" rel="noopener noreferrer"
               style={{ color: "var(--accent)", textDecoration: "underline" }}>
              pne.agenas.it
            </a>
          </p>
        )}
      </div>

      {filtered.length === 0 && (
        <div style={{
          border: "1.5px dashed rgba(0,0,0,0.16)",
          borderRadius: 10, padding: "2rem", textAlign: "center",
          fontSize: 13, color: "#9E9A94", marginBottom: "1rem",
        }}>
          Prova &quot;Anche fuori regione&quot; o &quot;Tutta Italia&quot;
        </div>
      )}

      {filtered.map(({ ospedale, spec }) => {
        const isSelected = state.ospedaleSelezionato?.id === ospedale.id;
        return (
          <HospitalCard
            key={`${ospedale.id}-${spec.specialitaId}`}
            ospedale={ospedale}
            spec={spec}
            mediaNazionale={mediaNazionale}
            selected={isSelected}
            onSelect={() => handleSelect(ospedale)}
            attesaContent={isSelected ? attesaBox : undefined}
          />
        );
      })}

      {usedFallback && (
        <p style={{
          fontSize: 12,
          color: "var(--text3)",
          fontStyle: "italic",
          marginTop: 8,
        }}>
          Non ci sono abbastanza centri nella tua regione per questa specialità — completato con i migliori centri nazionali.
        </p>
      )}

      <div className="step-nav">
        <button onClick={onBack} className="btn-secondary">← Indietro</button>
        <button onClick={onNext} disabled={state.ospedaleSelezionato === null} className="btn-primary">
          Avanti → Medico
        </button>
      </div>
    </div>
  );
}
