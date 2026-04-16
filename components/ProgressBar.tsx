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
    <div className="progress-track">
      <div className="progress-inner">
        {STEPS.map((step, idx) => {
          const isLast      = idx === STEPS.length - 1;
          const isCompleted = step.n < stepCorrente;
          const isCurrent   = step.n === stepCorrente;

          return (
            <div key={step.n} className="prog-item">
              <div className={`prog-dot${isCompleted ? " done" : isCurrent ? " active" : ""}`}
                   aria-current={isCurrent ? "step" : undefined}>
                {isCompleted ? "✓" : step.n}
              </div>
              <span className={`prog-name${isCurrent ? " active" : ""}`}>
                {step.label}
              </span>
              {!isLast && (
                <div className={`prog-line${isCompleted ? " done" : ""}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
