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

// Mappa accent → bg chiaro (rgba validi, non `var(...)18` che è CSS invalido)
const ACCENT_CONFIG: Record<string, { accent: string; bg: string }> = {
  green:  { accent: "var(--cb-green)",  bg: "var(--cb-green-light)" },
  blue:   { accent: "var(--cb-blue)",   bg: "var(--cb-blue-light)" },
  violet: { accent: "var(--cb-violet)", bg: "var(--cb-violet-light)" },
  teal:   { accent: "var(--cb-teal)",   bg: "var(--cb-teal-light)" },
};

function ContactBlock({
  icon,
  label,
  value,
  href,
  colorKey,
}: {
  icon: string;
  label: string;
  value: string;
  href?: string;
  colorKey: keyof typeof ACCENT_CONFIG;
}) {
  const { accent, bg } = ACCENT_CONFIG[colorKey];

  const inner = (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: bg }}
    >
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="eyebrow" style={{ color: accent, fontSize: 10 }}>
          {label}
        </span>
        <p
          className="text-sm font-medium mt-0.5 truncate"
          style={{ color: "var(--cb-text1)" }}
        >
          {value}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined}
         rel="noopener noreferrer" style={{ textDecoration: "none" }}>
        {inner}
      </a>
    );
  }
  return <div>{inner}</div>;
}

export default function Step5Azioni({ state, onRicomincia, onBack }: Step5Props) {
  const ospedale = state.ospedaleSelezionato;
  const spec     = ospedale?.specialita.find((s) => s.specialitaId === state.specialitaSelezionata?.id) ?? null;
  const contatti = spec?.contatti ?? null;
  const medico   = spec?.medico   ?? null;

  return (
    <div className="px-5 pb-6 space-y-5">
      <p className="text-xs" style={{ color: "var(--cb-text3)" }}>
        Ecco i passi concreti per iniziare il tuo percorso di cura
      </p>

      {/* Contatti diretti */}
      {contatti && ospedale && (
        <div className="rounded-xl overflow-hidden"
             style={{ border: "1px solid var(--cb-border)" }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2"
               style={{ background: "var(--cb-surface2)", borderBottom: "1px solid var(--cb-border)" }}>
            <span className="text-sm font-medium" style={{ color: "var(--cb-text1)" }}>
              📞 Contatti — {ospedale.nome}
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {contatti.fasttrack && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "var(--cb-green-light)", color: "var(--cb-green)" }}>
                  ⚡ Fast-track
                </span>
              )}
              {contatti.secondaOpinione && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "var(--cb-blue-light)", color: "var(--cb-blue)" }}>
                  🔍 2ª opinione
                </span>
              )}
            </div>
          </div>

          {/* Griglia contatti */}
          <div className="p-3 grid sm:grid-cols-2 gap-2">
            {contatti.cup && (
              <ContactBlock icon="📞" label="CUP Prenotazioni"
                value={contatti.cup}
                href={`tel:${contatti.cup.replace(/\s/g, "")}`}
                colorKey="green" />
            )}
            {contatti.email && (
              <ContactBlock icon="✉️" label="Email"
                value={contatti.email}
                href={`mailto:${contatti.email}`}
                colorKey="blue" />
            )}
            {contatti.sito && (
              <ContactBlock icon="🌐" label="Sito web"
                value={contatti.sito.replace("https://", "")}
                href={contatti.sito}
                colorKey="violet" />
            )}
            {contatti.orari && (
              <ContactBlock icon="🕐" label="Orari"
                value={contatti.orari}
                colorKey="teal" />
            )}
          </div>
        </div>
      )}

      {/* Seconda opinione */}
      {contatti?.secondaOpinione && (
        <div className="rounded-xl px-4 py-4 space-y-2 text-sm"
             style={{ background: "var(--cb-blue-light)", border: "1px solid rgba(27,79,114,0.12)" }}>
          <p className="font-medium" style={{ color: "var(--cb-blue)" }}>
            🔍 Come richiedere una seconda opinione
          </p>
          <ol className="space-y-1.5" style={{ color: "var(--cb-text1)" }}>
            {[
              "Contatta il centro via email o CUP specificando che vuoi una seconda opinione",
              "Prepara una cartella clinica completa con tutti gli esami e la diagnosi attuale",
              "Molti centri offrono la valutazione anche in telemedicina (chiedere esplicitamente)",
              "Il costo varia: alcuni in SSN, altri in libera professione (€ 150–300)",
            ].map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-medium flex-shrink-0" style={{ color: "var(--cb-blue)" }}>{i + 1}.</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Domande da portare */}
      {medico && medico.domande.length > 0 && (
        <div className="rounded-xl px-4 py-4 space-y-2"
             style={{ background: "var(--cb-amber-light)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--cb-amber)" }}>
            💬 Domande da portare dal {medico.nome}
          </p>
          <ol className="space-y-1.5">
            {medico.domande.map((d, i) => (
              <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--cb-text1)" }}>
                <span className="font-medium flex-shrink-0" style={{ color: "var(--cb-amber)" }}>{i + 1}.</span>
                {d}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Checklist */}
      <div className="rounded-xl overflow-hidden"
           style={{ border: "1px solid var(--cb-border)" }}>
        <div className="px-4 py-3"
             style={{ background: "var(--cb-surface2)", borderBottom: "1px solid var(--cb-border)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--cb-text1)" }}>
            ✅ Checklist prima della visita
          </span>
        </div>
        <ul>
          {CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3"
                style={{ borderTop: i > 0 ? "1px solid var(--cb-border)" : undefined }}>
              <div className="check-circle mt-0.5 flex-shrink-0">
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <path d="M1.5 4.5l2 2 4-4" stroke="var(--cb-green)" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-sm" style={{ color: "var(--cb-text2)" }}>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-between pt-1">
        <button onClick={onBack} className="btn-secondary">← Indietro</button>
        <button onClick={onRicomincia} className="btn-secondary">🔄 Ricomincia</button>
      </div>
    </div>
  );
}
