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

function getSpec(ospedale: Ospedale, specialitaId: string): OspedaleSpecialita | null {
  return ospedale.specialita.find((s) => s.specialitaId === specialitaId) ?? null;
}

function filterOspedali(ospedali: Ospedale[], state: AppState): Array<{ ospedale: Ospedale; spec: OspedaleSpecialita }> {
  if (!state.specialitaSelezionata) return [];

  const allMatching = ospedali
    .flatMap((o) => {
      const spec = getSpec(o, state.specialitaSelezionata!.id);
      if (!spec) return [];
      return [{ ospedale: o, spec }];
    })
    .sort((a, b) => b.spec.volumeAnnuo - a.spec.volumeAnnuo);

  if (state.raggio === "regione") {
    // Solo centri nella regione selezionata
    return allMatching.filter(({ ospedale }) =>
      ospedale.regione.toLowerCase() === (state.regione ?? "").toLowerCase()
    );
  }

  if (state.raggio === "fuori") {
    // Centri nella propria regione + top 5 nazionali fuori regione
    const regioneUtente = (state.regione ?? "").toLowerCase();
    const inRegione = allMatching.filter(({ ospedale }) =>
      ospedale.regione.toLowerCase() === regioneUtente
    );
    const fuoriRegione = allMatching
      .filter(({ ospedale }) => ospedale.regione.toLowerCase() !== regioneUtente)
      .slice(0, 5);
    const seen = new Set<string>();
    return [...inRegione, ...fuoriRegione].filter(({ ospedale }) => {
      if (seen.has(ospedale.id)) return false;
      seen.add(ospedale.id);
      return true;
    });
  }

  // "italia" – tutti ordinati per volume
  return allMatching;
}

export default function Step2Centri({ ospedali, specialita, state, onChange, onNext, onBack }: Step2Props) {
  const filtered = filterOspedali(ospedali, state);
  const mediaNazionale =
    specialita.find((s) => s.id === state.specialitaSelezionata?.id)?.mediaNazionaleMortalita ?? 2.0;

  return (
    <div className="step-body">
      <p className="section-note">
        {filtered.length === 0
          ? "Nessun centro trovato con i filtri selezionati — prova a espandere il raggio."
          : `${filtered.length} ${filtered.length === 1 ? "centro trovato" : "centri trovati"} · ordinati per volume`}
      </p>

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

      <div className="step-nav">
        <button onClick={onBack} className="btn-secondary">← Indietro</button>
        <button onClick={onNext} disabled={state.ospedaleSelezionato === null} className="btn-primary">
          Avanti → Medico
        </button>
      </div>
    </div>
  );
}
