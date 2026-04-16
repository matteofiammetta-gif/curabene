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

// Configurazione per ogni step
const STEP_CONFIG = {
  1: { eyebrow: "Step 1",    title: "Dimmi cosa stai affrontando" },
  2: { eyebrow: "Step 2",    title: "Centri di eccellenza" },
  3: { eyebrow: "Step 3",    title: "Il tuo medico di riferimento" },
  4: { eyebrow: "Step 4",    title: "Stima dei costi" },
  5: { eyebrow: "Step 5",    title: "Il tuo piano d'azione" },
} as const;

type StepNum = 1 | 2 | 3 | 4 | 5;

export default function CuraBeneApp({ specialita, ospedali }: CuraBeneAppProps) {
  const [appState, setAppState] = useState<AppState>(INITIAL_STATE);
  const stepRefs = useRef<Partial<Record<StepNum, HTMLDivElement | null>>>({});

  function patch(update: Partial<AppState>) {
    setAppState((prev) => ({ ...prev, ...update }));
  }

  function goTo(step: StepNum) {
    setAppState((prev) => ({ ...prev, stepCorrente: step }));
  }

  function ricomincia() {
    setAppState(INITIAL_STATE);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Auto-scroll al nuovo step attivo
  useEffect(() => {
    const el = stepRefs.current[appState.stepCorrente];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: "smooth" });
  }, [appState.stepCorrente]);

  const step = appState.stepCorrente;

  function stepState(n: StepNum): "active" | "done" | "locked" {
    if (n === step) return "active";
    if (n < step)  return "done";
    return "locked";
  }

  function StepBlock({ n, children }: { n: StepNum; children: React.ReactNode }) {
    const st = stepState(n);
    const cfg = STEP_CONFIG[n];
    return (
      <div
        className={`step-block ${st}`}
        ref={(el) => { stepRefs.current[n] = el; }}
      >
        <div className="step-head">
          <div className={`step-num step-num-${n}`}>
            {st === "done" ? "✓" : n}
          </div>
          <div className="step-head-text">
            <span className={`step-eyebrow step-eyebrow-${n}`}>{cfg.eyebrow}</span>
            <span className="step-title">{cfg.title}</span>
          </div>
        </div>
        {st !== "locked" && children}
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="site-header">
        <div className="header-inner">
          <div className="logo-wrap">
            <span className="logo-main">CuraBene</span>
            <span className="logo-sub">Navigatore Sanitario</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="pne-badge">Dati PNE · AGENAS</span>
            <button onClick={ricomincia} className="restart-btn">🔄 Ricomincia</button>
          </div>
        </div>
      </header>

      {/* Progress bar sticky */}
      <ProgressBar stepCorrente={step} />

      {/* Contenuto principale */}
      <main className="main">

        <StepBlock n={1}>
          <Step1Diagnosi
            specialita={specialita}
            state={appState}
            onChange={patch}
            onNext={() => goTo(2)}
          />
        </StepBlock>

        {step >= 2 && (
          <StepBlock n={2}>
            <Step2Centri
              ospedali={ospedali}
              specialita={specialita}
              state={appState}
              onChange={patch}
              onNext={() => goTo(3)}
              onBack={() => goTo(1)}
            />
          </StepBlock>
        )}

        {step >= 3 && (
          <StepBlock n={3}>
            <Step3Medico
              state={appState}
              onNext={() => goTo(4)}
              onBack={() => goTo(2)}
            />
          </StepBlock>
        )}

        {step >= 4 && (
          <StepBlock n={4}>
            <Step4Costi
              state={appState}
              onNext={() => goTo(5)}
              onBack={() => goTo(3)}
            />
          </StepBlock>
        )}

        {step >= 5 && (
          <StepBlock n={5}>
            <Step5Azioni
              state={appState}
              onRicomincia={ricomincia}
              onBack={() => goTo(4)}
            />
          </StepBlock>
        )}

      </main>

      <footer className="site-footer">
        <p>© 2024 CuraBene · Navigatore Sanitario Italiano · <Link href="/admin">Admin</Link></p>
      </footer>

      <DataDisclaimer />
    </>
  );
}
