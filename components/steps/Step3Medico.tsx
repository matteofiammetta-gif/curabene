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
      <div className="step-body">
        <p className="section-note">Seleziona prima un centro al passo 2.</p>
      </div>
    );
  }

  return (
    <div className="step-body">
      <p className="section-note">
        Responsabile di {state.specialitaSelezionata?.nome} presso {ospedale.nome}
      </p>

      <DoctorCard medico={spec.medico} ospedalNome={ospedale.nome} />

      {/* Tips preparazione */}
      <div className="prep-box">
        <span className="prep-box-title">💡 Come prepararsi alla visita</span>
        <ul className="check-list">
          {PREP_TIPS.map((tip, i) => (
            <li key={i} className="check-item">
              <div className="check-icon">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1 4l2 2 4-4" stroke="#1A6B3C" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <div className="step-nav">
        <button onClick={onBack} className="btn-secondary">← Indietro</button>
        <button onClick={onNext} className="btn-primary">Avanti → Stima costi</button>
      </div>
    </div>
  );
}
