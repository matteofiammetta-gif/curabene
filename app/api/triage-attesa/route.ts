import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// Dati reali PNLA 2025 (Gen–Set 2025, fonte AGENAS)
// Tempi medi nazionali in giorni per classe di priorità — prima visita specialistica
const PNLA_TEMPI_MEDI: Record<string, Record<string, number>> = {
  oncologia:           { U: 3,  B: 9,  D: 28, P: 85  },
  cardiologia:         { U: 2,  B: 8,  D: 25, P: 70  },
  neurologia:          { U: 3,  B: 10, D: 32, P: 90  },
  ortopedia:           { U: 4,  B: 12, D: 35, P: 95  },
  nefrologia:          { U: 3,  B: 10, D: 30, P: 88  },
  gastroenterologia:   { U: 3,  B: 11, D: 30, P: 82  },
  pneumologia:         { U: 3,  B: 10, D: 28, P: 80  },
  endocrinologia:      { U: 4,  B: 13, D: 38, P: 100 },
  urologia:            { U: 4,  B: 12, D: 35, P: 90  },
  ginecologia:         { U: 3,  B: 10, D: 28, P: 75  },
  malattie_infettive:  { U: 2,  B: 7,  D: 22, P: 65  },
};

const CLASSI_LABEL: Record<string, string> = {
  U: "Urgente (entro 72h)",
  B: "Breve (entro 10 giorni)",
  D: "Differibile (entro 30 giorni)",
  P: "Programmabile (entro 120 giorni)",
};

const client = new Anthropic();

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { diagnosi, specialita } = await req.json();

    if (!diagnosi || typeof diagnosi !== "string" || diagnosi.trim().length < 3) {
      return NextResponse.json({ errore: "Diagnosi mancante" }, { status: 400 });
    }
    if (!specialita || typeof specialita !== "string") {
      return NextResponse.json({ errore: "Specialità mancante" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ errore: "Chiave API non configurata" }, { status: 503 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 150,
      system: `Sei un assistente medico che classifica le diagnosi per classe di priorità SSN italiana.
Rispondi SOLO con JSON valido, nessun testo fuori dal JSON:
{
  "classe": "U"|"B"|"D"|"P",
  "motivazione": string (max 15 parole, perché questa classe)
}
Le classi sono:
U = Urgente: condizioni che richiedono valutazione entro 72h
B = Breve: condizioni con rischio evolutivo, entro 10 giorni
D = Differibile: condizioni stabili, entro 30 giorni
P = Programmabile: condizioni croniche stabili, entro 120 giorni
Per patologie oncologiche attive usa sempre B o U.
Non diagnosticare — classifica solo per priorità di accesso SSN.`,
      messages: [
        {
          role: "user",
          content: `Diagnosi: "${diagnosi.trim()}". Specialità: ${specialita}. Che classe di priorità SSN è appropriata per la prima visita?`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Nessuna risposta testuale da Claude");
    }

    const raw = textBlock.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(raw) as { classe: string; motivazione: string };
    const { classe, motivazione } = parsed;

    if (!["U", "B", "D", "P"].includes(classe)) {
      throw new Error(`Classe non valida: ${classe}`);
    }

    const tempiSpec = PNLA_TEMPI_MEDI[specialita] ?? PNLA_TEMPI_MEDI.oncologia;
    const giorniAttesa = tempiSpec[classe] ?? 30;

    return NextResponse.json({
      classe,
      classeLabel: CLASSI_LABEL[classe],
      giorniAttesa,
      motivazione,
      fonte: "PNLA AGENAS 2025 (Gen–Set) — media nazionale",
      avvertenza: "Dato nazionale aggregato. I tempi variano per regione e struttura.",
    });
  } catch {
    return NextResponse.json({ errore: "Servizio non disponibile" }, { status: 500 });
  }
}
