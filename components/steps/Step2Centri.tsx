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

function getSpecForOspedale(ospedale: Ospedale, specialitaId: string): OspedaleSpecialita | null {
  return ospedale.specialita.find((s) => s.specialitaId === specialitaId) ?? null;
}

function filterOspedali(
  ospedali: Ospedale[],
  state: AppState
): Array<{ ospedale: Ospedale; spec: OspedaleSpecialita }> {
  if (!state.specialitaSelezionata) return [];

  return ospedali
    .flatMap((o) => {
      const spec = getSpecForOspedale(o, state.specialitaSelezionata!.id);
      if (!spec) return [];

      const stessaRegione = o.regione.toLowerCase() === (state.regione ?? "").toLowerCase();
      if (state.raggio === "regione" && !stessaRegione) return [];
      if (state.raggio === "fuori"   &&  stessaRegione) return [];

      return [{ ospedale: o, spec }];
    })
    .sort((a, b) => b.spec.volumeAnnuo - a.spec.volumeAnnuo);
}

export default function Step2Centri({ ospedali, specialita, state, onChange, onNext, onBack }: Step2Props) {
  const filtered = filterOspedali(ospedali, state);
  const mediaNazionale =
    specialita.find((s) => s.id === state.specialitaSelezionata?.id)?.mediaNazionaleMortalita ?? 2.0;

  return (
    <div className="px-5 pb-6">
      {/* Conteggio */}
      <p className="text-xs mb-4" style={{ color: "var(--cb-text3)" }}>
        {filtered.length === 0
          ? "Nessun centro trovato con i filtri selezionati — prova a espandere il raggio."
          : `${filtered.length} ${filtered.length === 1 ? "centro trovato" : "centri trovati"} · ordinati per volume`}
      </p>

      {filtered.length === 0 && (
        <div
          className="rounded-xl p-6 text-center text-sm mb-4"
          style={{
            border: "1.5px dashed var(--cb-border-mid)",
            color: "var(--cb-text3)",
          }}
        >
          Prova a selezionare &quot;Anche fuori regione&quot; o &quot;Tutta Italia&quot;
        </div>
      )}

      <div className="space-y-2">
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
      </div>

      <div className="flex justify-between mt-6">
        <button onClick={onBack} className="btn-secondary">
          ← Indietro
        </button>
        <button
          onClick={onNext}
          disabled={state.ospedaleSelezionato === null}
          className="btn-primary"
        >
          Avanti → Medico
        </button>
      </div>
    </div>
  );
}
