"use client";

import { useState, useEffect, useRef } from "react";
import { AppState, Specialita, Ospedale } from "@/lib/types";
import ProgressBar from "@/components/ProgressBar";
import Step1Diagnosi from "@/components/steps/Step1Diagnosi";
import Step2Centri from "@/components/steps/Step2Centri";
import Step3Medico from "@/components/steps/Step3Medico";
import Step4Costi from "@/components/steps/Step4Costi";
import Step5Azioni from "@/components/steps/Step5Azioni";
import DataDisclaimer from "@/components/DataDisclaimer";
import Link from "next/link";

interface CuraBeneAppProps {
  specialita: Specialita[];
  ospedali: Ospedale[];
}

const INITIAL_STATE: AppState = {
  specialitaSelezionata: null,
  raggio: "italia",
  regione: null,
  diagnosi: "",
  analisiAI: null,
  ospedaleSelezionato: null,
  stepCorrente: 1,
};

// Colori header per ogni step
const STEP_CONFIG = {
  1: {
    label: "Specialità & Diagnosi",
    accent: "var(--cb-green)",
    light:  "var(--cb-green-light)",
    border: "rgba(26,107,60,0.18)",
  },
  2: {
    label: "Centri di eccellenza",
    accent: "var(--cb-blue)",
    light:  "var(--cb-blue-light)",
    border: "rgba(27,79,114,0.18)",
  },
  3: {
    label: "Il tuo medico",
    accent: "var(--cb-violet)",
    light:  "var(--cb-violet-light)",
    border: "rgba(74,37,128,0.18)",
  },
  4: {
    label: "Stima dei costi",
    accent: "var(--cb-amber)",
    light:  "var(--cb-amber-light)",
    border: "rgba(139,90,0,0.18)",
  },
  5: {
    label: "Piano d'azione",
    accent: "var(--cb-teal)",
    light:  "var(--cb-teal-light)",
    border: "rgba(13,110,110,0.18)",
  },
} as const;

type StepNum = 1 | 2 | 3 | 4 | 5;

function StepBlock({
  n,
  currentStep,
  children,
}: {
  n: StepNum;
  currentStep: StepNum;
  children: React.ReactNode;
}) {
  const cfg = STEP_CONFIG[n];
  const state =
    n === currentStep ? "active" : n < currentStep ? "done" : "locked";

  return (
    <div className={`step-block ${state}`}>
      {/* Header colorato */}
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{
          background: cfg.light,
          borderBottom: `1px solid ${cfg.border}`,
        }}
      >
        {/* Numero */}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: cfg.accent }}
        >
          {state === "done" ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.6"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <span style={{ fontSize: 11, color: "#fff", fontWeight: 500, lineHeight: 1 }}>{n}</span>
          )}
        </div>
        <span
          className="text-sm font-medium"
          style={{ color: cfg.accent }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Body — solo se attivo o completato */}
      {state !== "locked" && children}
    </div>
  );
}

export default function CuraBeneApp({ specialita, ospedali }: CuraBeneAppProps) {
  const [appState, setAppState] = useState<AppState>(INITIAL_STATE);

  // Ref per ogni step block — per l'auto-scroll
  const stepRefs = useRef<Record<number, HTMLDivElement | null>>({});

  function patch(update: Partial<AppState>) {
    setAppState((prev) => ({ ...prev, ...update }));
  }

  function goTo(step: AppState["stepCorrente"]) {
    setAppState((prev) => ({ ...prev, stepCorrente: step }));
  }

  function ricomincia() {
    setAppState(INITIAL_STATE);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Auto-scroll verso lo step appena attivato
  useEffect(() => {
    const el = stepRefs.current[appState.stepCorrente];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top, behavior: "smooth" });
  }, [appState.stepCorrente]);

  const step = appState.stepCorrente;

  return (
    <div className="min-h-screen" style={{ background: "var(--cb-bg)" }}>

      {/* ── Header sticky 60px ──────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40"
        style={{
          height: 60,
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--cb-border)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
        }}
      >
        <div
          className="mx-auto flex items-center justify-between gap-4 h-full px-4 sm:px-6"
          style={{ maxWidth: 900 }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <span
              className="font-fraunces text-xl font-normal"
              style={{ color: "var(--cb-blue)", letterSpacing: "-0.5px" }}
            >
              CuraBene
            </span>
            <span
              className="hidden sm:inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: "var(--cb-blue-light)",
                color: "var(--cb-blue)",
                border: "1px solid rgba(27,79,114,0.18)",
              }}
            >
              Dati PNE · AGENAS
            </span>
          </div>

          {/* ProgressBar + ricomincia */}
          <div className="flex items-center gap-4 flex-1 justify-end">
            <div className="hidden sm:block" style={{ width: 220 }}>
              <ProgressBar stepCorrente={step} />
            </div>
            <button
              onClick={ricomincia}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--cb-text3)", background: "var(--cb-surface2)" }}
            >
              🔄 Ricomincia
            </button>
          </div>
        </div>
      </header>

      {/* ProgressBar mobile — sotto header */}
      <div
        className="sm:hidden px-4 py-2"
        style={{ background: "var(--cb-surface)", borderBottom: "1px solid var(--cb-border)" }}
      >
        <ProgressBar stepCorrente={step} />
      </div>

      {/* ── Contenuto principale ─────────────────────────────────────────── */}
      <main
        className="mx-auto px-4 sm:px-6 py-6 pb-24"
        style={{ maxWidth: 900 }}
      >
        <div className="space-y-4">

          {/* Step 1 — sempre visibile */}
          <div ref={(el) => { stepRefs.current[1] = el; }}>
            <StepBlock n={1} currentStep={step}>
              <Step1Diagnosi
                specialita={specialita}
                state={appState}
                onChange={patch}
                onNext={() => goTo(2)}
              />
            </StepBlock>
          </div>

          {/* Step 2 */}
          {step >= 2 && (
            <div ref={(el) => { stepRefs.current[2] = el; }}>
              <StepBlock n={2} currentStep={step}>
                <Step2Centri
                  ospedali={ospedali}
                  specialita={specialita}
                  state={appState}
                  onChange={patch}
                  onNext={() => goTo(3)}
                  onBack={() => goTo(1)}
                />
              </StepBlock>
            </div>
          )}

          {/* Step 3 */}
          {step >= 3 && (
            <div ref={(el) => { stepRefs.current[3] = el; }}>
              <StepBlock n={3} currentStep={step}>
                <Step3Medico
                  state={appState}
                  onNext={() => goTo(4)}
                  onBack={() => goTo(2)}
                />
              </StepBlock>
            </div>
          )}

          {/* Step 4 */}
          {step >= 4 && (
            <div ref={(el) => { stepRefs.current[4] = el; }}>
              <StepBlock n={4} currentStep={step}>
                <Step4Costi
                  state={appState}
                  onNext={() => goTo(5)}
                  onBack={() => goTo(3)}
                />
              </StepBlock>
            </div>
          )}

          {/* Step 5 */}
          {step >= 5 && (
            <div ref={(el) => { stepRefs.current[5] = el; }}>
              <StepBlock n={5} currentStep={step}>
                <Step5Azioni
                  state={appState}
                  onRicomincia={ricomincia}
                  onBack={() => goTo(4)}
                />
              </StepBlock>
            </div>
          )}

        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer
        className="mx-auto px-4 sm:px-6 py-5 flex items-center justify-between text-xs"
        style={{
          maxWidth: 900,
          color: "var(--cb-text3)",
          borderTop: "1px solid var(--cb-border)",
        }}
      >
        <p>© 2024 CuraBene · Navigatore Sanitario Italiano</p>
        <Link
          href="/admin"
          className="transition-colors hover:underline"
          style={{ color: "var(--cb-text3)" }}
        >
          Admin
        </Link>
      </footer>

      <DataDisclaimer />
    </div>
  );
}
