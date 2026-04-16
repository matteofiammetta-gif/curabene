"use client";

import { AppState } from "@/lib/types";

interface Step5Props {
  state: AppState;
  onRicomincia: () => void;
  onBack: () => void;
}

const CHECKLIST = [
  "Chiama il CUP e prenota la prima visita specialistica",
  "Raccogli tutti gli esami precedenti (referti, imaging, analisi)",
  "Scrivi la tua storia clinica e i farmaci che assumi",
  "Prepara le domande da fare al medico (vedi step 3)",
  "Verifica la copertura SSN e i possibili rimborsi di viaggio",
  "Considera una seconda opinione se hai dubbi sulla diagnosi",
];

export default function Step5Azioni({ state, onRicomincia, onBack }: Step5Props) {
  const ospedale = state.ospedaleSelezionato;
  const spec     = ospedale?.specialita.find((s) => s.specialitaId === state.specialitaSelezionata?.id) ?? null;
  const contatti = spec?.contatti ?? null;
  const medico   = spec?.medico   ?? null;

  return (
    <div className="step-body">
      <p className="section-note">Ecco i passi concreti per iniziare il tuo percorso di cura</p>

      {/* Contatti diretti */}
      {contatti && ospedale && (
        <div className="contact-block" style={{ marginBottom: "1rem" }}>
          <div className="contact-block-title">
            <span>📞 Contatti — {ospedale.nome}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {contatti.fasttrack && <span className="badge badge-g">⚡ Fast-track</span>}
              {contatti.secondaOpinione && <span className="badge badge-b">🔍 2ª opinione</span>}
            </div>
          </div>
          {contatti.cup && (
            <div className="contact-row">
              <span className="contact-key">CUP Prenotazioni</span>
              <span className="contact-val">
                <a href={`tel:${contatti.cup.replace(/\s/g, "")}`}>{contatti.cup}</a>
              </span>
            </div>
          )}
          {contatti.email && (
            <div className="contact-row">
              <span className="contact-key">Email</span>
              <span className="contact-val">
                <a href={`mailto:${contatti.email}`}>{contatti.email}</a>
              </span>
            </div>
          )}
          {contatti.sito && (
            <div className="contact-row">
              <span className="contact-key">Sito web</span>
              <span className="contact-val">
                <a href={contatti.sito} target="_blank" rel="noopener noreferrer">
                  {contatti.sito.replace("https://", "")}
                </a>
              </span>
            </div>
          )}
          {contatti.orari && (
            <div className="contact-row">
              <span className="contact-key">Orari</span>
              <span className="contact-val" style={{ color: "#5C5852" }}>{contatti.orari}</span>
            </div>
          )}
        </div>
      )}

      {/* Seconda opinione */}
      {contatti?.secondaOpinione && (
        <div className="info-box" style={{ marginBottom: "1rem" }}>
          <span className="info-box-title">🔍 Come richiedere una seconda opinione</span>
          <ol style={{ paddingLeft: 0, listStyle: "none" }}>
            {[
              "Contatta il centro via email o CUP specificando che vuoi una seconda opinione",
              "Prepara una cartella clinica completa con tutti gli esami e la diagnosi attuale",
              "Molti centri offrono la valutazione anche in telemedicina (chiedere esplicitamente)",
              "Il costo varia: alcuni in SSN, altri in libera professione (€ 150–300)",
            ].map((s, i) => (
              <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#1B4F72", marginBottom: 6 }}>
                <span className="q-num" style={{ background: "rgba(27,79,114,0.12)", color: "#1B4F72" }}>{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Domande dal medico */}
      {medico && medico.domande.length > 0 && (
        <div className="note-box" style={{ marginBottom: "1rem" }}>
          <span className="note-box-title">💬 Domande da portare dal {medico.nome}</span>
          <ol style={{ paddingLeft: 0, listStyle: "none" }}>
            {medico.domande.map((d, i) => (
              <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, marginBottom: 6 }}>
                <span className="q-num">{i + 1}</span>
                {d}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Checklist */}
      <ul className="check-list" style={{ marginBottom: "1rem" }}>
        {CHECKLIST.map((item, i) => (
          <li key={i} className="check-item">
            <div className="check-icon">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 4l2 2 4-4" stroke="#1A6B3C" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {item}
          </li>
        ))}
      </ul>

      <div className="step-nav">
        <button onClick={onBack} className="btn-secondary">← Indietro</button>
        <button onClick={onRicomincia} className="btn-secondary">🔄 Ricomincia</button>
      </div>
    </div>
  );
}
