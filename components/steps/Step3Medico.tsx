"use client";

import { AppState } from "@/lib/types";
import DoctorCard from "@/components/DoctorCard";

interface Step3Props {
  state: AppState;
  onNext: () => void;
  onBack: () => void;
}

const PREP_TIPS = [
  "Porta tutti gli esami precedenti (referti, imaging, analisi del sangue)",
  "Prepara un elenco dei farmaci che assumi con i dosaggi",
  "Scrivi i sintomi che hai avuto e da quanto tempo",
  "Porta un familiare o un amico per supporto",
  "Puoi registrare la visita se il medico è d'accordo",
];

export default function Step3Medico({ state, onNext, onBack }: Step3Props) {
  const ospedale = state.ospedaleSelezionato;
  const specId   = state.specialitaSelezionata?.id ?? "";
  const spec     = ospedale?.specialita.find((s) => s.specialitaId === specId) ?? null;

  if (!ospedale || !spec) {
    return (
      <div className="px-5 pb-6 text-center py-12 text-sm" style={{ color: "var(--cb-text3)" }}>
        Seleziona prima un centro al passo 2.
      </div>
    );
  }

  return (
    <div className="px-5 pb-6 space-y-5">
      <p className="text-xs" style={{ color: "var(--cb-text3)" }}>
        Responsabile di {state.specialitaSelezionata?.nome} presso {ospedale.nome}
      </p>

      <DoctorCard medico={spec.medico} ospedalNome={ospedale.nome} />

      {/* Tips preparazione visita */}
      <div
        className="rounded-xl p-4"
        style={{ background: "var(--cb-blue-light)", border: "1px solid rgba(27,79,114,0.12)" }}
      >
        <span className="eyebrow mb-3" style={{ color: "var(--cb-blue)", fontSize: 11 }}>
          💡 Come prepararsi alla visita
        </span>
        <ul className="space-y-2 mt-3">
          {PREP_TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--cb-text1)" }}>
              <span className="check-circle flex-shrink-0 mt-0.5">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1 4l2 2 4-4" stroke="var(--cb-green)" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-between pt-1">
        <button onClick={onBack} className="btn-secondary">← Indietro</button>
        <button onClick={onNext} className="btn-primary">Avanti → Stima costi</button>
      </div>
    </div>
  );
}
