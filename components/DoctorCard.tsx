import { Medico } from "@/lib/types";

interface DoctorCardProps {
  medico: Medico;
  ospedalNome: string;
}

export default function DoctorCard({ medico, ospedalNome }: DoctorCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      {/* Avatar + nome */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
          <span className="font-fraunces text-xl font-bold text-brand-700">
            {medico.iniziali}
          </span>
        </div>
        <div>
          <h3 className="font-fraunces text-xl font-semibold text-gray-900">
            {medico.nome}
          </h3>
          <p className="text-sm text-brand-600">{medico.ruolo}</p>
          <p className="text-xs text-gray-500 mt-0.5">{ospedalNome}</p>
        </div>
      </div>

      {/* KPI badge row */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 rounded-full px-3 py-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
          </svg>
          <span className="text-xs font-semibold">
            {medico.pubblicazioni} pubblicazioni
          </span>
        </div>
        {medico.trialAttivi > 0 && (
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 rounded-full px-3 py-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-semibold">
              {medico.trialAttivi} trial attivi
            </span>
          </div>
        )}
      </div>

      {/* Bio */}
      <p className="text-sm text-gray-600 leading-relaxed">{medico.bio}</p>

      {/* Affiliazioni */}
      {medico.affiliazioni.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Affiliazioni
          </p>
          <ul className="space-y-0.5">
            {medico.affiliazioni.map((aff) => (
              <li key={aff} className="text-xs text-gray-600 flex gap-1.5">
                <span className="text-brand-400 mt-0.5">•</span>
                {aff}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Domande da portare */}
      {medico.domande.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">
            💬 Domande da portare in visita
          </p>
          <ol className="space-y-1.5">
            {medico.domande.map((d, i) => (
              <li key={i} className="text-sm text-amber-900 flex gap-2">
                <span className="text-amber-400 font-bold flex-shrink-0">{i + 1}.</span>
                {d}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
