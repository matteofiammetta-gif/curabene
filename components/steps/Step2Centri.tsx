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

function getSpecForOspedale(
  ospedale: Ospedale,
  specialitaId: string
): OspedaleSpecialita | null {
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

      // Filtro raggio
      const stessaRegione =
        o.regione.toLowerCase() === (state.regione ?? "").toLowerCase();

      if (state.raggio === "regione" && !stessaRegione) return [];
      if (state.raggio === "fuori" && stessaRegione) return [];
      // "italia" = nessun filtro

      return [{ ospedale: o, spec }];
    })
    .sort((a, b) => b.spec.volumeAnnuo - a.spec.volumeAnnuo);
}

export default function Step2Centri({
  ospedali,
  specialita,
  state,
  onChange,
  onNext,
  onBack,
}: Step2Props) {
  const filtered = filterOspedali(ospedali, state);
  const mediaNazionale =
    specialita.find((s) => s.id === state.specialitaSelezionata?.id)
      ?.mediaNazionaleMortalita ?? 2.0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-fraunces text-2xl font-semibold text-gray-900 mb-1">
          Centri di eccellenza
        </h2>
        <p className="text-gray-500 text-sm">
          {filtered.length === 0
            ? "Nessun centro trovato con i filtri selezionati — prova a espandere il raggio."
            : `${filtered.length} ${filtered.length === 1 ? "centro trovato" : "centri trovati"} · ordinati per volume`}
        </p>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
          <p className="text-gray-400 text-sm">
            Prova a selezionare &quot;Anche fuori regione&quot; o &quot;Tutta Italia&quot;
          </p>
        </div>
      )}

      <div className="space-y-4">
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

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ← Indietro
        </button>
        <button
          onClick={onNext}
          disabled={state.ospedaleSelezionato === null}
          className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Avanti → Medico
        </button>
      </div>
    </div>
  );
}
