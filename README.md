# CuraBene — Navigatore Sanitario Italiano

CuraBene è un'applicazione web che aiuta i pazienti italiani a trovare i migliori centri ospedalieri, medici specialisti e percorsi di cura per la propria patologia.

## Funzionalità

- **5 step guidati**: Specialità → Centri di eccellenza → Medico → Costi → Piano d'azione
- **Dati reali**: Volumi e degenze da Ministero Salute (Annuario SSN 2022)
- **Analisi AI**: Spiegazione della condizione in linguaggio semplice via Claude API
- **Stima costi**: Calcolo orientativo per trasporto, hotel e pasti
- **Pannello Admin**: Interfaccia AI per gestire il database ospedali

## Tecnologie

- [Next.js 14](https://nextjs.org/) con App Router
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Claude API](https://www.anthropic.com/) (Anthropic)
- Font: Fraunces (titoli) + DM Sans (testo) da Google Fonts

## Installazione

### 1. Clona il repository

```bash
git clone https://github.com/tuo-username/curabene.git
cd curabene
```

### 2. Installa le dipendenze

```bash
npm install
```

### 3. Configura le variabili d'ambiente

```bash
cp .env.example .env.local
```

Poi apri `.env.local` e compila:

```env
ANTHROPIC_API_KEY=sk-ant-...    # Ottieni su console.anthropic.com
ADMIN_PASSWORD=scegli-una-password-sicura
```

> ⚠️ Non committare mai `.env.local` su Git — è già nel `.gitignore`.

### 4. Avvia in locale

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) nel browser.

Il pannello admin è su [http://localhost:3000/admin](http://localhost:3000/admin).

## Deploy su Vercel

### Metodo 1 — Via CLI

```bash
npm install -g vercel
vercel
```

Segui il wizard. Quando richiesto, imposta le variabili d'ambiente:
- `ANTHROPIC_API_KEY`
- `ADMIN_PASSWORD`

### Metodo 2 — Via dashboard Vercel

1. Vai su [vercel.com](https://vercel.com) e importa il repository GitHub
2. In **Settings → Environment Variables** aggiungi:
   - `ANTHROPIC_API_KEY` = la tua chiave Anthropic
   - `ADMIN_PASSWORD` = la tua password admin
3. Clicca **Deploy**

## Struttura del progetto

```
curabene/
├── app/
│   ├── layout.tsx              # Layout root con Google Fonts
│   ├── page.tsx                # Homepage
│   ├── admin/page.tsx          # Pannello admin
│   └── api/
│       ├── analyze/route.ts    # API Claude per analisi diagnosi
│       └── admin/route.ts      # API Claude per pannello admin
├── components/
│   ├── CuraBeneApp.tsx         # Shell principale con stato
│   ├── AdminApp.tsx            # Pannello admin
│   ├── ProgressBar.tsx
│   ├── HospitalCard.tsx
│   ├── DoctorCard.tsx
│   ├── DataDisclaimer.tsx
│   └── steps/
│       ├── Step1Diagnosi.tsx
│       ├── Step2Centri.tsx
│       ├── Step3Medico.tsx
│       ├── Step4Costi.tsx
│       └── Step5Azioni.tsx
├── data/
│   ├── ospedali.json           # Database ospedali (dati Ministero 2022)
│   └── specialita.json         # Le 8 specialità
└── lib/
    ├── types.ts                # TypeScript types
    └── utils.ts
```

## Fonti dei dati

| Dato | Fonte | Anno |
|---|---|---|
| Volume dimessi e degenza media | Ministero della Salute — Annuario SSN | 2022 |
| Mortalità 30gg | Stima su benchmark PNE 2024 (AGENAS) | 2024 |
| Dati ufficiali struttura per struttura | [pne.agenas.it](https://pne.agenas.it) | — |

> La mortalità riportata è una **stima** basata sui benchmark nazionali PNE, non il dato reale della struttura. Per i dati certificati visitare [pne.agenas.it](https://pne.agenas.it).

## Licenza

MIT
