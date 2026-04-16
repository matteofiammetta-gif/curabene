"use client";

import { AppState } from "@/lib/types";

interface Step5Props {
  state: AppState;
  onRicomincia: () => void;
  onBack: () => void;
}

const CHECKLIST = [
  { id: 1, text: "Chiama il CUP e prenota la prima visita specialistica" },
  { id: 2, text: "Raccogli tutti gli esami precedenti (referti, imaging, analisi)" },
  { id: 3, text: "Scrivi la tua storia clinica e i farmaci che assumi" },
  { id: 4, text: "Prepara le domande da fare al medico (vedi step 3)" },
  { id: 5, text: "Verifica la copertura SSN e i possibili rimborsi di viaggio" },
  { id: 6, text: "Considera una seconda opinione se hai dubbi sulla diagnosi" },
];

export default function Step5Azioni({ state, onRicomincia, onBack }: Step5Props) {
  const ospedale = state.ospedaleSelezionato;
  const spec = ospedale?.specialita.find(
    (s) => s.specialitaId === state.specialitaSelezionata?.id
  ) ?? null;
  const contatti = spec?.contatti ?? null;
  const medico = spec?.medico ?? null;

  return (
    <div className="space-y-7">
      <div>
        <h2 className="font-fraunces text-2xl font-semibold text-gray-900 mb-1">
          Il tuo piano d&apos;azione
        </h2>
        <p className="text-gray-500 text-sm">
          Ecco i passi concreti per iniziare il tuo percorso di cura
        </p>
      </div>

      {/* Card contatti diretti */}
      {contatti && ospedale && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-fraunces text-lg font-semibold text-gray-900">
            📞 Contatti diretti — {ospedale.nome}
          </h3>

          <div className="grid sm:grid-cols-2 gap-3">
            {contatti.cup && (
              <a
                href={`tel:${contatti.cup.replace(/\s/g, "")}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-brand-50 hover:bg-brand-100 transition-colors"
              >
                <span className="text-xl">📞</span>
                <div>
                  <p className="text-xs text-brand-600 font-semibold uppercase tracking-wide">CUP</p>
                  <p className="text-sm font-bold text-brand-900">{contatti.cup}</p>
                </div>
              </a>
            )}

            {contatti.email && (
              <a
                href={`mailto:${contatti.email}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <span className="text-xl">✉️</span>
                <div>
                  <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">Email</p>
                  <p className="text-sm font-bold text-indigo-900 break-all">{contatti.email}</p>
                </div>
              </a>
            )}

            {contatti.sito && (
              <a
                href={contatti.sito}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-xl">🌐</span>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Sito web</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{contatti.sito.replace("https://", "")}</p>
                </div>
              </a>
            )}

            {contatti.orari && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <span className="text-xl">🕐</span>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Orari</p>
                  <p className="text-sm text-gray-900">{contatti.orari}</p>
                </div>
              </div>
            )}
          </div>

          {/* Fast-track e seconda opinione */}
          <div className="flex flex-wrap gap-2 pt-1">
            {contatti.fasttrack && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                ⚡ Fast-track disponibile
              </span>
            )}
            {contatti.secondaOpinione && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                🔍 Seconda opinione disponibile
              </span>
            )}
          </div>
        </div>
      )}

      {/* Card seconda opinione */}
      {contatti?.secondaOpinione && (
        <div className="bg-blue-50 rounded-2xl p-5 space-y-2">
          <h3 className="font-semibold text-blue-900">🔍 Come richiedere una seconda opinione</h3>
          <ol className="space-y-1.5 text-sm text-blue-800">
            <li className="flex gap-2"><span className="font-bold flex-shrink-0">1.</span>Contatta il centro via email o CUP specificando che vuoi una seconda opinione</li>
            <li className="flex gap-2"><span className="font-bold flex-shrink-0">2.</span>Prepara una cartella clinica completa con tutti gli esami e la diagnosi attuale</li>
            <li className="flex gap-2"><span className="font-bold flex-shrink-0">3.</span>Molti centri offrono la valutazione anche in telemedicina (chiedere esplicitamente)</li>
            <li className="flex gap-2"><span className="font-bold flex-shrink-0">4.</span>Il costo varia: alcuni centri IRCCS la offrono in regime SSN, altri in libera professione (€ 150–300)</li>
          </ol>
        </div>
      )}

      {/* Domande da portare */}
      {medico && medico.domande.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-amber-900">
            💬 Domande da portare dal {medico.nome}
          </h3>
          <ol className="space-y-1.5">
            {medico.domande.map((d, i) => (
              <li key={i} className="flex gap-2 text-sm text-amber-900">
                <span className="text-amber-400 font-bold flex-shrink-0">{i + 1}.</span>
                {d}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Checklist 6 punti */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h3 className="font-fraunces text-lg font-semibold text-gray-900">
          ✅ Checklist prima della visita
        </h3>
        <ul className="space-y-2.5">
          {CHECKLIST.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-sm text-gray-700">{item.text}</span>
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
          onClick={onRicomincia}
          className="px-6 py-2.5 rounded-xl border-2 border-brand-500 text-brand-700 font-semibold text-sm hover:bg-brand-50 transition-colors"
        >
          🔄 Ricomincia
        </button>
      </div>
    </div>
  );
}
