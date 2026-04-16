interface ProgressBarProps {
  stepCorrente: 1 | 2 | 3 | 4 | 5;
}

const STEPS = [
  { n: 1, label: "Specialità" },
  { n: 2, label: "Centri" },
  { n: 3, label: "Medico" },
  { n: 4, label: "Costi" },
  { n: 5, label: "Azioni" },
] as const;

export default function ProgressBar({ stepCorrente }: ProgressBarProps) {
  return (
    <nav aria-label="Avanzamento" className="w-full">
      {/* Riga cerchi + linee — tutti alla stessa altezza */}
      <div className="flex items-center">
        {STEPS.map((step, idx) => {
          const isCompleted = step.n < stepCorrente;
          const isCurrent   = step.n === stepCorrente;

          return (
            <div key={step.n} className="flex items-center" style={{ flex: idx < STEPS.length - 1 ? 1 : undefined }}>
              {/* Cerchio */}
              <div
                aria-current={isCurrent ? "step" : undefined}
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
                style={
                  isCompleted
                    ? { background: "var(--cb-green)" }
                    : isCurrent
                    ? { background: "var(--cb-blue)" }
                    : { background: "transparent", border: "1.5px solid var(--cb-text3)" }
                }
              >
                {isCompleted ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5 4-4" stroke="#fff" strokeWidth="1.6"
                          strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: isCurrent ? "#fff" : "var(--cb-text3)",
                    lineHeight: 1,
                  }}>
                    {step.n}
                  </span>
                )}
              </div>

              {/* Linea connettore — non dopo l'ultimo */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`progress-line${isCompleted ? " done" : ""}`}
                  style={{ margin: "0 4px" }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Etichette — riga separata, solo per step attivo */}
      <div className="flex mt-1" style={{ paddingLeft: 0 }}>
        {STEPS.map((step, idx) => {
          const isCurrent = step.n === stepCorrente;
          // Calcola posizione: ogni step occupa proporzione uguale tranne l'ultimo
          const isLast = idx === STEPS.length - 1;
          return (
            <div
              key={step.n}
              style={{
                flex: isLast ? undefined : 1,
                display: "flex",
                justifyContent: "flex-start",
              }}
            >
              {isCurrent && (
                <span style={{
                  fontSize: 10,
                  color: "var(--cb-blue)",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}>
                  {step.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
