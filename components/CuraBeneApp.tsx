"use client";

import { useState } from "react";
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

export default function CuraBeneApp({ specialita, ospedali }: CuraBeneAppProps) {
  const [appState, setAppState] = useState<AppState>(INITIAL_STATE);

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

  const STEP_LABELS: Record<AppState["stepCorrente"], string> = {
    1: "Diagnosi e specialità",
    2: "Centri di eccellenza",
    3: "Il tuo medico",
    4: "Stima costi",
    5: "Piano d'azione",
  };

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      {/* ── Header sticky ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-fraunces text-2xl font-bold text-gray-900 leading-none">
              CuraBene
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Navigatore Sanitario</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200 font-medium">
              📊 Dati PNE · AGENAS
            </span>
            <button
              onClick={ricomincia}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              🔄 Ricomincia
            </button>
          </div>
        </div>

        {/* ProgressBar sticky sotto l'header */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-3 pt-1">
          <ProgressBar stepCorrente={appState.stepCorrente} />
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-10">

        {/* Step 1 */}
        <section
          className={[
            "transition-opacity duration-300",
            appState.stepCorrente === 1
              ? "opacity-100"
              : appState.stepCorrente > 1
              ? "opacity-75 pointer-events-none"
              : "opacity-35 pointer-events-none",
          ].join(" ")}
        >
          <div className="mb-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              Step 1
            </span>
            <h2 className="font-fraunces text-xl font-bold text-gray-900">
              {STEP_LABELS[1]}
            </h2>
          </div>
          <Step1Diagnosi
            specialita={specialita}
            state={appState}
            onChange={patch}
            onNext={() => goTo(2)}
          />
        </section>

        {/* Step 2 */}
        {appState.stepCorrente >= 2 && (
          <section
            className={[
              "transition-opacity duration-300",
              appState.stepCorrente === 2
                ? "opacity-100"
                : appState.stepCorrente > 2
                ? "opacity-75 pointer-events-none"
                : "opacity-35 pointer-events-none",
            ].join(" ")}
          >
            <div className="mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                Step 2
              </span>
              <h2 className="font-fraunces text-xl font-bold text-gray-900">
                {STEP_LABELS[2]}
              </h2>
            </div>
            <Step2Centri
              ospedali={ospedali}
              specialita={specialita}
              state={appState}
              onChange={patch}
              onNext={() => goTo(3)}
              onBack={() => goTo(1)}
            />
          </section>
        )}

        {/* Step 3 */}
        {appState.stepCorrente >= 3 && (
          <section
            className={[
              "transition-opacity duration-300",
              appState.stepCorrente === 3
                ? "opacity-100"
                : appState.stepCorrente > 3
                ? "opacity-75 pointer-events-none"
                : "opacity-35 pointer-events-none",
            ].join(" ")}
          >
            <div className="mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                Step 3
              </span>
              <h2 className="font-fraunces text-xl font-bold text-gray-900">
                {STEP_LABELS[3]}
              </h2>
            </div>
            <Step3Medico
              state={appState}
              onNext={() => goTo(4)}
              onBack={() => goTo(2)}
            />
          </section>
        )}

        {/* Step 4 */}
        {appState.stepCorrente >= 4 && (
          <section
            className={[
              "transition-opacity duration-300",
              appState.stepCorrente === 4
                ? "opacity-100"
                : appState.stepCorrente > 4
                ? "opacity-75 pointer-events-none"
                : "opacity-35 pointer-events-none",
            ].join(" ")}
          >
            <div className="mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                Step 4
              </span>
              <h2 className="font-fraunces text-xl font-bold text-gray-900">
                {STEP_LABELS[4]}
              </h2>
            </div>
            <Step4Costi
              state={appState}
              onNext={() => goTo(5)}
              onBack={() => goTo(3)}
            />
          </section>
        )}

        {/* Step 5 */}
        {appState.stepCorrente >= 5 && (
          <section className="opacity-100 transition-opacity duration-300">
            <div className="mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                Step 5
              </span>
              <h2 className="font-fraunces text-xl font-bold text-gray-900">
                {STEP_LABELS[5]}
              </h2>
            </div>
            <Step5Azioni
              state={appState}
              onRicomincia={ricomincia}
              onBack={() => goTo(4)}
            />
          </section>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between text-xs text-gray-400 border-t border-gray-200">
        <p>© 2024 CuraBene · Navigatore Sanitario Italiano</p>
        <Link
          href="/admin"
          className="hover:text-gray-600 transition-colors"
        >
          Admin
        </Link>
      </footer>

      <DataDisclaimer />
    </div>
  );
}
