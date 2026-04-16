"use client";

import { useState } from "react";
import psOspedaliData from "@/data/ps_ospedali.json";

interface StepPSProps {
  regione: string | null;
}

interface TriageResult {
  codice: "rosso" | "arancione" | "verde" | "bianco";
  area_clinica: string;
  descrizione: string;
  cosa_fare_ora: string;
  chiamare_112: boolean;
  urgenza_stimata: "immediata" | "entro_1h" | "entro_4h" | "non_urgente";
}

interface PSOspedale {
  id: string;
  nome: string;
  citta: string;
  regione: string;
  tipo: "DEA_II" | "DEA_I" | "PS";
  accessi_annui: number;
  permanenza_media_verde_min: number;
  permanenza_media_bianco_min: number;
  tasso_abbandono_pct: number;
  fonte_dato: string;
  anno_dato: number;
  url_live: string | null;
  indirizzo: string;
  telefono: string | null;
  nota_dato: string;
}

const CODICI = {
  rosso:     { bg: "#FEE2E2", color: "#7F1D1D", label: "ROSSO — Urgenza alta" },
  arancione: { bg: "#FEF3C7", color: "#78350F", label: "ARANCIONE — Urgenza" },
  verde:     { bg: "#DCFCE7", color: "#14532D", label: "VERDE — Urgenza minore" },
  bianco:    { bg: "#F8FAFC", color: "#334155", label: "BIANCO — Non urgente" },
} as const;

function formatMinuti(min: number): string {
  if (min < 60) return `~${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `~${h} ore` : `~${h} ore ${m} min`;
}

function getTempoAttesa(ps: PSOspedale, codice: string | null): string {
  if (codice === "rosso") return "Trattamento immediato";
  if (codice === "arancione") return "~30 min (priorità alta)";
  if (codice === "bianco") return formatMinuti(ps.permanenza_media_bianco_min);
  return formatMinuti(ps.permanenza_media_verde_min); // verde or null
}

function tipoBadgeClass(tipo: string): string {
  if (tipo === "DEA_II") return "badge badge-p";
  if (tipo === "DEA_I") return "badge badge-b";
  return "badge badge-g";
}
function tipoLabel(tipo: string): string {
  if (tipo === "DEA_II") return "Centro Hub";
  if (tipo === "DEA_I") return "PS Avanzato";
  return "PS Base";
}

export default function StepPS({ regione }: StepPSProps) {
  const [sintomo, setSintomo] = useState("");
  const [loading, setLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const psData = psOspedaliData as PSOspedale[];

  // Filter PS for the selected region, sorted by verde wait time ascending
  const psLocali = psData
    .filter((ps) => ps.regione === regione)
    .sort((a, b) => a.permanenza_media_verde_min - b.permanenza_media_verde_min);

  const showPSList = triageResult && (triageResult.codice === "verde" || triageResult.codice === "bianco" || triageResult.codice === "arancione");

  async function handleTriage() {
    if (!sintomo.trim()) return;
    setLoading(true);
    setErrore(null);
    setTriageResult(null);
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sintomo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ errore: "Errore sconosciuto" }));
        throw new Error(err.errore ?? "Errore del server");
      }
      const data = await res.json();
      setTriageResult(data as TriageResult);
    } catch (e: unknown) {
      setErrore(e instanceof Error ? e.message : "Errore di rete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="step-body">
      {/* BLOCCO A: Emergency banner */}
      <div style={{
        background: "#FEF3E2",
        borderLeft: "4px solid #F59E0B",
        borderRadius: 8,
        padding: "12px 16px",
        fontSize: 13,
        color: "#92400E",
        marginBottom: "1.25rem",
        lineHeight: 1.6,
      }}>
        In caso di emergenza chiama il <strong>112</strong>.
        Questo strumento orienta solo per casi non critici.
      </div>

      {/* BLOCCO B: Triage AI */}
      <div className="field-group">
        <label className="field-label">Descrivi cosa ti è successo</label>
        <p className="section-note" style={{ marginBottom: "0.5rem" }}>
          L&apos;AI analizza i tuoi sintomi e stima il codice triage appropriato.
        </p>
        <textarea
          rows={3}
          placeholder="Es. Ho mal di testa forte da 2 ore con nausea, ho caduto e mi fa male il polso, ho dolore al petto..."
          value={sintomo}
          onChange={(e) => setSintomo(e.target.value)}
          className="field-input"
          style={{ resize: "vertical" }}
        />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <button
          onClick={handleTriage}
          disabled={!sintomo.trim() || loading}
          className="btn-primary"
        >
          {loading ? (
            <>
              <span className="ai-dots">
                <span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" />
              </span>
              <span style={{ marginLeft: 6 }}>Valutazione in corso…</span>
            </>
          ) : "🔍 Valuta urgenza"}
        </button>
        {errore && (
          <p style={{ fontSize: 13, color: "#B91C1C", marginTop: 8 }}>{errore}</p>
        )}
      </div>

      {/* Triage result */}
      {triageResult && (
        <div style={{ marginBottom: "1rem" }}>
          {triageResult.chiamare_112 ? (
            /* 112 alert */
            <div style={{
              background: "#FEE2E2",
              border: "2px solid #DC2626",
              borderRadius: 10,
              padding: 16,
              textAlign: "center",
              color: "#7F1D1D",
              fontSize: 15,
              margin: "1rem 0",
            }}>
              <strong>CHIAMA IL 112 SUBITO</strong>
              <p style={{ marginTop: 8, fontSize: 14 }}>{triageResult.cosa_fare_ora}</p>
            </div>
          ) : (
            /* Color badge result */
            <div style={{
              background: CODICI[triageResult.codice].bg,
              border: `1.5px solid ${CODICI[triageResult.codice].color}40`,
              borderRadius: 10,
              padding: "1rem 1.25rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{
                  background: CODICI[triageResult.codice].color,
                  color: "white",
                  borderRadius: 8,
                  padding: "4px 12px",
                  fontWeight: 600,
                  fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {CODICI[triageResult.codice].label}
                </span>
                <span className="badge badge-b">{triageResult.area_clinica}</span>
              </div>
              <p style={{ fontSize: 14, color: "#1A1814", marginBottom: 8, lineHeight: 1.6 }}>
                {triageResult.descrizione}
              </p>
              <div style={{
                borderLeft: "3px solid #1A6B3C",
                paddingLeft: 12,
                fontSize: 13,
                color: "#5C5852",
                marginBottom: 8,
              }}>
                <strong style={{ color: "#1A6B3C" }}>Cosa fare ora: </strong>
                {triageResult.cosa_fare_ora}
              </div>
              <span className="badge badge-g">
                ⏱ {triageResult.urgenza_stimata.replace(/_/g, " ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* BLOCCO C: PS list — shown for verde/bianco/arancione */}
      {showPSList && (
        <div style={{ marginTop: "1.5rem" }}>
          <p className="field-label" style={{ fontSize: 14, marginBottom: 4 }}>
            Pronto Soccorso nella tua regione
          </p>
          <p className="section-note">
            Tempi di attesa medi 2024 — fonte AGENAS/Ministero della Salute.
            Non sono dati live. Per il dato in tempo reale clicca &quot;Verifica ora&quot;.
          </p>

          {psLocali.length === 0 ? (
            <div style={{
              border: "1.5px dashed rgba(0,0,0,0.16)",
              borderRadius: 10, padding: "1.5rem", textAlign: "center",
              fontSize: 13, color: "#9E9A94",
            }}>
              Nessun PS disponibile per la regione selezionata nel database.
            </div>
          ) : (
            psLocali.map((ps) => (
              <div key={ps.id} className="hosp-card" style={{ cursor: "default" }}>
                <div className="hosp-top">
                  <div>
                    <div className="hosp-name">{ps.nome}</div>
                    <div className="hosp-loc">📍 {ps.citta} · {ps.indirizzo}</div>
                  </div>
                  <span className={tipoBadgeClass(ps.tipo)}>{tipoLabel(ps.tipo)}</span>
                </div>

                <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                  <div className="stat-box">
                    <div className="stat-val">{getTempoAttesa(ps, triageResult.codice)}</div>
                    <div className="stat-lbl">Attesa stimata</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-val">{ps.accessi_annui.toLocaleString("it-IT")}</div>
                    <div className="stat-lbl">Accessi/anno</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-val">{ps.tasso_abbandono_pct.toFixed(1)}%</div>
                    <div className="stat-lbl">Tasso abbandono</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ps.tasso_abbandono_pct > 15 && (
                      <span className="badge badge-a">⚠ Alto tasso abbandono</span>
                    )}
                    {ps.telefono && (
                      <span className="badge badge-p">📞 {ps.telefono}</span>
                    )}
                  </div>
                  {ps.url_live && (
                    <a
                      href={ps.url_live}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary"
                      style={{ fontSize: 12, padding: "6px 12px", minHeight: "unset", textDecoration: "none" }}
                    >
                      Verifica ora →
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* BLOCCO D: Data note */}
      <div style={{
        background: "var(--surface2)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12,
        color: "var(--text3)",
        marginTop: "1rem",
        lineHeight: 1.6,
      }}>
        Dati: AGENAS 2024 / Ministero della Salute Annuario SSN 2023.
        I tempi sono medie annuali — variano per ora del giorno, giorno della settimana e stagione.{" "}
        <a href="https://pne.agenas.it" target="_blank" rel="noopener noreferrer" style={{ color: "var(--acm)" }}>
          Dati ufficiali struttura per struttura →
        </a>
      </div>
    </div>
  );
}
