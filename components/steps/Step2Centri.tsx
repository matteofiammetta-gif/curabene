"use client";

import { Ospedale, OspedaleSpecialita, AppState, Specialita } from "@/lib/types";
import HospitalCard from "@/components/HospitalCard";

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

export default function Step2Centri({ ospedali, specialita, state, onChange, onNext, onBack }: Step2Props) {
  const { items: filtered, usedFallback } = filterOspedali(ospedali, state);
  const mediaNazionale =
    specialita.find((s) => s.id === state.specialitaSelezionata?.id)?.mediaNazionaleMortalita ?? 2.0;

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

      {filtered.map(({ ospedale, spec }) => (
        <HospitalCard
          key={`${ospedale.id}-${spec.specialitaId}`}
          ospedale={ospedale}
          spec={spec}
          mediaNazionale={mediaNazionale}
          selected={state.ospedaleSelezionato?.id === ospedale.id}
          onSelect={() =>
            onChange({
              ospedaleSelezionato:
                state.ospedaleSelezionato?.id === ospedale.id ? null : ospedale,
            })
          }
        />
      ))}

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
