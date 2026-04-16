import { Ospedale, OspedaleSpecialita } from "@/lib/types";

interface HospitalCardProps {
  ospedale: Ospedale;
  spec: OspedaleSpecialita;
  mediaNazionale: number;
  selected: boolean;
  onSelect: () => void;
  attesaContent?: React.ReactNode;
}

function mortalitaBadge(valore: number, media: number) {
  const diff = valore - media;
  if (diff <= -0.3) return { cls: "badge-g", label: `${valore.toFixed(1)}% ↓ sotto media` };
  if (diff >= 0.5)  return { cls: "badge-a", label: `${valore.toFixed(1)}% ↑ sopra media` };
  return               { cls: "badge-b", label: `${valore.toFixed(1)}% ≈ media` };
}

export default function HospitalCard({ ospedale, spec, mediaNazionale, selected, onSelect, attesaContent }: HospitalCardProps) {
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

      {/* Box tempi attesa SSN — solo card selezionata */}
      {attesaContent}

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

      {/* Fonte badge */}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {spec.fonte === "pne_2025_agenas_ufficiale" ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 600, padding: "3px 8px",
            borderRadius: 6, background: "#D1FAE5", color: "#065F46",
            border: "1px solid #6EE7B7", whiteSpace: "nowrap",
          }}>
            ✓ AGENAS PNE 2025
          </span>
        ) : spec.fonte === "irccs_riconosciuto" ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 600, padding: "3px 8px",
            borderRadius: 6, background: "#DBEAFE", color: "#1E40AF",
            border: "1px solid #93C5FD", whiteSpace: "nowrap",
          }}>
            IRCCS nazionale
          </span>
        ) : (spec.fonte === "ministero_volumi_2022" || spec.fonte === "volume_ministero_2022") ? (
          <span style={{
            fontSize: 11, fontWeight: 500, padding: "3px 8px",
            borderRadius: 6, background: "#F3F4F6", color: "#6B7280",
            border: "1px solid #D1D5DB", whiteSpace: "nowrap",
          }}>
            Dati MUR 2022
          </span>
        ) : null}
        {spec.spiegazione_pne && (
          <span style={{ fontSize: 11, color: "var(--text3)", fontStyle: "italic" }}>
            {spec.spiegazione_pne}
          </span>
        )}
      </div>

      {/* Disclaimer */}
      {spec.mortalitaStimata && (
        <div className="hosp-disclaimer">
          ⚠️ Mortalità stimata su benchmark PNE 2025 · dati reali su{" "}
          <a href="https://pne.agenas.it" target="_blank" rel="noopener noreferrer"
             style={{ textDecoration: "underline", color: "inherit" }}>
            pne.agenas.it
          </a>
        </div>
      )}
    </button>
  );
}
