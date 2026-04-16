"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface AdminMessage {
  role: "user" | "assistant";
  content: string;
  tipo?: string;
  istruzioni?: string;
  dati?: Record<string, unknown>;
  errore?: string;
}

const PROMPT_PRECOMPILATI = [
  "Qual è la copertura attuale per la Sardegna?",
  "Aggiungi l'Ospedale Niguarda in cardiologia a Milano",
  "Aggiungi la specialità reumatologia con id 'reumatologia'",
  "Modifica il testo di spiegazione dell'IEO Milano in oncologia",
];

export default function AdminApp() {
  const [password, setPassword]         = useState("");
  const [autenticato, setAutenticato]   = useState(false);
  const [erroreLogin, setErroreLogin]   = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);

  const [messaggi, setMessaggi] = useState<AdminMessage[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoadingLogin(true);
    setErroreLogin("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messaggio: "ping", password, contestoAttuale: "" }),
      });
      if (res.status === 401) {
        setErroreLogin("Password errata");
      } else {
        setAutenticato(true);
      }
    } catch {
      setErroreLogin("Errore di rete");
    } finally {
      setLoadingLogin(false);
    }
  }

  async function sendMessage(msg: string) {
    if (!msg.trim()) return;
    setMessaggi((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messaggio: msg, password, contestoAttuale: "" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessaggi((prev) => [
          ...prev,
          { role: "assistant", content: "", errore: data.errore ?? "Errore sconosciuto" },
        ]);
        return;
      }
      setMessaggi((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.descrizione ?? "",
          tipo: data.tipo,
          istruzioni: data.istruzioni,
          dati: data.dati,
        },
      ]);
    } catch {
      setMessaggi((prev) => [
        ...prev,
        { role: "assistant", content: "", errore: "Errore di rete" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function copyJSON(dati: Record<string, unknown>) {
    navigator.clipboard.writeText(JSON.stringify(dati, null, 2)).catch(() => {});
  }

  /* ─── Login ─────────────────────────────────────────────────── */
  if (!autenticato) {
    return (
      <div className="admin-page">
        <div className="admin-login-card">
          <div className="admin-login-head">
            <div className="admin-login-title">CuraBene</div>
            <span className="admin-badge">Admin</span>
          </div>
          <form onSubmit={handleLogin}>
            <div className="admin-form-group">
              <label htmlFor="admin-pw" className="admin-form-label">
                Password admin
              </label>
              <input
                id="admin-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="admin-form-input"
                required
              />
            </div>
            {erroreLogin && <p className="admin-error">{erroreLogin}</p>}
            <button type="submit" disabled={loadingLogin} className="admin-submit-btn">
              {loadingLogin ? "Verifica…" : "Accedi"}
            </button>
          </form>
          <Link href="/" className="admin-back-link">← Torna all&apos;app</Link>
        </div>
      </div>
    );
  }

  /* ─── Dashboard ──────────────────────────────────────────────── */
  return (
    <div className="admin-dashboard-page">
      <header className="admin-header">
        <div className="admin-header-brand">
          <Link href="/" className="admin-header-logo">CuraBene</Link>
          <span className="admin-badge">Admin</span>
        </div>
        <button
          onClick={() => { setAutenticato(false); setMessaggi([]); }}
          className="admin-logout-btn"
        >
          Esci
        </button>
      </header>

      <div className="admin-layout">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="admin-panel">
            <span className="admin-panel-title">Prompt rapidi</span>
            {PROMPT_PRECOMPILATI.map((p, i) => (
              <button
                key={i}
                onClick={() => sendMessage(p)}
                disabled={loading}
                className="admin-prompt-btn"
              >
                {p}
              </button>
            ))}
          </div>
          <div className="admin-note-box">
            <span className="admin-note-title">⚠️ Nota v1</span>
            <p className="admin-note-text">
              Le modifiche suggerite dall&apos;AI <strong>non si applicano automaticamente</strong>.
              Copia il JSON e incollalo in{" "}
              <code className="admin-note-code">/data/ospedali.json</code>.
            </p>
          </div>
        </aside>

        {/* Chat */}
        <main className="admin-chat">
          <div className="admin-messages">
            {messaggi.length === 0 && (
              <div className="admin-empty">
                <div className="admin-empty-emoji">🤖</div>
                <p>Chiedi all&apos;AI di modificare ospedali, specialità o testi.</p>
                <p style={{ fontSize: 12, marginTop: 4, color: "#9E9A94" }}>
                  Usa i prompt rapidi a sinistra per iniziare.
                </p>
              </div>
            )}

            {messaggi.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <div className="admin-msg-user">
                    <div className="admin-bubble-user">{msg.content}</div>
                  </div>
                ) : (
                  <div className="admin-msg-ai">
                    <div className="admin-msg-ai-inner">
                      {msg.errore && (
                        <div className="admin-bubble-error">❌ {msg.errore}</div>
                      )}
                      {msg.content && (
                        <div className="admin-bubble-text">{msg.content}</div>
                      )}
                      {msg.tipo && msg.tipo !== "risposta_informativa" && (
                        <div className="admin-bubble-suggestion">
                          <div className="admin-suggestion-header">
                            <span className="admin-suggestion-label">✅ Modifica suggerita</span>
                            <span className="admin-suggestion-type">{msg.tipo}</span>
                          </div>
                          {msg.istruzioni && (
                            <p className="admin-suggestion-instructions">{msg.istruzioni}</p>
                          )}
                          {msg.dati && Object.keys(msg.dati).length > 0 && (
                            <button onClick={() => copyJSON(msg.dati!)} className="admin-copy-btn">
                              📋 Copia JSON
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="admin-loading">
                <div className="admin-loading-bubble">
                  <div className="admin-loading-dot" />
                  <div className="admin-loading-dot" />
                  <div className="admin-loading-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="admin-input-row">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              style={{ display: "flex", gap: 8, flex: 1 }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Chiedi una modifica o una domanda sui dati…"
                disabled={loading}
                className="admin-input"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="admin-send-btn"
              >
                Invia
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
