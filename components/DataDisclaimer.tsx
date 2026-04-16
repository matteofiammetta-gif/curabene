export default function DataDisclaimer() {
  return (
    <div className="data-disclaimer">
      <strong>Dati di volume e degenza:</strong> Ministero della Salute — Annuario SSN 2022.{" "}
      <strong>Mortalità:</strong> stima basata su medie PNE 2024 (AGENAS) — non è il dato reale della struttura.{" "}
      <a href="https://pne.agenas.it" target="_blank" rel="noopener noreferrer">
        Dati ufficiali struttura per struttura → pne.agenas.it
      </a>
    </div>
  );
}
