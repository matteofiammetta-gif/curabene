import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AdminAuthRequest } from "@/lib/types";

interface AdminRequestBody extends AdminAuthRequest {
  messaggio: string;
  contestoAttuale: string;
}

interface AdminResponsePayload {
  tipo:
    | "aggiunta_ospedale"
    | "modifica_testo"
    | "aggiunta_specialita"
    | "modifica_ospedale"
    | "risposta_informativa";
  descrizione: string;
  dati: Record<string, unknown>;
  istruzioni: string;
}

const SYSTEM_PROMPT = `Sei l'assistente tecnico di CuraBene, un navigatore sanitario italiano.
Hai accesso al contesto attuale dell'app (dati ospedali, testi, configurazioni).
Quando l'utente chiede modifiche, rispondi con un oggetto JSON strutturato così:
{
  "tipo": "aggiunta_ospedale" | "modifica_testo" | "aggiunta_specialita" | "modifica_ospedale" | "risposta_informativa",
  "descrizione": "stringa con cosa hai fatto o risposto",
  "dati": {},
  "istruzioni": "istruzioni human-readable per applicare la modifica manualmente"
}
Rispondi SEMPRE e SOLO con JSON valido, nessun testo fuori dal JSON.`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: AdminRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errore: "Body non valido" }, { status: 400 });
  }

  const { messaggio, password, contestoAttuale } = body;

  // Verifica password — mai esposta nella risposta
  const adminPassword =
    process.env.ADMIN_PASSWORD ?? "curabene2024";

  if (!password || password !== adminPassword) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  if (!messaggio || typeof messaggio !== "string") {
    return NextResponse.json(
      { errore: "Campo messaggio mancante" },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { errore: "Chiave API non configurata sul server" },
      { status: 503 }
    );
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const userMessage = contestoAttuale
      ? `Contesto attuale app:\n${contestoAttuale}\n\nRichiesta: ${messaggio}`
      : messaggio;

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Nessuna risposta testuale da Claude");
    }

    // Estrai JSON pulito (rimuovi eventuali code fences)
    const raw = textBlock.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed: AdminResponsePayload = JSON.parse(raw);

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Errore interno del server";
    return NextResponse.json({ errore: msg }, { status: 500 });
  }
}
