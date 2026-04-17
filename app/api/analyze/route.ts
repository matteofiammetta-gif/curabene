import { NextRequest, NextResponse } from "next/server";

// Fallback statico per ogni specialità — usato quando API non disponibile o timeout
const FALLBACK: Record<string, string> = {
  oncologia: `<p><strong>Cosa significa questa diagnosi</strong><br>L'oncologia si occupa della diagnosi e del trattamento dei tumori — crescite anomale di cellule che possono invadere i tessuti circostanti. Ogni tumore è diverso per tipo, sede e comportamento biologico, quindi il percorso di cura viene costruito su misura.</p><p><strong>Il percorso che ti aspetta</strong><br>Il primo passo è la <strong>visita oncologica</strong> con raccolta della storia clinica, seguita da esami diagnostici (TAC, PET, biopsia) per definire diagnosi e stadio. Il piano terapeutico viene discusso in un <strong>tumor board multidisciplinare</strong>. I tempi dalla prima visita al piano terapeutico variano da 2 a 4 settimane nei centri organizzati.</p><p><strong>Cosa sapere sulla scelta del centro</strong><br>Per i tumori solidi complessi i centri con più di 50 interventi/anno hanno mortalità operatoria significativamente inferiore. I centri <strong>IRCCS oncologici</strong> hanno accesso prioritario ai trial clinici e alle terapie innovative.</p><p><strong>Un passo alla volta</strong><br>Nei prossimi 7 giorni: chiedi al medico di base una richiesta per la prima visita oncologica e raccogli tutti gli esami già fatti. Non sei solo in questo percorso.</p>`,

  cardiologia: `<p><strong>Cosa significa questa diagnosi</strong><br>La cardiologia si occupa del cuore e dei vasi sanguigni. Le condizioni cardiologiche possono interessare il muscolo cardiaco, le valvole, le coronarie o il ritmo. Le terapie moderne permettono a molti pazienti di condurre una vita piena.</p><p><strong>Il percorso che ti aspetta</strong><br>Dopo la <strong>visita cardiologica</strong>, il medico richiederà ECG ed ecocardiogramma. Nei casi complessi si aggiungono test da sforzo, Holter o coronarografia. Il trattamento può essere farmacologico, interventistico (angioplastica) o chirurgico.</p><p><strong>Cosa sapere sulla scelta del centro</strong><br>Per bypass coronarico o chirurgia valvolare, i centri con più di 200 interventi/anno mostrano mortalità a 30 giorni significativamente inferiore. La presenza di un <strong>Heart Team</strong> è lo standard per i casi complessi.</p><p><strong>Un passo alla volta</strong><br>Nei prossimi 7 giorni: prenota la visita cardiologica portando l'ultimo ECG se disponibile. Annota pressione e farmaci che assumi. Un passo alla volta.</p>`,

  neurologia: `<p><strong>Cosa significa questa diagnosi</strong><br>La neurologia si occupa di cervello, midollo spinale e nervi. Le condizioni neurologiche sono molto diverse — dall'ictus alle malattie neurodegenerative — e ciascuna richiede un approccio specifico.</p><p><strong>Il percorso che ti aspetta</strong><br>La valutazione inizia con una <strong>visita neurologica</strong> approfondita, spesso seguita da risonanza magnetica (RMN) o EEG. Per le emergenze (ictus) le prime ore sono decisive; per condizioni croniche i tempi di diagnosi sono più distesi.</p><p><strong>Cosa sapere sulla scelta del centro</strong><br>I <strong>Comprehensive Stroke Center</strong> certificati hanno mortalità e disabilità significativamente inferiori. Per neurochirurgia (tumori cerebrali, aneurismi) il volume del chirurgo è un predittore indipendente di esito.</p><p><strong>Un passo alla volta</strong><br>Nei prossimi 7 giorni: prenota la visita neurologica specialistica e porta tutti gli esami già disponibili. Annota l'evoluzione dei sintomi. Sei nel posto giusto per capire cosa sta succedendo.</p>`,

  ortopedia: `<p><strong>Cosa significa questa diagnosi</strong><br>L'ortopedia si occupa di ossa, articolazioni, tendini e muscoli. I problemi ortopedici possono derivare da trauma, usura o condizioni congenite. La valutazione precisa permette di scegliere il percorso più adatto — spesso senza chirurgia.</p><p><strong>Il percorso che ti aspetta</strong><br>Dopo la <strong>visita ortopedica</strong>, si procede con imaging (radiografia, RMN) per definire l'entità del problema. Il percorso può essere conservativo — fisioterapia, infiltrazioni — o chirurgico. La <strong>fisioterapia precoce</strong> post-operatoria è fondamentale per il recupero.</p><p><strong>Cosa sapere sulla scelta del centro</strong><br>Per chirurgia protesica (anca, ginocchio), i centri con più di 150 impianti/anno mostrano tassi di infezione e revisione significativamente inferiori.</p><p><strong>Un passo alla volta</strong><br>Nei prossimi 7 giorni: prenota la visita ortopedica e porta le radiografie o RMN già disponibili. Annota da quanto hai i sintomi e quando peggiorano.</p>`,

  nefrologia: `<p><strong>Cosa significa questa diagnosi</strong><br>I reni filtrano il sangue e regolano l'equilibrio di liquidi e sali. Quando questa funzione si riduce si parla di insufficienza renale — acuta o cronica. La diagnosi precoce è fondamentale per rallentare la progressione.</p><p><strong>Il percorso che ti aspetta</strong><br>La valutazione prevede esami del sangue (creatinina, GFR) e delle urine, eventuale ecografia renale e, nei casi indicati, <strong>biopsia renale</strong>. Il trattamento mira a preservare la funzione residua; nelle fasi avanzate si pianifica dialisi o trapianto.</p><p><strong>Cosa sapere sulla scelta del centro</strong><br>Il <strong>trapianto renale</strong> è disponibile solo in circa 40 centri autorizzati in Italia. Per le nefropatie rare i centri specializzati hanno accesso a biologici non disponibili negli ospedali generali.</p><p><strong>Un passo alla volta</strong><br>Nei prossimi 7 giorni: porta al nefrologo gli ultimi esami del sangue e delle urine, l'elenco dei farmaci e l'eventuale storia di pressione alta o diabete.</p>`,

  gastroenterologia: `<p><strong>Cosa significa questa diagnosi</strong><br>La gastroenterologia si occupa dell'apparato digerente: esofago, stomaco, intestino, fegato e pancreas. Le condizioni gastroenterologiche sono diverse — dalle infiammazioni croniche alle malattie del fegato — ma oggi dispongono di terapie sempre più efficaci.</p><p><strong>Il percorso che ti aspetta</strong><br>La valutazione tipica include una <strong>visita gastroenterologica</strong> seguita da gastroscopia o colonscopia per la diagnosi diretta. Le <strong>malattie infiammatorie croniche</strong> (IBD) richiedono un percorso strutturato con centro di riferimento dedicato.</p><p><strong>Cosa sapere sulla scelta del centro</strong><br>Procedure come l'ERCP e l'ecoendoscopia sono disponibili solo in centri ad alto volume. Il <strong>trapianto di fegato</strong> è concentrato in soli 18 centri in Italia.</p><p><strong>Un passo alla volta</strong><br>Nei prossimi 7 giorni: prenota la visita gastroenterologica portando gli ultimi esami e descrivendo con precisione i sintomi — quando compaiono e la loro evoluzione.</p>`,

  pneumologia: `<p><strong>Cosa significa questa diagnosi</strong><br>La pneumologia si occupa di polmoni e vie aeree. Le patologie polmonari vanno dalla BPCO alla fibrosi polmonare, dall'asma grave alle infezioni. Molte si gestiscono bene con le terapie attuali.</p><p><strong>Il percorso che ti aspetta</strong><br>La valutazione comincia con la <strong>spirometria</strong> per misurare la funzione polmonare, spesso completata da TC torace. La <strong>riabilitazione respiratoria</strong> riduce le riospedalizzazioni del 30-40% nella BPCO grave.</p><p><strong>Cosa sapere sulla scelta del centro</strong><br>Il trapianto polmonare è concentrato in pochissimi centri italiani (principalmente Milano, Roma, Padova). Per la <strong>fibrosi polmonare idiopatica</strong>, i centri specializzati hanno accesso a farmaci non disponibili altrove.</p><p><strong>Un passo alla volta</strong><br>Nei prossimi 7 giorni: prenota la visita pneumologica portando eventuali spirometrie o TC già effettuate. Respirare meglio è un obiettivo concreto e raggiungibile.</p>`,

  endocrinologia: `<p><strong>Cosa significa questa diagnosi</strong><br>L'endocrinologia si occupa delle ghiandole e degli ormoni — tiroide, surreni, ipofisi, pancreas endocrino. Gli squilibri ormonali possono avere effetti su tutto l'organismo, ma nella grande maggioranza dei casi si gestiscono bene con la terapia appropriata.</p><p><strong>Il percorso che ti aspetta</strong><br>La valutazione inizia con esami del sangue mirati (ormoni tiroidei, cortisolo, glicemia) e spesso un'<strong>ecografia</strong> per visualizzare le ghiandole coinvolte. Il trattamento è solitamente farmacologico ma può richiedere la chirurgia.</p><p><strong>Cosa sapere sulla scelta del centro</strong><br>Per la <strong>chirurgia tiroidea</strong>, chirurghi con più di 50 interventi/anno hanno rischio significativamente inferiore di ledere il nervo ricorrente. I tumori neuroendocrini richiedono centri certificati <strong>ENETS</strong>.</p><p><strong>Un passo alla volta</strong><br>Nei prossimi 7 giorni: prenota la visita endocrinologica portando gli ultimi esami del sangue e un elenco dei farmaci che assumi. L'equilibrio ormonale si può ristabilire.</p>`,

  urologia: `<p><strong>Cosa significa questa diagnosi</strong><br>L'urologia si occupa delle vie urinarie e dell'apparato genitale maschile. Le condizioni urologiche spaziano dalle infezioni ricorrenti alle patologie oncologiche della prostata, rene e vescica — con percorsi terapeutici molto diversi.</p><p><strong>Il percorso che ti aspetta</strong><br>Dopo la <strong>visita urologica</strong>, il medico richiederà esami delle urine, ecografia e possibilmente PSA (per la prostata) o altri marker. Per le patologie oncologiche, la stadiazione determina il piano terapeutico — chirurgia, radioterapia o sorveglianza attiva.</p><p><strong>Cosa sapere sulla scelta del centro</strong><br>Per la chirurgia oncologica urologica (prostatectomia radicale, nefrectomia), i centri con chirurgia <strong>robotica</strong> e alto volume di casi garantiscono minori complicanze e tempi di recupero più rapidi.</p><p><strong>Un passo alla volta</strong><br>Nei prossimi 7 giorni: prenota la visita urologica portando gli ultimi esami delle urine e del sangue. Annota i sintomi e da quanto tempo li noti — le informazioni precise accelerano la diagnosi.</p>`,

  ginecologia: `<p><strong>Cosa significa questa diagnosi</strong><br>La ginecologia si occupa della salute dell'apparato riproduttivo femminile. Le condizioni ginecologiche comprendono patologie benigne (endometriosi, fibromi) e oncologiche (carcinoma dell'ovaio, dell'utero, della cervice) — ciascuna con percorsi dedicati.</p><p><strong>Il percorso che ti aspetta</strong><br>La valutazione inizia con la <strong>visita ginecologica</strong> e un'ecografia pelvica. Per le patologie oncologiche si aggiungono imaging avanzato (RMN, PET) e spesso laparoscopia diagnostica. Il percorso viene personalizzato in un team multidisciplinare.</p><p><strong>Cosa sapere sulla scelta del centro</strong><br>Per la chirurgia oncologica ginecologica complessa (carcinoma dell'ovaio avanzato), i centri ad alto volume con equipe dedicata hanno esiti significativamente migliori. La chirurgia <strong>mininvasiva</strong> (laparoscopica, robotica) è disponibile nei centri specializzati.</p><p><strong>Un passo alla volta</strong><br>Nei prossimi 7 giorni: prenota la visita ginecologica portando esami precedenti e descrivendo i sintomi con precisione. Non rimandare — la diagnosi precoce fa la differenza.</p>`,

  malattie_infettive: `<p><strong>Cosa significa questa diagnosi</strong><br>Le malattie infettive comprendono infezioni batteriche, virali, fungine e parassitarie. Alcune sono acute e si risolvono rapidamente; altre richiedono trattamenti prolungati o un follow-up specialistico continuativo.</p><p><strong>Il percorso che ti aspetta</strong><br>La valutazione specialistica include esami microbiologici (colture, sierologie, PCR) per identificare l'agente causale. La terapia antibiotica, antivirale o antimicotica viene calibrata sui risultati. Per le infezioni croniche (HIV, epatiti) il follow-up è strutturato e continuativo.</p><p><strong>Cosa sapere sulla scelta del centro</strong><br>I centri <strong>IRCCS</strong> dedicati alle malattie infettive hanno accesso alle terapie più innovative e ai protocolli di trattamento aggiornati. Per le infezioni rare o resistenti, il centro di riferimento regionale è fondamentale.</p><p><strong>Un passo alla volta</strong><br>Nei prossimi 7 giorni: prenota la visita specialistica portando la documentazione clinica disponibile. La diagnosi precisa è il primo passo verso la guarigione.</p>`,
};

const SYSTEM_PROMPT = `Sei un assistente medico empatico e competente che aiuta pazienti italiani a capire la propria diagnosi e il percorso di cura. Rispondi SEMPRE in italiano.

TONO: caldo, chiaro, rassicurante senza minimizzare, mai allarmistico. Usa linguaggio semplice ma preciso.

STRUTTURA OBBLIGATORIA — 4 blocchi HTML con tag <p>:
1. <p><strong>Cosa significa questa diagnosi</strong><br>[2-3 frasi, cosa è, quali organi coinvolge]</p>
2. <p><strong>Il percorso che ti aspetta</strong><br>[fasi tipiche, tempi medi realistici]</p>
3. <p><strong>Cosa sapere sulla scelta del centro</strong><br>[perché il volume conta per questa patologia specifica]</p>
4. <p><strong>Un passo alla volta</strong><br>[cosa fare nei prossimi 7 giorni]</p>

Lunghezza totale: 200-300 parole. NON dare mai consigli terapeutici specifici.`;

export async function POST(request: NextRequest) {
  try {
    const { diagnosi, specialitaId } = await request.json();

    const specId: string = specialitaId ?? "";

    // Nessuna chiave API — restituisce fallback immediatamente
    if (!process.env.ANTHROPIC_API_KEY) {
      const testo = FALLBACK[specId] ?? FALLBACK.oncologia;
      return NextResponse.json({ analisi: testo });
    }

    // Timeout 10 secondi
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 600,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Diagnosi del paziente: "${String(diagnosi).trim()}"\nArea clinica: ${specId || "medicina generale"}\n\nAnalizza questa diagnosi e rispondi seguendo esattamente la struttura indicata.`,
            },
          ],
        }),
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }

      const data = await response.json();
      const testo: string = data?.content?.[0]?.text ?? (FALLBACK[specId] ?? FALLBACK.oncologia);
      return NextResponse.json({ analisi: testo });

    } catch {
      clearTimeout(timeout);
      // Timeout o errore di rete — fallback silenzioso
      const testo = FALLBACK[specId] ?? FALLBACK.oncologia;
      return NextResponse.json({ analisi: testo });
    }

  } catch {
    // Errore parsing request — non crashare mai
    return NextResponse.json({
      analisi: "<p>Per una spiegazione personalizzata della tua diagnosi consulta il tuo medico di riferimento.</p>",
    });
  }
}
