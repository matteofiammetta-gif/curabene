import { Ospedale, OspedaleSpecialita } from "@/lib/types";

interface HospitalCardProps {
  ospedale: Ospedale;
  spec: OspedaleSpecialita;
  mediaNazionale: number;
  selected: boolean;
  onSelect: () => void;
}

function mortalitaColor(valore: number, media: number) {
  const diff = valore - media;
  if (diff <= -0.3) return { bg: "var(--cb-green-light)", text: "var(--cb-green)", label: "↓ sotto media" };
  if (diff >= 0.5)  return { bg: "#FEE2E2",               text: "#991B1B",         label: "↑ sopra media" };
  return               { bg: "var(--cb-amber-light)",    text: "var(--cb-amber)", label: "≈ media" };
}

export default function HospitalCard({
  ospedale,
  spec,
  mediaNazionale,
  selected,
  onSelect,
}: HospitalCardProps) {
  const mc = mortalitaColor(spec.mortalita30gg, mediaNazionale);

  return (
    <button
      onClick={onSelect}
      className={`hospital-card${selected ? " selected" : ""}`}
      aria-pressed={selected}
    >
      {/* Header riga */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="font-fraunces text-base font-normal leading-snug"
              style={{ color: "var(--cb-text1)" }}
            >
              {ospedale.nome}
            </h3>
            {selected && (
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
                style={{ background: "var(--cb-blue)" }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.6"
                        strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--cb-text3)" }}>
            📍 {ospedale.citta}, {ospedale.regione}
          </p>
        </div>

        {/* Badge volume */}
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
          style={{ background: "var(--cb-blue-light)", color: "var(--cb-blue)" }}
        >
          {spec.volumeLabel}
        </span>
      </div>

      {/* Stat grid 4 colonne */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="stat-box">
          <div className="stat-value">{spec.volumeAnnuo.toLocaleString("it-IT")}</div>
          <div className="stat-label">Dimessi/anno</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{spec.degenzaMedia}<span style={{ fontSize: 11, fontWeight: 400 }}> gg</span></div>
          <div className="stat-label">Degenza media</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{spec.pazientiDaFuoriRegione}%</div>
          <div className="stat-label">Fuori regione</div>
        </div>
        <div className="stat-box" style={{ background: mc.bg }}>
          <div className="stat-value" style={{ color: mc.text, fontSize: 13 }}>
            {spec.mortalita30gg.toFixed(1)}%
          </div>
          <div className="stat-label" style={{ color: mc.text }}>{mc.label}</div>
        </div>
      </div>

      {/* Badges eccellenza */}
      {spec.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {spec.badges.map((badge) => (
            <span
              key={badge}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "var(--cb-violet-light)",
                color: "var(--cb-violet)",
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      {/* Spiegazione */}
      <p className="text-sm leading-relaxed" style={{ color: "var(--cb-text2)" }}>
        {spec.spiegazione}
      </p>

      {/* Disclaimer mortalità stimata */}
      {spec.mortalitaStimata && (
        <p className="mt-2 text-xs" style={{ color: "var(--cb-text3)" }}>
          ⚠️ Mortalità stimata su benchmark PNE 2024 · dati reali su{" "}
          <span style={{ textDecoration: "underline" }}>pne.agenas.it</span>
        </p>
      )}
    </button>
  );
}
