import { Ospedale, OspedaleSpecialita } from "@/lib/types";

interface HospitalCardProps {
  ospedale: Ospedale;
  spec: OspedaleSpecialita;
  mediaNazionale: number;
  selected: boolean;
  onSelect: () => void;
}

function mortalitaBadge(valore: number, media: number) {
  const diff = valore - media;
  if (diff <= -0.3) return { cls: "badge-g", label: `${valore.toFixed(1)}% ↓ sotto media` };
  if (diff >= 0.5)  return { cls: "badge-a", label: `${valore.toFixed(1)}% ↑ sopra media` };
  return               { cls: "badge-b", label: `${valore.toFixed(1)}% ≈ media` };
}

export default function HospitalCard({ ospedale, spec, mediaNazionale, selected, onSelect }: HospitalCardProps) {
  const mb = mortalitaBadge(spec.mortalita30gg, mediaNazionale);

  return (
    <button onClick={onSelect} className={`hosp-card${selected ? " selected" : ""}`} aria-pressed={selected}>
      {/* Riga superiore */}
      <div className="hosp-top">
        <div>
          <div className="hosp-name">{ospedale.nome}</div>
          <div className="hosp-loc">📍 {ospedale.citta}, {ospedale.regione}</div>
        </div>
        <span className="badge badge-b">{spec.volumeLabel}</span>
      </div>

      {/* Stat grid */}
      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-val">{spec.volumeAnnuo.toLocaleString("it-IT")}</div>
          <div className="stat-lbl">Dimessi/anno</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{spec.degenzaMedia}<span style={{ fontSize: 13, fontWeight: 400 }}> gg</span></div>
          <div className="stat-lbl">Degenza media</div>
        </div>
        <div className="stat-box">
          <div className="stat-val">{spec.pazientiDaFuoriRegione}%</div>
          <div className="stat-lbl">Fuori regione</div>
        </div>
        <div className="stat-box">
          <span className={`badge ${mb.cls}`} style={{ fontSize: 12, margin: 0 }}>{mb.label}</span>
          <div className="stat-lbl" style={{ marginTop: 6 }}>Mortalità 30gg</div>
        </div>
      </div>

      {/* Badges */}
      {spec.badges.length > 0 && (
        <div className="hosp-badges">
          {spec.badges.map((b) => (
            <span key={b} className="badge badge-p">{b}</span>
          ))}
        </div>
      )}

      {/* Spiegazione */}
      <div className="hosp-explain">{spec.spiegazione}</div>

      {/* Disclaimer */}
      {spec.mortalitaStimata && (
        <div className="hosp-disclaimer">
          ⚠️ Mortalità stimata su benchmark PNE 2024 · dati reali su{" "}
          <span style={{ textDecoration: "underline" }}>pne.agenas.it</span>
        </div>
      )}
    </button>
  );
}
