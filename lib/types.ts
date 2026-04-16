// ─── Specialità ────────────────────────────────────────────────────────────────

export interface Specialita {
  id: string;
  nome: string;
  descrizione: string;
  icona: string; // emoji
  mediaNazionaleMortalita: number;
}

// ─── Medico ────────────────────────────────────────────────────────────────────

export interface Medico {
  nome: string;
  ruolo: string;
  iniziali: string;
  pubblicazioni: number;
  trialAttivi: number;
  affiliazioni: string[];
  bio: string;
  domande: string[];
  fonteNome?: string; // "non_trovato_in_elenco_ufficiale" when name could not be verified
}

// ─── Contatti ──────────────────────────────────────────────────────────────────

export interface Contatti {
  cup: string | null;
  email: string | null;
  fasttrack: boolean;
  secondaOpinione: boolean;
  sito: string | null;
  orari: string | null;
}

// ─── OspedaleSpecialita ────────────────────────────────────────────────────────

export interface OspedaleSpecialita {
  specialitaId: string;
  volumeAnnuo: number;
  mortalita30gg: number;
  mortalitaStimata: boolean;           // true = stima PNE, non dato diretto
  pazientiDaFuoriRegione: number;      // percentuale 0–100
  degenzaMedia: number;                // giorni
  tassoUtilizzo: number | null;        // % posti letto usati
  postiLettoOrdinari: number | null;
  volumeLabel: string;                 // es. "Centro di riferimento nazionale"
  badges: string[];                    // es. ["IRCCS", "Trial Clinici"]
  spiegazione: string;
  fonteVolume: string;
  fonteMortalita: string;
  annoRiferimentoDati: number;
  avvertenza: string;
  medico: Medico;
  contatti: Contatti;
}

// ─── Ospedale ──────────────────────────────────────────────────────────────────

export interface Ospedale {
  id: string;
  nome: string;
  citta: string;
  regione: string;
  specialita: OspedaleSpecialita[];
}

// ─── Regioni italiane ──────────────────────────────────────────────────────────

export type RegioneItaliana =
  | "Abruzzo"
  | "Basilicata"
  | "Calabria"
  | "Campania"
  | "Emilia-Romagna"
  | "Friuli-Venezia Giulia"
  | "Lazio"
  | "Liguria"
  | "Lombardia"
  | "Marche"
  | "Molise"
  | "Piemonte"
  | "Puglia"
  | "Sardegna"
  | "Sicilia"
  | "Toscana"
  | "Trentino-Alto Adige"
  | "Umbria"
  | "Valle d'Aosta"
  | "Veneto";

// ─── Raggio di ricerca ─────────────────────────────────────────────────────────

export type Raggio = "regione" | "fuori" | "italia";

// ─── Analisi AI ────────────────────────────────────────────────────────────────

export interface AnalisiAI {
  sommario: string;
  domandeDaPorre: string[];
  coseDaSapere: string[];
  livelloUrgenza: "bassa" | "media" | "alta";
}

// ─── AppState ──────────────────────────────────────────────────────────────────

export interface AppState {
  specialitaSelezionata: Specialita | null;
  raggio: Raggio;
  regione: RegioneItaliana | null;
  diagnosi: string;
  analisiAI: AnalisiAI | null;
  ospedaleSelezionato: Ospedale | null;
  stepCorrente: 1 | 2 | 3 | 4 | 5;
}

// ─── API payloads ──────────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  diagnosi: string;
  specialitaId: string;
}

export interface AnalyzeResponse {
  analisi: AnalisiAI;
}

export interface AdminAuthRequest {
  password: string;
}

export interface AdminAuthResponse {
  ok: boolean;
}
