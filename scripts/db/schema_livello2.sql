-- =============================================================
-- CuraBene Megadatabase — Livello 2: tabelle medici
-- Eseguito via psycopg2 il 2026-04-18
-- =============================================================

CREATE TABLE IF NOT EXISTS medici (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cognome text NOT NULL,
  nome text NOT NULL,
  data_nascita date,
  codice_regione text,
  regione text,
  codice_azienda text,
  azienda text,
  disciplina text,
  codice_disciplina text,
  data_inizio date,
  data_fine date,
  attivo boolean DEFAULT true,
  anni_incarico int,
  struttura_pne_id text,
  fonte text DEFAULT 'csv_ministero_2026',
  created_at timestamptz DEFAULT now(),
  UNIQUE (cognome, nome, data_nascita)
);

CREATE TABLE IF NOT EXISTS medici_scientifica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id uuid REFERENCES medici(id),
  pubmed_author_id text,
  n_pub_totali int,
  n_pub_5anni int,
  h_index_proxy int,
  citazioni_totali int,
  if_medio numeric,
  if_massimo numeric,
  patologie_principali jsonb,
  n_trial_pi int,
  n_trial_coinv int,
  trial_attivi jsonb,
  sponsor_pharma_count int,
  sponsor_pharma_nomi jsonb,
  conflitti_interesse text,
  primo_autore_count int,
  ultimo_autore_count int,
  confidenza_match text,
  aggiornato_il date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medici_profilo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id uuid REFERENCES medici(id),
  url_pagina_ospedale text,
  h_index_dichiarato int,
  volume_operatorio_annuo int,
  procedure_specializzazione jsonb,
  formazione_internazionale boolean,
  centri_formazione jsonb,
  ruolo_universita text,
  anni_esperienza_stimati int,
  foto_url text,
  fonte text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medici_riconoscimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id uuid REFERENCES medici(id),
  societa_scientifiche jsonb,
  autore_linee_guida boolean DEFAULT false,
  linee_guida_dettaglio jsonb,
  faculty_congressi jsonb,
  editorial_board jsonb,
  ruolo_aifa boolean DEFAULT false,
  ruolo_iss boolean DEFAULT false,
  ruolo_agenas boolean DEFAULT false,
  premi jsonb,
  professore_universitario boolean DEFAULT false,
  ruolo_accademico text,
  ateneo text,
  grants_count int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medici_accessibilita (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id uuid REFERENCES medici(id),
  libera_professione boolean,
  prezzo_min int,
  prezzo_max int,
  prima_disponibilita_gg int,
  rating_medio numeric,
  n_recensioni int,
  piattaforme jsonb,
  telemedicina boolean DEFAULT false,
  aggiornato_il date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medici_regione    ON medici(regione);
CREATE INDEX IF NOT EXISTS idx_medici_disciplina ON medici(disciplina);
CREATE INDEX IF NOT EXISTS idx_medici_azienda    ON medici(azienda);
CREATE INDEX IF NOT EXISTS idx_medici_attivo     ON medici(attivo);
CREATE INDEX IF NOT EXISTS idx_medici_struttura  ON medici(struttura_pne_id);

-- View aggregata per CuraBene
CREATE OR REPLACE VIEW medici_profilo_completo AS
SELECT
  m.id,
  m.cognome, m.nome,
  m.regione, m.azienda, m.disciplina,
  m.data_inizio, m.attivo, m.anni_incarico,
  m.struttura_pne_id,
  ps.struttura_nome,
  ps.cluster  AS reparto_cluster_pne,
  ps.grado    AS reparto_grado_pne,
  ps.volume   AS reparto_volume,
  st.scimago_percentile,
  st.scimago_rank,
  ms.n_pub_5anni, ms.h_index_proxy,
  ms.if_massimo, ms.n_trial_pi,
  ms.sponsor_pharma_count,
  ms.confidenza_match,
  mp.volume_operatorio_annuo,
  mp.formazione_internazionale,
  mp.h_index_dichiarato,
  mr.autore_linee_guida,
  mr.ruolo_aifa, mr.ruolo_iss,
  mr.professore_universitario,
  ma.prezzo_min, ma.prezzo_max,
  ma.prima_disponibilita_gg,
  ma.rating_medio, ma.n_recensioni
FROM medici m
LEFT JOIN pne_strutture ps
  ON m.struttura_pne_id = ps.struttura_pne_id
  AND ps.anno = '2024'
LEFT JOIN strutture st
  ON m.struttura_pne_id = st.pne_id
LEFT JOIN medici_scientifica   ms ON m.id = ms.medico_id
LEFT JOIN medici_profilo       mp ON m.id = mp.medico_id
LEFT JOIN medici_riconoscimento mr ON m.id = mr.medico_id
LEFT JOIN medici_accessibilita  ma ON m.id = ma.medico_id;
