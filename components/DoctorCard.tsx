import { Medico } from "@/lib/types";

interface DoctorCardProps {
  medico: Medico;
  ospedalNome: string;
}

export default function DoctorCard({ medico, ospedalNome }: DoctorCardProps) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--cb-surface)",
        border: "1px solid var(--cb-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header con avatar */}
      <div
        className="flex items-center gap-4 px-5 py-4"
        style={{ borderBottom: "1px solid var(--cb-border)" }}
      >
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--cb-blue-light)" }}
        >
          <span
            className="font-fraunces text-lg font-normal"
            style={{ color: "var(--cb-blue)" }}
          >
            {medico.iniziali}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className="font-fraunces text-base font-normal leading-tight"
            style={{ color: "var(--cb-text1)" }}
          >
            {medico.nome}
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--cb-blue)" }}>
            {medico.ruolo}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--cb-text3)" }}>
            {ospedalNome}
          </p>
        </div>

        {/* Badge KPI */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: "var(--cb-blue-light)", color: "var(--cb-blue)" }}
          >
            {medico.pubblicazioni} pubbl.
          </span>
          {medico.trialAttivi > 0 && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: "var(--cb-green-light)", color: "var(--cb-green)" }}
            >
              {medico.trialAttivi} trial attivi
            </span>
          )}
        </div>
      </div>

      {/* Bio */}
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--cb-border)" }}>
        <p className="text-sm leading-relaxed" style={{ color: "var(--cb-text2)" }}>
          {medico.bio}
        </p>

        {medico.affiliazioni.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {medico.affiliazioni.map((aff) => (
              <span
                key={aff}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "var(--cb-surface2)", color: "var(--cb-text2)" }}
              >
                {aff}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Domande da portare */}
      {medico.domande.length > 0 && (
        <div className="px-5 py-4" style={{ background: "var(--cb-amber-light)" }}>
          <span className="eyebrow mb-3" style={{ color: "var(--cb-amber)" }}>
            💬 Domande da portare in visita
          </span>
          <ol className="space-y-2 mt-3">
            {medico.domande.map((d, i) => (
              <li key={i} className="flex gap-3 text-sm" style={{ color: "var(--cb-text1)" }}>
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium"
                  style={{
                    background: "rgba(139,90,0,0.15)",
                    color: "var(--cb-amber)",
                  }}
                >
                  {i + 1}
                </span>
                {d}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
