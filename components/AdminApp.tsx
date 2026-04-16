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
  const [password, setPassword] = useState("");
  const [autenticato, setAutenticato] = useState(false);
  const [erroreLogin, setErroreLogin] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);

  const [messaggi, setMessaggi] = useState<AdminMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoadingLogin(true);
    setErroreLogin("");

    // Verifica password via API (invia un ping)
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
    const userMsg: AdminMessage = { role: "user", content: msg };
    setMessaggi((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messaggio: msg,
          password,
          contestoAttuale: "",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessaggi((prev) => [
          ...prev,
          { role: "assistant", content: "", errore: data.errore ?? "Errore sconosciuto" },
        ]);
        return;
      }

      const assistantMsg: AdminMessage = {
        role: "assistant",
        content: data.descrizione ?? "",
        tipo: data.tipo,
        istruzioni: data.istruzioni,
        dati: data.dati,
      };
      setMessaggi((prev) => [...prev, assistantMsg]);
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
    navigator.clipboard.writeText(JSON.stringify(dati, null, 2)).catch(() => {
      /* silently fail */
    });
  }

  /* ─── Login screen ──────────────────────────────────────────── */
  if (!autenticato) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6 text-center">
            <h1 className="font-fraunces text-2xl font-bold text-gray-900">CuraBene</h1>
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
              Admin
            </span>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password admin
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                required
              />
            </div>
            {erroreLogin && (
              <p className="text-sm text-red-600">{erroreLogin}</p>
            )}
            <button
              type="submit"
              disabled={loadingLogin}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loadingLogin ? "Verifica…" : "Accedi"}
            </button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
              ← Torna all&apos;app
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Admin dashboard ───────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-fraunces text-xl font-bold text-gray-900">
              CuraBene
            </Link>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
              Admin
            </span>
          </div>
          <button
            onClick={() => { setAutenticato(false); setMessaggi([]); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Esci
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex gap-6 h-[calc(100vh-64px)]">

        {/* ── Sidebar sinistra ─────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 space-y-4 hidden md:block">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Prompt rapidi
            </p>
            <div className="space-y-2">
              {PROMPT_PRECOMPILATI.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  disabled={loading}
                  className="w-full text-left text-xs text-gray-700 px-3 py-2 rounded-xl hover:bg-brand-50 hover:text-brand-800 transition-colors border border-transparent hover:border-brand-200 disabled:opacity-40"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
            <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Nota v1</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Le modifiche suggerite dall&apos;AI <strong>non si applicano automaticamente</strong>.
              Copia il JSON suggerito e incollalo manualmente in{" "}
              <code className="bg-amber-100 px-1 rounded">/data/ospedali.json</code>.
            </p>
          </div>
        </aside>

        {/* ── Chat principale ──────────────────────────────────── */}
        <main className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Messaggi */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messaggi.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-12">
                <p className="text-3xl mb-3">🤖</p>
                <p>Chiedi all&apos;AI di modificare ospedali, specialità o testi.</p>
                <p className="text-xs mt-1 text-gray-300">
                  Usa i prompt rapidi a sinistra per iniziare.
                </p>
              </div>
            )}

            {messaggi.map((msg, i) => (
              <div
                key={i}
                className={["flex", msg.role === "user" ? "justify-end" : "justify-start"].join(" ")}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[75%] bg-brand-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[85%] space-y-2">
                    {/* Errore */}
                    {msg.errore && (
                      <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
                        ❌ {msg.errore}
                      </div>
                    )}

                    {/* Descrizione principale */}
                    {msg.content && (
                      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 leading-relaxed">
                        {msg.content}
                      </div>
                    )}

                    {/* Box modifica suggerita */}
                    {msg.tipo && msg.tipo !== "risposta_informativa" && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                            ✅ Modifica suggerita
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                            {msg.tipo}
                          </span>
                        </div>
                        {msg.istruzioni && (
                          <p className="text-xs text-emerald-800 leading-relaxed">
                            {msg.istruzioni}
                          </p>
                        )}
                        {msg.dati && Object.keys(msg.dati).length > 0 && (
                          <button
                            onClick={() => copyJSON(msg.dati!)}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            📋 Copia JSON
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                  <span className="inline-flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-4">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Chiedi una modifica o una domanda sui dati…"
                disabled={loading}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-40 transition-colors"
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
