import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { sintomo } = await req.json();
    if (!sintomo?.trim()) {
      return NextResponse.json(
        { errore: "Descrivi il tuo problema" },
        { status: 400 }
      );
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 350,
      system: `Sei un assistente pre-triage. Analizza il sintomo e rispondi SOLO con JSON valido, nessun testo fuori:
{
  "codice": "rosso"|"arancione"|"verde"|"bianco",
  "area_clinica": string,
  "descrizione": string (max 25 parole, cosa potrebbe essere),
  "cosa_fare_ora": string (max 20 parole, azione immediata),
  "chiamare_112": boolean,
  "urgenza_stimata": "immediata"|"entro_1h"|"entro_4h"|"non_urgente"
}
Se i sintomi includono: dolore toracico, difficoltà respiratorie gravi, perdita di coscienza, paralisi improvvisa, trauma cranico, dolore testa violento improvviso ("a rombo di tuono"), sanguinamento abbondante — imposta chiamare_112: true e codice: "rosso".
Non diagnosticare. Orienta solo. Rispondi sempre in italiano.`,
      messages: [{ role: "user", content: sintomo }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    return NextResponse.json(JSON.parse(clean));
  } catch {
    return NextResponse.json(
      { errore: "Servizio temporaneamente non disponibile" },
      { status: 500 }
    );
  }
}
