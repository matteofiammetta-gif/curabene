import { Ospedale, OspedaleSpecialita } from "@/lib/types";

interface HospitalCardProps {
  ospedale: Ospedale;
  spec: OspedaleSpecialita;
  mediaNazionale: number;
  selected: boolean;
  onSelect: () => void;
}

function MortalitaBadge({
  valore,
  media,
}: {
  valore: number;
  media: number;
}) {
  const diff = valore - media;
  const isGood = diff <= -0.3;
  const isBad = diff >= 0.5;

  const color = isGood
    ? "bg-emerald-100 text-emerald-800"
    : isBad
    ? "bg-red-100 text-red-800"
    : "bg-amber-100 text-amber-800";

  const label = isGood ? "↓ sotto media" : isBad ? "↑ sopra media" : "≈ media";

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {valore.toFixed(1)}% {label}
    </span>
  );
}

export default function HospitalCard({
  ospedale,
  spec,
  mediaNazionale,
  selected,
  onSelect,
}: HospitalCardProps) {
  return (
    <button
      onClick={onSelect}
      className={[
        "w-full text-left rounded-2xl border-2 p-5 transition-all duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        selected
          ? "border-brand-500 bg-brand-50 shadow-md"
          : "border-gray-200 bg-white hover:border-brand-300",
      ].join(" ")}
      aria-pressed={selected}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-fraunces text-lg font-semibold text-gray-900 leading-snug">
            {ospedale.nome}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            📍 {ospedale.citta}, {ospedale.regione}
          </p>
        </div>
        {selected && (
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </div>

      {/* Volume label */}
      <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">
        {spec.volumeLabel}
      </p>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-0.5">Dimessi/anno</p>
          <p className="text-lg font-bold text-gray-900">
            {spec.volumeAnnuo.toLocaleString("it-IT")}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-0.5">Degenza media</p>
          <p className="text-lg font-bold text-gray-900">
            {spec.degenzaMedia} <span className="text-sm font-normal">gg</span>
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 mb-1">Mortalità 30gg (stima)</p>
          <MortalitaBadge valore={spec.mortalita30gg} media={mediaNazionale} />
        </div>
      </div>

      {/* Fuori regione */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-400 rounded-full"
            style={{ width: `${Math.min(spec.pazientiDaFuoriRegione, 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-600 whitespace-nowrap">
          {spec.pazientiDaFuoriRegione}% da fuori regione
        </span>
      </div>

      {/* Badges */}
      {spec.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {spec.badges.map((badge) => (
            <span
              key={badge}
              className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      {/* Spiegazione */}
      <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
        {spec.spiegazione}
      </p>

      {/* Disclaimer mortalità */}
      {spec.mortalitaStimata && (
        <p className="mt-2 text-[11px] text-gray-400">
          ⚠️ Mortalità stimata su benchmark PNE 2024 · dati reali su{" "}
          <span className="underline">pne.agenas.it</span>
        </p>
      )}
    </button>
  );
}
