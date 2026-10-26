/*
 * Livelli del gioco: ogni livello raggruppa corsi ITS Academy Adriano Olivetti
 * con argomenti in comune. Le domande dei minigiochi riguardano le COMPETENZE
 * TRASVERSALI che uniscono quei corsi (lavoro in team, comunicazione, problem
 * solving, project management...); dopo il minigioco vengono mostrati la
 * spiegazione e la sede di ogni corso.
 *
 * Le competenze sono quelle citate più spesso nelle pagine dei corsi (sezione
 * "Profilo e sbocchi professionali"). Valgono per tutti i 21 corsi: inglese
 * richiesto all'ingresso e 2000 ore di cui il 40% (800 ore) di stage in azienda.
 *
 * Fonte: https://itsolivetti.it/corso/ e le singole pagine dei corsi (biennio
 * 2026-28, controllato il 30/09/2026). Sono i 21 corsi con pre-iscrizioni aperte
 * (3D Art Specialist è escluso perché ha le iscrizioni chiuse). 21 non si divide
 * per 4, quindi l'ultimo livello ha 5 corsi.
 * L'offerta cambia ogni anno: prima di un nuovo open day ricontrollate il sito
 * e aggiornate questo file.
 *
 * Struttura di ogni livello:
 *   titolo     nome del livello
 *   icona, breve  nome dell'icona (vedi js/icons.js) e nome corto mostrati sulla mappa
 *   tema       frase che presenta i corsi del livello
 *   gioco      tipo di minigioco, con i dati che servono a quel tipo:
 *                "quiz"       domandePerPartita, quiz[] { domanda, opzioni[], corretta (indice) }
 *                             (ogni partita pesca a caso domandePerPartita domande
 *                             dall'elenco; anche le opzioni vengono mescolate)
 *                "memory"     coppie[]  { termine, definizione }
 *                "acchiappa"  istruzioni, parole { giuste[], intruse[] }
 *                "impiccato"  parole[]  { parola (solo A-Z), indizio }
 *   corsi[]    { nome, descrizione, sedi[], url }
 *
 * Per cambiare il minigioco di un livello basta cambiare "gioco" e fornire i
 * dati del nuovo tipo. Ogni elemento (domanda, coppia, parola giusta, parola
 * da indovinare) vale al massimo 200 punti (100 + bonus velocità, vedi scoring.js).
 */

const ITS_LEVELS = [
  {
    id: "sicurezza-reti",
    titolo: "Sicurezza informatica e reti",
    icona: "shield",
    breve: "Sicurezza",
    tema: "Corsi per chi vuole proteggere sistemi, reti e dati dagli attacchi informatici.",
    gioco: "quiz",
    domandePerPartita: 5,
    quiz: [
      {
        domanda: "Manca un giorno alla consegna di un lavoro di gruppo e scoprite che una parte è sbagliata. Qual è la mossa migliore?",
        opzioni: [
          "Avvisare subito il gruppo e decidere insieme cosa sistemare per primo",
          "Consegnare così e sperare che nessuno se ne accorga",
          "Rifare tutto da soli durante la notte",
          "Chiedere più tempo senza spiegare il motivo",
        ],
        corretta: 0,
      },
      {
        domanda: "Ogni volta che il tuo gruppo presenta un lavoro, finite in ritardo. Cosa farebbe un buon problem solver?",
        opzioni: [
          "Parlare più velocemente durante la presentazione",
          "Capire in quale parte si perde tempo e correggere quella",
          "Tagliare l'ultima parte ogni volta",
          "Chiedere sempre qualche minuto in più",
        ],
        corretta: 1,
      },
      {
        domanda: "Hai fatto un errore che ha creato un problema al tuo team. Qual è il comportamento più professionale?",
        opzioni: [
          "Aspettare di vedere se qualcuno se ne accorge",
          "Spiegare che la colpa è anche degli altri",
          "Sistemarlo di nascosto senza dirlo a nessuno",
          "Ammetterlo subito e proporre una soluzione",
        ],
        corretta: 3,
      },
      {
        domanda: "Leggi online una notizia sorprendente che riguarda il tuo lavoro. Cosa fai prima di condividerla con i colleghi?",
        opzioni: [
          "La condivido subito: se è online sarà vera",
          "Guardo quante condivisioni ha avuto",
          "Controllo da dove arriva e cerco conferme in altre fonti",
          "Chiedo a un amico se gli sembra vera",
        ],
        corretta: 2,
      },
      {
        domanda: "Devi spiegare un'idea complicata a una persona che non conosce l'argomento. Come fai?",
        opzioni: [
          "Uso parole semplici ed esempi concreti, poi chiedo se è tutto chiaro",
          "Uso i termini tecnici, così sembro più preparato",
          "Parlo velocemente per non annoiarla",
          "Le mando un documento lungo da leggere con calma",
        ],
        corretta: 0,
      },
      {
        domanda: "Ricevi un messaggio da un numero sconosciuto: dice di essere la tua banca e ti chiede un codice urgente. Cosa fai?",
        opzioni: [
          "Non rispondo e contatto la banca dai canali ufficiali",
          "Mando il codice, visto che è urgente",
          "Rispondo chiedendo chi è",
          "Lo inoltro agli amici per sapere cosa ne pensano",
        ],
        corretta: 0,
      },
      {
        domanda: "Un collega appena arrivato è in difficoltà con un compito che tu conosci bene. Cosa fai?",
        opzioni: [
          "Lascio che se la cavi da solo: si impara sbagliando",
          "Faccio io il compito al posto suo",
          "Gli offro una mano e gli spiego come lo affronto io",
          "Avviso il responsabile che è in difficoltà",
        ],
        corretta: 2,
      },
      {
        domanda: "Durante una riunione non hai capito un punto importante. Cosa conviene fare?",
        opzioni: [
          "Far finta di aver capito per non fare brutta figura",
          "Chiedere subito un chiarimento con una domanda precisa",
          "Aspettare la fine e indovinare cosa intendevano",
          "Chiedere a qualcuno di mandarti tutto per scritto, senza dire perché",
        ],
        corretta: 1,
      },
      {
        domanda: "Il tuo gruppo deve scegliere tra due idee e il tempo stringe. Qual è il modo migliore per decidere?",
        opzioni: [
          "Scegliere quella proposta da chi parla più forte",
          "Tirare a sorte per fare prima",
          "Rimandare la decisione alla prossima volta",
          "Confrontare in breve pro e contro di entrambe e scegliere quella più utile all'obiettivo",
        ],
        corretta: 3,
      },
      {
        domanda: "Ti accorgi che in ufficio tutti ignorano una regola di sicurezza. Cosa fai?",
        opzioni: [
          "La ignoro anche io: se lo fanno tutti va bene",
          "Lo segnalo a chi se ne occupa, spiegando il rischio",
          "Rimprovero i colleghi davanti a tutti",
          "Aspetto che succeda qualcosa prima di dirlo",
        ],
        corretta: 1,
      },
    ],
    corsi: [
      {
        nome: "AI Cybersecurity Specialist",
        descrizione:
          "Protegge informazioni e sistemi informatici: cerca le vulnerabilità, gestisce le regole di sicurezza e difende anche impianti industriali e dispositivi IoT, con strumenti di analisi forense e intelligenza artificiale.",
        sedi: ["Imola"],
        url: "https://itsolivetti.it/corso/its-system-cybersecurity-specialist/",
      },
      {
        nome: "Cybersecurity Specialist & Forensic Analyst",
        descrizione:
          "Specialista della sicurezza informatica con focus sull'analisi forense: indaga sugli attacchi, raccoglie prove digitali e aiuta le aziende a difendersi e a migliorare le proprie politiche di sicurezza.",
        sedi: ["Bologna"],
        url: "https://itsolivetti.it/corso/cybersecurity-specialist-forensic-analyst/",
      },
      {
        nome: "AI Sec DevOps",
        descrizione:
          "Mette in sicurezza infrastrutture complesse e grandi database con dati sensibili (banche, sanità): trova i punti deboli, sviluppa nuove protezioni e unisce networking, cybersecurity e automazione.",
        sedi: ["Reggio Emilia – IFOA"],
        url: "https://itsolivetti.it/corso/sec-devops/",
      },
      {
        nome: "Network AI Specialist",
        descrizione:
          "Installa, configura e mantiene reti, sistemi e data center, usando l'intelligenza artificiale per monitorare i sistemi, prevenire i guasti e automatizzare le procedure.",
        sedi: ["Forlì"],
        url: "https://itsolivetti.it/corso/network-system-administrator/",
      },
    ],
  },
  {
    id: "sviluppo-software",
    titolo: "Sviluppo software e cloud",
    icona: "code",
    breve: "Software",
    tema: "Corsi per chi vuole programmare app, siti, videogiochi e servizi cloud.",
    gioco: "quiz",
    domandePerPartita: 5,
    quiz: [
      {
        domanda: "Un cliente ti chiede un lavoro \"moderno e semplice\". Cosa fai prima di iniziare?",
        opzioni: [
          "Faccio come piace a me: l'esperto sono io",
          "Gli faccio domande e gli mostro esempi per capire cosa intende",
          "Preparo subito tre proposte diverse e vedo quale sceglie",
          "Copio il lavoro più famoso del momento",
        ],
        corretta: 1,
      },
      {
        domanda: "Nel tuo team due compagni litigano su come svolgere un compito. Cosa conviene fare?",
        opzioni: [
          "Dare ragione a chi ha più esperienza, senza discutere",
          "Far votare subito il gruppo per chiudere la questione",
          "Lasciarli discutere finché uno dei due cede",
          "Ascoltare entrambe le idee e cercare insieme la soluzione migliore per il progetto",
        ],
        corretta: 3,
      },
      {
        domanda: "Hai tre compiti da consegnare e poco tempo. Da dove conviene partire?",
        opzioni: [
          "Da quello più facile, per toglierselo di mezzo",
          "Da quello che piace di più",
          "Dal più urgente e importante, dopo aver stimato quanto tempo serve per ognuno",
          "Da tutti e tre insieme, un po' alla volta",
        ],
        corretta: 2,
      },
      {
        domanda: "Il tuo responsabile critica un lavoro in cui ti sei impegnato molto. Qual è la reazione più utile?",
        opzioni: [
          "Chiedere cosa migliorare e usare i suoi consigli nel prossimo lavoro",
          "Difendere il lavoro punto per punto",
          "Rifarlo uguale, ma più in fretta",
          "Impegnarsi meno la prossima volta, tanto non basta",
        ],
        corretta: 0,
      },
      {
        domanda: "Per lavoro devi usare uno strumento nuovo che non hai mai visto. Cosa fai?",
        opzioni: [
          "Aspetto che qualcuno lo usi al posto mio",
          "Continuo a lavorare con il vecchio metodo",
          "Cerco guide e tutorial e faccio prove finché non lo so usare",
          "Dico che non fa parte del mio lavoro",
        ],
        corretta: 2,
      },
      {
        domanda: "Un progetto è così grande che non sai da dove cominciare. Cosa fai?",
        opzioni: [
          "Lo divido in parti più piccole e le affronto una alla volta",
          "Aspetto di avere l'ispirazione giusta",
          "Comincio dalla parte più divertente",
          "Chiedo di cambiarmi progetto",
        ],
        corretta: 0,
      },
      {
        domanda: "Hai finito il tuo compito prima degli altri del gruppo. Cosa fai?",
        opzioni: [
          "Me ne vado: la mia parte l'ho fatta",
          "Ricomincio da capo il mio compito per perfezionarlo",
          "Chiedo se qualcuno ha bisogno di aiuto",
          "Controllo il telefono finché gli altri finiscono",
        ],
        corretta: 2,
      },
      {
        domanda: "Un compagno propone un'idea molto diversa dalla tua. Come reagisci?",
        opzioni: [
          "Spiego subito perché la mia è migliore",
          "La ascolto con attenzione: magari si possono unire le parti migliori",
          "La accetto senza discutere per evitare problemi",
          "Cambio argomento",
        ],
        corretta: 1,
      },
      {
        domanda: "Il cliente cambia idea a metà del lavoro. Qual è la reazione più professionale?",
        opzioni: [
          "Continuare come deciso all'inizio",
          "Ricominciare da zero senza dire nulla",
          "Lamentarsi con i colleghi",
          "Capire cosa è cambiato e concordare insieme nuovi tempi e priorità",
        ],
        corretta: 3,
      },
      {
        domanda: "Stai lavorando da ore su un problema senza riuscire a risolverlo. Cosa conviene fare?",
        opzioni: [
          "Insistere senza fermarsi finché non funziona",
          "Fare una pausa e chiedere un parere a qualcuno",
          "Lasciarlo perdere e sperare che nessuno se ne accorga",
          "Ricominciare tutto da capo",
        ],
        corretta: 1,
      },
    ],
    corsi: [
      {
        nome: "AI Full Stack Developer",
        descrizione:
          "Programmatore completo: sviluppa sia il front end (ciò che vede l'utente) sia il back end (logica e dati) delle applicazioni, con linguaggi come JavaScript, Java e Python, seguendo tutto il ciclo di vita del software.",
        sedi: ["Modena – Città dei Ragazzi"],
        url: "https://itsolivetti.it/corso/its-full-stack-developer/",
      },
      {
        nome: "Data Driven Software & Web Developer",
        descrizione:
          "Progetta e realizza portali e applicazioni web (Java, PHP, React, JavaScript), anche su cloud, e sa analizzare i dati per trasformarli in report e visualizzazioni utili alle decisioni.",
        sedi: ["Ferrara – CFI Centro Formazione Innovazione"],
        url: "https://itsolivetti.it/corso/software-and-web-developer/",
      },
      {
        nome: "AI Cloud DevOps",
        descrizione:
          "Sviluppa software e ne automatizza test e rilascio, gestendo sistemi e reti su architetture cloud con attenzione alla sostenibilità e ai consumi energetici.",
        sedi: ["Cesena"],
        url: "https://itsolivetti.it/corso/cloud-devops-its-academy-adriano-olivetti/",
      },
      {
        nome: "Game Programmer",
        descrizione:
          "Programma videogiochi: integra grafica 2D/3D e interfacce, sviluppa modalità multiplayer e ottimizza le prestazioni. Il corso è accreditato come Unreal Academic Partner di Epic Games.",
        sedi: ["Bologna – Palazzo della Formazione"],
        url: "https://itsolivetti.it/corso/game-programmer/",
      },
    ],
  },
  {
    id: "dati-ai",
    titolo: "Dati e intelligenza artificiale",
    icona: "chart",
    breve: "Dati e IA",
    tema: "Corsi per chi vuole lavorare con i dati e l'intelligenza artificiale.",
    gioco: "memory",
    // Coppie competenza/descrizione: brevi, per stare nelle carte anche su telefono.
    // Le descrizioni si somigliano apposta, per rendere il memory più difficile.
    coppie: [
      { termine: "Problem solving", definizione: "Analizzare un problema e trovare la soluzione" },
      { termine: "Pensiero critico", definizione: "Verificare se un'informazione è affidabile" },
      { termine: "Project management", definizione: "Gestire tempi, risorse e costi di un progetto" },
      { termine: "Lavoro di squadra", definizione: "Raggiungere un obiettivo insieme agli altri" },
      { termine: "Comunicazione efficace", definizione: "Adattare il messaggio a chi ascolta" },
      { termine: "Privacy", definizione: "Proteggere i dati personali" },
      { termine: "Flessibilità", definizione: "Adattarsi quando i piani cambiano" },
      { termine: "Leadership", definizione: "Guidare e motivare un gruppo" },
    ],
    corsi: [
      {
        nome: "AI Data Manager",
        descrizione:
          "Coordina progetti di gestione e analisi dati: sceglie modelli statistici e tecniche di intelligenza artificiale e big data per ricavare informazioni di valore per il business.",
        sedi: ["Piacenza"],
        url: "https://itsolivetti.it/corso/ai-data-manager/",
      },
      {
        nome: "Data Driven Business Specialist",
        descrizione:
          "Organizza e analizza basi di dati complesse con metodi statistici e IA per scoprire trend e schemi ricorrenti, aiutando le aziende a prendere decisioni migliori.",
        sedi: ["Bologna"],
        url: "https://itsolivetti.it/corso/data-manager/",
      },
      {
        nome: "AI Solutions Architect",
        descrizione:
          "Guida la trasformazione digitale delle imprese: progetta architetture software e soluzioni di intelligenza artificiale (machine learning, IA generativa) e fa da ponte tra business e team tecnici.",
        sedi: ["Bologna"],
        url: "https://itsolivetti.it/corso/ai-solutions-architect/",
      },
      {
        nome: "AI Creative Digital Specialist",
        descrizione:
          "Digitalizza i processi aziendali progettando applicazioni virtuali e basate sull'IA per automatizzare la produzione e migliorare efficienza, qualità e sicurezza.",
        sedi: ["Parma"],
        url: "https://itsolivetti.it/corso/its-creative-digital-specialist/",
      },
    ],
  },
  {
    id: "audio-video-immersivo",
    titolo: "Audio, video e mondi immersivi",
    icona: "film",
    breve: "Media",
    tema: "Corsi per chi vuole creare video, suoni, interfacce e mondi virtuali.",
    gioco: "acchiappa",
    istruzioni: "Colpisci le qualità utili per lavorare in questi corsi. Attenzione: alcune intruse sembrano qualità, ma non lo sono!",
    parole: {
      giuste: [
        "Creatività", "Spirito critico", "Collaborazione", "Flessibilità", "Gestione del tempo",
        "Ascolto attivo", "Accettare i feedback", "Precisione", "Curiosità", "Inglese",
      ],
      intruse: [
        "Fare tutto da solo", "Evitare le critiche", "Improvvisare sempre", "Copiare idee altrui",
        "Ignorare le scadenze", "Non cambiare mai idea", "Rimandare",
      ],
    },
    corsi: [
      {
        nome: "Augmented Virtual and Mixed Reality Specialist",
        descrizione:
          "Crea grafica, animazioni ed effetti speciali in realtà aumentata, virtuale e mista (AR/VR/MR) per cinema, gaming, web, industria, turismo e valorizzazione dei beni culturali.",
        sedi: ["Bologna"],
        url: "https://itsolivetti.it/corso/arvr-augmented-virtual-and-mixed-reality-specialist/",
      },
      {
        nome: "AI Video and Virtual Production Specialist",
        descrizione:
          "Realizza video, animazioni ed effetti visivi: scrive storyboard, dirige le riprese e cura la post-produzione, anche con l'IA generativa e i set virtuali.",
        sedi: ["Castel San Pietro"],
        url: "https://itsolivetti.it/corso/ai-virtual-production-specialist/",
      },
      {
        nome: "Multimedia Sound Designer",
        descrizione:
          "Progetta e produce l'audio per videogiochi, VR/AR e installazioni multimediali, con software professionali, audio spaziale (Dolby Atmos, binaurale) e strumenti di IA.",
        sedi: ["Bologna"],
        url: "https://itsolivetti.it/corso/multimedia-sound-designer/",
      },
      {
        nome: "UX/UI Designer",
        descrizione:
          "Progetta l'esperienza utente e le interfacce di siti e app: ricerca sugli utenti, wireframe, prototipi interattivi e interfacce accessibili e responsive.",
        sedi: ["Castel San Pietro"],
        url: "https://itsolivetti.it/corso/ui-ux-designer/",
      },
    ],
  },
  {
    id: "marketing-moda",
    titolo: "Marketing, contenuti e moda",
    icona: "shirt",
    breve: "Moda e marketing",
    tema: "Corsi per chi vuole lavorare nel marketing digitale, nei social e nella moda.",
    gioco: "impiccato",
    // Solo lettere A-Z, senza accenti o spazi.
    parole: [
      { parola: "EMPATIA", indizio: "Capire come si sente il cliente mettendosi nei suoi panni" },
      { parola: "COLLABORAZIONE", indizio: "Lavorare insieme verso lo stesso obiettivo, condividendo idee e compiti" },
      { parola: "PIANIFICAZIONE", indizio: "Decidere in anticipo tempi, costi e attività di un progetto" },
      { parola: "NEGOZIAZIONE", indizio: "Trovare un accordo che vada bene sia a te sia al cliente" },
    ],
    corsi: [
      {
        nome: "Digital Marketing Technology Specialist",
        descrizione:
          "Definisce strategie di marketing digitale e campagne multicanale (web, social, video), usando IA e analisi dei dati per misurare e migliorare i risultati.",
        sedi: ["Bologna"],
        url: "https://itsolivetti.it/corso/digital-media-specialist/",
      },
      {
        nome: "Social Media & Content Specialist",
        descrizione:
          "Produce contenuti digitali (grafica, video, audio, motion graphic) per social e campagne di comunicazione, sfruttando anche realtà aumentata e intelligenza artificiale.",
        sedi: ["Castel San Pietro"],
        url: "https://itsolivetti.it/corso/digital-content-designer/",
      },
      {
        nome: "Made in Italy Fashion Executive",
        descrizione:
          "Gestisce produzione, logistica e qualità nelle aziende di abbigliamento e calzature, controllando tempi e costi della filiera, tracciabilità e sostenibilità.",
        sedi: ["Rimini (sede principale)", "San Mauro Pascoli (sede secondaria)"],
        url: "https://itsolivetti.it/corso/made-in-italy-fashion-executive/",
      },
      {
        nome: "Fashion Product Manager",
        descrizione:
          "Segue le collezioni dall'idea alla vendita: struttura della collezione, sviluppo prodotto (maglieria, confezione, denim), retail ed e-commerce, con attenzione alla sostenibilità.",
        sedi: ["Carpi – ForModena"],
        url: "https://itsolivetti.it/corso/fashion-product-manager/",
      },
      {
        nome: "Fashion Innovation Specialist",
        descrizione:
          "Coordina ricerca, sviluppo e produzione dei capi: sceglie i materiali, traduce le idee di stile in specifiche tecniche e usa tecnologie innovative per ridurre gli sprechi.",
        sedi: ["Bologna – Fondazione FRI"],
        url: "https://itsolivetti.it/corso/fashion-hi-tech-and-sustainable-manager/",
      },
    ],
  },
];

// Reso disponibile sia al browser (nessun bundler/module system) sia a Node (server.js).
if (typeof window !== "undefined") {
  window.ITS_LEVELS = ITS_LEVELS;
}
if (typeof module === "object" && module.exports) {
  module.exports = ITS_LEVELS;
}
