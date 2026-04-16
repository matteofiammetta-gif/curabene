import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `Sei un assistente medico empatico e competente che aiuta pazienti italiani a capire la propria diagnosi e il percorso di cura che li aspetta. Rispondi SEMPRE in italiano.

TONO: caldo, chiaro, rassicurante senza minimizzare, mai allarmistico. Usa un linguaggio semplice ma preciso. Evita termini tecnici senza spiegarli subito dopo tra parentesi.

STRUTTURA OBBLIGATORIA — rispondi sempre con questi 4 blocchi HTML:

<p><strong>Cosa significa questa diagnosi</strong><br>
[Spiega in 2-3 frasi cosa è questa condizione, quali organi coinvolge, perché si sviluppa. Usa analogie semplici se utile.]
</p>

<p><strong>Il percorso che ti aspetta</strong><br>
[Descrivi le fasi tipiche: visita specialistica → esami diagnostici → eventuale trattamento → follow-up. Indica i tempi medi realistici. Sii specifico per questa diagnosi e specialità.]
</p>

<p><strong>Cosa sapere sulla scelta del centro</strong><br>
[Spiega perché per questa patologia specifica è importante scegliere un centro con alto volume di casi. Cita 1-2 elementi concreti: es. per chirurgia oncologica complessa i centri che fanno >50 interventi/anno hanno mortalità significativamente inferiore.]
</p>

<p><strong>Un passo alla volta</strong><br>
[Frase di incoraggiamento concreta: cosa fare nei prossimi 7 giorni, chi chiamare per prima cosa, cosa portare alla prima visita.]
</p>

Lunghezza totale: 250-350 parole.
NON dare mai consigli terapeutici specifici.
NON dire mai "dovresti fare X terapia".
Puoi descrivere percorsi tipici senza prescrivere.`;

const CONTESTI_SPECIALITA: Record<string, string> = {
  oncologia: `CONTESTO SPECIALITÀ - ONCOLOGIA:
  - Le 8 aree cliniche valutate dal PNE includono la chirurgia oncologica
  - Per tumori solidi complessi (pancreas, retto, esofago) la relazione volume-esito è fortissima: centri <20 interventi/anno hanno mortalità 2-3x superiore ai centri ad alto volume
  - I centri IRCCS oncologici hanno accesso prioritario ai trial clinici
  - Il tumor board multidisciplinare (chirurgo + oncologo + radioterapista) è lo standard internazionale ma non ovunque presente`,

  cardiologia: `CONTESTO SPECIALITÀ - CARDIOLOGIA:
  - L'angioplastica coronarica entro 90 minuti dall'infarto è un indicatore PNE chiave — nel 2023 al 63% in Italia
  - Per la chirurgia valvolare e il bypass, i centri >200 interventi/anno hanno mortalità a 30gg significativamente inferiore
  - La presenza di un Heart Team (cardiologo + cardiochirurgo) è raccomandata per le decisioni su procedure complesse
  - La distanza dal centro può essere critica nelle emergenze cardiologiche acute`,

  neurologia: `CONTESTO SPECIALITÀ - NEUROLOGIA:
  - Per l'ictus ischemico le prime 4.5 ore sono decisive (finestra per trombolisi)
  - I Comprehensive Stroke Center hanno mortalità e disabilità significativamente inferiori ai centri non certificati
  - Per neurochirurgia (tumori cerebrali, aneurismi) il volume del chirurgo è predittore indipendente di esito
  - La neuronavigazione e la risonanza intraoperatoria sono disponibili solo nei centri ad alto volume`,

  ortopedia: `CONTESTO SPECIALITÀ - ORTOPEDIA:
  - Per protesi d'anca e ginocchio i centri >150 impianti/anno hanno tassi di revisione e infezione inferiori
  - La chirurgia robotica per protesi migliora l'allineamento ma richiede centri dedicati
  - Il PNE misura la frattura del femore operata entro 48h come indicatore di qualità organizzativa
  - La fisioterapia precoce (ERAS protocol) riduce la degenza e le complicanze`,

  nefrologia: `CONTESTO SPECIALITÀ - NEFROLOGIA:
  - Il trapianto renale è la terapia sostitutiva ottimale per l'IRC terminale (migliore qualità di vita vs dialisi)
  - I centri trapianto autorizzati in Italia sono circa 40 — non tutti gli ospedali possono farlo
  - Per le nefropatie rare (glomerulonefriti, vasculiti) i centri specializzati hanno accesso a biologici non disponibili nei centri generali
  - La dialisi peritoneale domiciliare è un'alternativa sottoutilizzata ma spesso preferibile`,

  gastroenterologia: `CONTESTO SPECIALITÀ - GASTROENTEROLOGIA:
  - Le IBD (Crohn, colite ulcerosa) richiedono biologici di ultima generazione disponibili solo in centri autorizzati
  - L'ERCP e l'ecoendoscopia (EUS) sono procedure avanzate disponibili solo in centri ad alto volume
  - Per il carcinoma epatocellulare (HCC) la TACE e l'ablazione richiedono team multidisciplinari dedicati
  - Il trapianto di fegato è concentrato in ~18 centri italiani`,

  pneumologia: `CONTESTO SPECIALITÀ - PNEUMOLOGIA:
  - La BPCO grave e la fibrosi polmonare idiopatica richiedono farmaci biologici (nintedanib, pirfenidone) e monitoraggio specialistico continuativo
  - I centri per la ventilazione meccanica domiciliare sono limitati — fondamentale la vicinanza geografica per i controlli
  - Il trapianto polmonare è concentrato in pochissimi centri (Milano, Roma, Padova principalmente)
  - La riabilitazione respiratoria intensiva riduce le riospedalizzazioni del 30-40% nella BPCO grave`,

  endocrinologia: `CONTESTO SPECIALITÀ - ENDOCRINOLOGIA:
  - Il diabete tipo 1 con complicanze richiede centri con microinfusori e sensori CGM avanzati
  - I tumori neuroendocrini (NET) hanno percorsi diagnostici complessi — i centri di riferimento ENETS sono certificati
  - La chirurgia tiroidea e paratiroidea richiede chirurghi con >50 interventi/anno per ridurre il rischio di lesione del nervo ricorrente
  - Le sindromi MEN richiedono follow-up multidisciplinare a lungo termine`,
};

// Fallback HTML (4-block structure) for when the API key is not configured
const FALLBACK_HTML: Record<string, string> = {
  oncologia: `<p><strong>Cosa significa questa diagnosi</strong><br>
L'oncologia si occupa della diagnosi e del trattamento dei tumori, che sono crescite anomale di cellule in grado di invadere i tessuti circostanti. Ogni tumore è diverso per tipo, sede e comportamento biologico, quindi il percorso di cura viene costruito su misura per te.
</p>
<p><strong>Il percorso che ti aspetta</strong><br>
Il primo passo è la <strong>visita oncologica</strong> con raccolta della storia clinica. Seguiranno esami diagnostici (TAC, PET, biopsia o esame istologico) per definire la diagnosi precisa e lo stadio. Il piano terapeutico viene poi discusso in un <strong>tumor board multidisciplinare</strong> — un team che include oncologo, chirurgo e radioterapista. I tempi dalla prima visita al piano terapeutico variano da 2 a 4 settimane nei centri organizzati.
</p>
<p><strong>Cosa sapere sulla scelta del centro</strong><br>
Per i tumori solidi complessi (pancreas, retto, esofago) scegliere un centro ad alto volume è fondamentale: i centri con più di 50 interventi/anno hanno mortalità operatoria significativamente inferiore rispetto a quelli con pochi casi. I centri <strong>IRCCS oncologici</strong> hanno inoltre accesso prioritario ai trial clinici e alle terapie innovative.
</p>
<p><strong>Un passo alla volta</strong><br>
Nei prossimi 7 giorni: chiedi al tuo medico di base una richiesta urgente per la prima visita oncologica, raccogli tutti gli esami già fatti (referti, biopsie, imaging) e preparati a descrivere i sintomi e la loro evoluzione. Non sei solo in questo — ogni passo conta.
</p>`,

  cardiologia: `<p><strong>Cosa significa questa diagnosi</strong><br>
La cardiologia si occupa del cuore e dei vasi sanguigni. Le condizioni cardiologiche possono interessare il muscolo cardiaco, le valvole, le coronarie o il ritmo cardiaco. La buona notizia è che le terapie moderne permettono a molti pazienti di condurre una vita piena e attiva.
</p>
<p><strong>Il percorso che ti aspetta</strong><br>
Dopo la <strong>visita cardiologica</strong>, il medico richiederà un elettrocardiogramma (ECG) ed un ecocardiogramma. Nei casi più complessi si aggiungono test da sforzo, Holter cardiaco o coronarografia. Il trattamento può essere farmacologico, interventistico (angioplastica, TAVI) o chirurgico. I tempi dipendono dall'urgenza clinica.
</p>
<p><strong>Cosa sapere sulla scelta del centro</strong><br>
Per procedure come il bypass coronarico o la chirurgia valvolare, i centri con più di 200 interventi/anno mostrano mortalità a 30 giorni significativamente inferiore. La presenza di un <strong>Heart Team</strong> — cardiologo e cardiochirurgo che decidono insieme — è lo standard internazionale per i casi complessi.
</p>
<p><strong>Un passo alla volta</strong><br>
Nei prossimi 7 giorni: contatta il CUP per la prima visita cardiologica (porta con te l'ultimo ECG se ce l'hai), segna i tuoi valori di pressione e prepara un elenco dei farmaci che assumi. Un passo alla volta: il cuore si prende cura di te se tu ti prendi cura di lui.
</p>`,

  neurologia: `<p><strong>Cosa significa questa diagnosi</strong><br>
La neurologia si occupa di cervello, midollo spinale e nervi. Le condizioni neurologiche possono essere molto diverse tra loro — dall'ictus alle malattie neurodegenerative, dall'epilessia alla sclerosi multipla — e ciascuna richiede un approccio specifico.
</p>
<p><strong>Il percorso che ti aspetta</strong><br>
La valutazione inizia con una <strong>visita neurologica</strong> approfondita, spesso seguita da risonanza magnetica (RMN) encefalo o spinale, EEG, o analisi del liquido cerebrospinale nei casi indicati. La tempistica è variabile: per le emergenze (ictus) le prime ore sono decisive, per condizioni croniche i tempi di diagnosi sono più distesi.
</p>
<p><strong>Cosa sapere sulla scelta del centro</strong><br>
Per la neurochirurgia (tumori cerebrali, aneurismi), il volume del chirurgo è un predittore indipendente di esito. I <strong>Comprehensive Stroke Center</strong> certificati hanno mortalità e disabilità significativamente inferiori ai centri non certificati. La neuronavigazione e la risonanza intraoperatoria sono disponibili solo nelle strutture ad alto volume.
</p>
<p><strong>Un passo alla volta</strong><br>
Nei prossimi 7 giorni: chiedi la prenotazione per una visita neurologica specialistica e porta con te tutti gli esami già effettuati (imaging, esami del sangue recenti). Annota l'evoluzione dei sintomi nel tempo — quando sono comparsi, se peggiorano o migliorano. Sei nel posto giusto per capire cosa sta succedendo.
</p>`,

  ortopedia: `<p><strong>Cosa significa questa diagnosi</strong><br>
L'ortopedia si occupa di ossa, articolazioni, tendini e muscoli. I problemi ortopedici possono derivare da trauma, usura nel tempo (artrosi) o condizioni congenite. La valutazione precisa permette di scegliere il percorso più adatto — spesso senza necessità di chirurgia.
</p>
<p><strong>Il percorso che ti aspetta</strong><br>
Dopo la <strong>visita ortopedica</strong> con esame obiettivo, si procede con imaging (radiografia, RMN o TAC) per definire l'entità del problema. Il percorso può essere conservativo — fisioterapia, antidolorifici, infiltrazioni — o chirurgico (artroscopia, protesi, osteosintesi). Il programma di <strong>fisioterapia precoce</strong> post-operatoria è fondamentale per il recupero.
</p>
<p><strong>Cosa sapere sulla scelta del centro</strong><br>
Per la chirurgia protesica (anca e ginocchio), i centri con più di 150 impianti/anno mostrano tassi di infezione e revisione significativamente inferiori. La disponibilità di <strong>chirurgia robotica</strong> per le protesi migliora la precisione dell'allineamento ma richiede centri specializzati con casistica elevata.
</p>
<p><strong>Un passo alla volta</strong><br>
Nei prossimi 7 giorni: prenota la visita ortopedica e porta con te le radiografie o la RMN già disponibili. Annota da quanto tempo hai i sintomi, quando peggiorano (sforzo, riposo, freddo) e quali attività ti risultano difficili. Con le informazioni giuste, il medico potrà darti un piano chiaro.
</p>`,

  nefrologia: `<p><strong>Cosa significa questa diagnosi</strong><br>
I reni filtrano il sangue e regolano l'equilibrio di liquidi e sali nell'organismo. Quando questa funzione si riduce, si parla di insufficienza renale — che può essere acuta (improvvisa) o cronica (progressiva nel tempo). La diagnosi precoce è fondamentale per rallentare la progressione.
</p>
<p><strong>Il percorso che ti aspetta</strong><br>
La valutazione nefrologica prevede esami del sangue (creatinina, GFR, elettroliti) e delle urine (proteinuria, sedimento), eventuale ecografia renale e, nei casi indicati, <strong>biopsia renale</strong> per le nefropatie rare. Il trattamento mira a preservare la funzione renale residua; nelle fasi avanzate si pianifica dialisi o trapianto.
</p>
<p><strong>Cosa sapere sulla scelta del centro</strong><br>
Il <strong>trapianto renale</strong> — la terapia migliore per l'insufficienza renale terminale — è disponibile solo in circa 40 centri autorizzati in Italia. Per le nefropatie rare (glomerulonefriti, vasculiti ANCA) i centri specializzati hanno accesso a biologici e protocolli non disponibili negli ospedali generali.
</p>
<p><strong>Un passo alla volta</strong><br>
Nei prossimi 7 giorni: porta al nefrologo gli ultimi esami del sangue e delle urine, l'elenco dei farmaci che assumi e l'eventuale storia di pressione alta o diabete. Con un follow-up regolare e un buon controllo dei fattori di rischio, è possibile preservare la funzione renale a lungo.
</p>`,

  gastroenterologia: `<p><strong>Cosa significa questa diagnosi</strong><br>
La gastroenterologia si occupa dell'intero apparato digerente: esofago, stomaco, intestino, fegato e pancreas. Le condizioni gastroenterologiche sono molto diverse — dalle infiammazioni croniche come il Crohn alle malattie del fegato — ma oggi dispongono di terapie sempre più efficaci.
</p>
<p><strong>Il percorso che ti aspetta</strong><br>
La valutazione tipica include una <strong>visita gastroenterologica</strong> seguita da gastroscopia o colonscopia per la diagnosi diretta. Per le malattie del fegato si aggiungono ecografia addominale ed esami del sangue specifici. Le <strong>malattie infiammatorie croniche</strong> (IBD) richiedono un percorso strutturato con centro di riferimento dedicato.
</p>
<p><strong>Cosa sapere sulla scelta del centro</strong><br>
Procedure come l'ERCP (per le vie biliari) e l'ecoendoscopia (EUS) sono disponibili solo in centri ad alto volume — scegliere il centro giusto riduce il rischio di complicanze. Il <strong>trapianto di fegato</strong> è concentrato in soli 18 centri in Italia, quindi la selezione precoce del centro è essenziale nei casi avanzati.
</p>
<p><strong>Un passo alla volta</strong><br>
Nei prossimi 7 giorni: prenota la visita gastroenterologica portando gli ultimi esami del sangue (inclusi funzionalità epatica se disponibile) e descrivendo con precisione i sintomi — quando compaiono, dopo i pasti o a digiuno, e la loro evoluzione nel tempo. Stai già facendo la cosa giusta chiedendo aiuto.
</p>`,

  pneumologia: `<p><strong>Cosa significa questa diagnosi</strong><br>
La pneumologia si occupa di polmoni e vie aeree. Le patologie polmonari vanno dalla BPCO (broncopneumopatia cronica ostruttiva, legata spesso al fumo) alla fibrosi polmonare, dall'asma grave alle infezioni. Ognuna ha caratteristiche diverse ma molte si gestiscono bene con le terapie attuali.
</p>
<p><strong>Il percorso che ti aspetta</strong><br>
La valutazione comincia con la <strong>spirometria</strong> per misurare la funzione polmonare, spesso completata da TC torace e test del cammino. Il trattamento può includere terapia inalatoria, farmaci antifibrotici per la fibrosi polmonare, o biologici per l'asma grave. La <strong>riabilitazione respiratoria</strong> riduce le riospedalizzazioni del 30-40% nella BPCO grave.
</p>
<p><strong>Cosa sapere sulla scelta del centro</strong><br>
Il trapianto polmonare è concentrato in pochissimi centri italiani (principalmente Milano, Roma, Padova) — se la tua condizione è grave, è utile contattarli precocemente. Per la <strong>fibrosi polmonare idiopatica</strong> e le pneumopatie interstiziali rare, i centri specializzati hanno accesso a farmaci e protocolli non disponibili altrove.
</p>
<p><strong>Un passo alla volta</strong><br>
Nei prossimi 7 giorni: prenota la visita pneumologica e porta con te eventuali spirometrie o TC del torace già fatte. Se sei fumatore o ex fumatore, indica con precisione quanti anni e quanti pacchetti al giorno. Respirare meglio è un obiettivo concreto e raggiungibile.
</p>`,

  endocrinologia: `<p><strong>Cosa significa questa diagnosi</strong><br>
L'endocrinologia si occupa delle ghiandole e degli ormoni — tiroide, surreni, ipofisi, pancreas endocrino. Gli squilibri ormonali possono avere effetti su tutto l'organismo, ma nella grande maggioranza dei casi si gestiscono bene con la terapia appropriata.
</p>
<p><strong>Il percorso che ti aspetta</strong><br>
La valutazione inizia con esami del sangue mirati (ormoni tiroidei, cortisolo, glicemia, insulina) e spesso un'<strong>ecografia</strong> o altri esami di imaging per visualizzare le ghiandole coinvolte. Per i tumori neuroendocrini (NET) si usano scintigrafia con Ga-68 o octreotide. Il trattamento è solitamente farmacologico ma può richiedere la chirurgia.
</p>
<p><strong>Cosa sapere sulla scelta del centro</strong><br>
Per la <strong>chirurgia tiroidea e paratiroidea</strong>, chirurghi con più di 50 interventi/anno hanno un rischio significativamente inferiore di ledere il nervo ricorrente (che controlla la voce). I tumori neuroendocrini (NET) richiedono centri certificati <strong>ENETS</strong> (European Neuroendocrine Tumor Society) per un percorso diagnostico-terapeutico completo.
</p>
<p><strong>Un passo alla volta</strong><br>
Nei prossimi 7 giorni: prenota la visita endocrinologica portando gli ultimi esami del sangue (inclusi TSH, glicemia, calcio se disponibili) e un elenco dei farmaci che assumi. Annota i sintomi e da quanto tempo li noti — queste informazioni sono preziose per il medico. L'equilibrio ormonale si può ristabilire.
</p>`,
};

export async function POST(request: NextRequest) {
  let diagnosi: string;
  let specialitaId: string;

  try {
    const body = await request.json();
    diagnosi = body.diagnosi;
    specialitaId = body.specialitaId ?? "";
  } catch {
    return new Response(JSON.stringify({ errore: "Body non valido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!diagnosi || typeof diagnosi !== "string") {
    return new Response(JSON.stringify({ errore: "Campo diagnosi mancante" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fallback quando la chiave API non è configurata
  if (!process.env.ANTHROPIC_API_KEY) {
    const html = FALLBACK_HTML[specialitaId] ?? FALLBACK_HTML["oncologia"];
    return new Response(html, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const contestoSpec = CONTESTI_SPECIALITA[specialitaId] ?? "";

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${contestoSpec}\n\nLa diagnosi del paziente è: "${diagnosi}"\nArea clinica selezionata: ${specialitaId || "medicina generale"}\n\nAnalizza questa diagnosi e rispondi seguendo esattamente la struttura indicata nel system prompt.`,
        },
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } catch {
          // stream error — close gracefully, client handles empty/partial response
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore interno del server";
    return new Response(JSON.stringify({ errore: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
