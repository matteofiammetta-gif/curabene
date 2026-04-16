"use client";

import { AppState } from "@/lib/types";
import DoctorCard from "@/components/DoctorCard";

interface Step3Props {
  state: AppState;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3Medico({ state, onNext, onBack }: Step3Props) {
  const ospedale = state.ospedaleSelezionato;
  const specId = state.specialitaSelezionata?.id ?? "";
  const spec = ospedale?.specialita.find((s) => s.specialitaId === specId) ?? null;

  if (!ospedale || !spec) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Seleziona prima un centro al passo 2.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-fraunces text-2xl font-semibold text-gray-900 mb-1">
          Il tuo medico di riferimento
        </h2>
        <p className="text-gray-500 text-sm">
          Responsabile di {state.specialitaSelezionata?.nome} presso {ospedale.nome}
        </p>
      </div>

      <DoctorCard medico={spec.medico} ospedalNome={ospedale.nome} />

      {/* Box info extra */}
      <div className="bg-brand-50 rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold text-brand-900 text-sm">
          💡 Come prepararsi alla visita
        </h3>
        <ul className="space-y-2 text-sm text-brand-800">
          {[
            "Porta tutti gli esami precedenti (referti, imaging, esami del sangue)",
            "Prepara un elenco dei farmaci che stai assumendo con dosaggi",
            "Scrivi i sintomi che hai avuto e da quanto tempo",
            "Porta il medico di base se non riesci ad andare da solo/a",
            "Puoi registrare la visita sul tuo telefono se il medico è d'accordo",
          ].map((tip, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-brand-400 font-bold flex-shrink-0">✓</span>
              {tip}
            </li>
          ))}
        </ul>
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
          Avanti → Stima costi
        </button>
      </div>
    </div>
  );
}
