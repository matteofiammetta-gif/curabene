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
      <ol className="flex items-center">
        {STEPS.map((step, idx) => {
          const isCompleted = step.n < stepCorrente;
          const isCurrent   = step.n === stepCorrente;

          return (
            <li key={step.n} className="flex items-center flex-1 last:flex-none">
              {/* Cerchio */}
              <div className="flex flex-col items-center">
                <div
                  aria-current={isCurrent ? "step" : undefined}
                  style={
                    isCompleted
                      ? { background: "var(--cb-green)",   border: "none" }
                      : isCurrent
                      ? { background: "var(--cb-blue)",    border: "none" }
                      : { background: "transparent", border: "1.5px solid var(--cb-text3)" }
                  }
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0"
                >
                  {isCompleted ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: isCurrent ? "#fff" : "var(--cb-text3)",
                        lineHeight: 1,
                      }}
                    >
                      {step.n}
                    </span>
                  )}
                </div>
                {/* Label: solo per lo step attivo */}
                {isCurrent && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--cb-blue)",
                      fontWeight: 500,
                      marginTop: 3,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {step.label}
                  </span>
                )}
              </div>

              {/* Linea connettore */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`progress-line mx-1 ${isCompleted ? "done" : ""}`}
                  style={{ marginBottom: isCurrent ? 14 : 0 }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
