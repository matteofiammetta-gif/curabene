export default function DataDisclaimer() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-t border-gray-200 px-4 py-2">
      <p className="text-center text-xs text-gray-500 leading-relaxed">
        <span className="font-medium">Dati di volume e degenza:</span> Ministero
        della Salute — Annuario SSN 2022.{" "}
        <span className="font-medium">Mortalità:</span> stima basata su medie
        PNE 2024 (AGENAS) — non è il dato reale della struttura.{" "}
        <a
          href="https://pne.agenas.it"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800"
        >
          Dati ufficiali struttura per struttura → pne.agenas.it
        </a>
      </p>
    </div>
  );
}
