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
      <ol className="flex items-center justify-between">
        {STEPS.map((step, idx) => {
          const isCompleted = step.n < stepCorrente;
          const isCurrent = step.n === stepCorrente;
          const isPending = step.n > stepCorrente;

          return (
            <li key={step.n} className="flex items-center flex-1">
              {/* Cerchio step */}
              <div className="flex flex-col items-center">
                <div
                  className={[
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    isCompleted
                      ? "bg-brand-600 text-white"
                      : isCurrent
                      ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500"
                      : "bg-gray-100 text-gray-400",
                  ].join(" ")}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step.n
                  )}
                </div>
                <span
                  className={[
                    "mt-1 text-xs font-medium hidden sm:block",
                    isCurrent
                      ? "text-brand-700"
                      : isCompleted
                      ? "text-brand-600"
                      : "text-gray-400",
                  ].join(" ")}
                >
                  {step.label}
                </span>
              </div>

              {/* Connettore */}
              {idx < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mt-[-16px] sm:mt-[-18px]">
                  <div
                    className={[
                      "h-full transition-colors",
                      isCompleted ? "bg-brand-500" : "bg-gray-200",
                    ].join(" ")}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
