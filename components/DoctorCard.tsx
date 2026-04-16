import { Medico } from "@/lib/types";

interface DoctorCardProps {
  medico: Medico;
  ospedalNome: string;
}

export default function DoctorCard({ medico, ospedalNome }: DoctorCardProps) {
  return (
    <div className="doc-card">
      {/* Header */}
      <div className="doc-header">
        <div className="doc-avatar">{medico.iniziali}</div>
        <div className="doc-meta">
          <div className="doc-name">{medico.nome}</div>
          <div className="doc-role">{medico.ruolo}</div>
          <div className="doc-hosp">{ospedalNome}</div>
        </div>
      </div>

      {/* Badge KPI */}
      <div className="doc-badges">
        {medico.pubblicazioni > 0 && (
          <span className="badge badge-b">{medico.pubblicazioni} pubblicazioni</span>
        )}
        {medico.trialAttivi > 0 && (
          <span className="badge badge-g">{medico.trialAttivi} trial attivi</span>
        )}
        {medico.pubblicazioni === 0 && medico.trialAttivi === 0 && (
          <span className="badge badge-p">Dati non disponibili — contattare il centro</span>
        )}
      </div>

      {/* Bio */}
      <div className="doc-bio">{medico.bio}</div>

      {/* Affiliazioni */}
      {medico.affiliazioni.length > 0 && (
        <div className="doc-affiliations">
          {medico.affiliazioni.map((aff) => (
            <span key={aff} className="doc-aff">{aff}</span>
          ))}
        </div>
      )}

      {/* Domande */}
      {medico.domande.length > 0 && (
        <ul className="q-list">
          <span className="q-list-title">💬 Domande da portare in visita</span>
          {medico.domande.map((d, i) => (
            <li key={i} className="q-item">
              <span className="q-num">{i + 1}</span>
              {d}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
