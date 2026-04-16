import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AnalyzeRequest, AnalyzeResponse } from "@/lib/types";

// Fallback generico per specialità se la chiave API non è configurata
const FALLBACK: Record<string, string> = {
  oncologia: "<p>L'oncologia studia e cura i tumori. Il percorso tipico prevede una visita specialistica con <strong>biopsia</strong> e stadiazione, seguita da un piano terapeutico deciso da un <strong>team multidisciplinare</strong> (oncologo, chirurgo, radioterapista).</p><p>Le opzioni principali includono chirurgia, chemioterapia, radioterapia, immunoterapia e terapie target. Ogni caso è unico e il piano viene personalizzato in base al tipo, stadio e profilo molecolare del tumore.</p><p>Sei nel posto giusto per fare le domande giuste. Affidarsi a un centro specializzato fa una grande differenza.</p>",
  cardiologia: "<p>Le malattie cardiovascolari includono condizioni che riguardano il cuore e i vasi sanguigni. Una <strong>visita cardiologica completa</strong> con elettrocardiogramma ed ecocardiogramma permette di capire la situazione in modo preciso.</p><p>Il percorso tipico dipende dalla condizione: può includere terapia farmacologica, procedure interventistiche (come l'angioplastica) o, nei casi più complessi, la cardiochirurgia.</p><p>Con le terapie moderne, moltissimi pazienti cardiologici vivono una vita piena e attiva. Il cuore è in buone mani.</p>",
  neurologia: "<p>Le condizioni neurologiche riguardano il cervello, il midollo spinale e i nervi. La valutazione inizia con una <strong>visita neurologica</strong> approfondita, spesso accompagnata da esami come RMN encefalo, EEG o analisi del liquor.</p><p>Il percorso terapeutico dipende dalla diagnosi: può spaziare dalla terapia farmacologica alla riabilitazione, fino a procedure specialistiche come la stimolazione cerebrale profonda per il Parkinson.</p><p>La neurologia ha fatto progressi enormi negli ultimi anni. Molte condizioni oggi si gestiscono molto meglio che in passato.</p>",
  ortopedia: "<p>Le patologie ortopediche riguardano ossa, articolazioni, tendini e muscoli. La valutazione clinica con <strong>radiografia o RMN</strong> è il primo passo per capire l'entità del problema.</p><p>Il percorso può essere conservativo (fisioterapia, antidolorifici, ortesi) o chirurgico (artroscopia, protesi, fissazione di fratture). La decisione dipende dall'età, dall'attività fisica e dalla gravità della lesione.</p><p>L'ortopedia moderna permette recuperi sempre più rapidi. Molti pazienti tornano alla piena attività in tempi sorprendentemente brevi.</p>",
  nefrologia: "<p>La nefrologia si occupa delle malattie dei reni. Una <strong>valutazione nefrologica</strong> con esami delle urine, creatinina e GFR permette di capire lo stadio della malattia renale.</p><p>Il trattamento mira a rallentare la progressione della malattia, controllare la pressione e gestire le complicanze. Nei casi avanzati si pianifica la <strong>dialisi o il trapianto renale</strong>.</p><p>Con un buon controllo dei fattori di rischio, è possibile preservare la funzione renale a lungo. Non sei solo in questo percorso.</p>",
  gastroenterologia: "<p>La gastroenterologia si occupa dell'apparato digerente: esofago, stomaco, intestino, fegato e pancreas. L'<strong>endoscopia digestiva</strong> (gastroscopia o colonscopia) è spesso l'esame chiave per la diagnosi.</p><p>Il percorso terapeutico varia molto: può includere terapia farmacologica, modifiche della dieta, terapie endoscopiche o chirurgia. Le malattie infiammatorie croniche (Crohn, colite ulcerosa) oggi si gestiscono con biologici molto efficaci.</p><p>La gastroenterologia moderna offre strumenti diagnostici e terapeutici sempre più precisi e meno invasivi.</p>",
  pneumologia: "<p>La pneumologia si occupa delle malattie di polmoni e vie aeree. La <strong>spirometria</strong> è l'esame fondamentale per valutare la funzione polmonare, insieme alla TC torace nei casi più complessi.</p><p>Il trattamento dipende dalla condizione: per la BPCO si usano broncodilatatori inalatori, per l'asma grave esistono ora <strong>biologici molto efficaci</strong>, per la fibrosi polmonare ci sono farmaci antifibrotici specifici.</p><p>Respirare bene è possibile anche con malattie polmonari croniche. La riabilitazione respiratoria fa una grande differenza sulla qualità di vita.</p>",
  endocrinologia: "<p>L'endocrinologia si occupa delle ghiandole e degli ormoni: tiroide, pancreas, surreni, ipofisi. Una <strong>valutazione endocrinologica</strong> con esami del sangue e, se necessario, ecografia o altri esami di imaging permette di fare diagnosi precisa.</p><p>Il diabete, le malattie tiroidee e i disturbi ormonali si gestiscono molto bene con le terapie attuali. Il trattamento è spesso farmacologico ma può richiedere la chirurgia nei casi di noduli o tumori.</p><p>L'equilibrio ormonale si può ristabilire. Con la terapia giusta, la qualità di vita migliora notevolmente.</p>",
};

const SYSTEM_PROMPT = `Sei un assistente medico empatico per pazienti italiani. Rispondi SOLO in italiano. Tono caldo, chiaro, non allarmistico. Struttura in 3 paragrafi HTML usando tag <p>: (1) Cosa significa questa condizione in parole semplici, (2) Percorso medico tipico, (3) Frase di incoraggiamento. Max 180 parole. Non dare consigli medici specifici. Usa <strong> solo per termini chiave.`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: AnalyzeRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errore: "Body non valido" }, { status: 400 });
  }

  const { diagnosi, specialitaId } = body as AnalyzeRequest & { specialitaId?: string };

  if (!diagnosi || typeof diagnosi !== "string") {
    return NextResponse.json({ errore: "Campo diagnosi mancante" }, { status: 400 });
  }

  const specialitaNome = specialitaId ?? "medicina generale";

  // Fallback se la chiave API non è configurata
  if (!process.env.ANTHROPIC_API_KEY) {
    const fallbackText = FALLBACK[specialitaNome] ?? FALLBACK["oncologia"];
    const response: AnalyzeResponse = {
      analisi: {
        sommario: fallbackText,
        domandeDaPorre: [
          "Qual è la diagnosi precisa e lo stadio della mia condizione?",
          "Quali sono le opzioni terapeutiche disponibili per me?",
          "Quanto tempo richiede il percorso di cura?",
          "Ci sono trial clinici a cui potrei partecipare?",
        ],
        coseDaSapere: [
          "Chiedere sempre una seconda opinione è un tuo diritto",
          "Portare tutti gli esami precedenti alla visita",
          "Il Servizio Sanitario Nazionale copre la maggior parte dei percorsi diagnostici",
        ],
        livelloUrgenza: "media",
      },
    };
    return NextResponse.json(response);
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `La mia condizione è: ${diagnosi}. Area clinica: ${specialitaNome}. Spiegami in modo semplice.`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const sommario = textBlock?.type === "text" ? textBlock.text : "";

    const response: AnalyzeResponse = {
      analisi: {
        sommario,
        domandeDaPorre: [
          "Qual è la diagnosi precisa e lo stadio della mia condizione?",
          "Quali sono le opzioni terapeutiche disponibili per me?",
          "Quanto tempo richiede il percorso di cura?",
          "Ci sono trial clinici o terapie innovative a cui potrei accedere?",
          "Come si monitora l'efficacia del trattamento nel tempo?",
        ],
        coseDaSapere: [
          "Chiedere una seconda opinione è un tuo diritto e può essere prezioso",
          "Portare tutti gli esami precedenti alla prima visita",
          "Il SSN copre la maggior parte dei percorsi diagnostici e terapeutici",
          "I centri ad alto volume hanno spesso risultati migliori per condizioni complesse",
        ],
        livelloUrgenza: "media",
      },
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore interno del server";
    return NextResponse.json({ errore: message }, { status: 500 });
  }
}
