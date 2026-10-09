import type { Data } from './shared'

// Les textes de cette langue. Entre les accolades, du JSON strict (guillemets doubles, pas de virgule finale) :
// le mod lit ce fichier comme un texte, seulement quand la langue sert, sans jamais l'importer.
const data: Data = {
  "decimal": ",",
  "billion": "Mld",
  "pct": "{0}%",
  "colon": ": ",
  "tabs": {
    "discussions": "Conversazioni",
    "agents": "Agenti",
    "modeles": "Modelli",
    "chrono": "Cronologia",
    "aide": "Capire"
  },
  "periods": {
    "five": "Sessione 5 h",
    "today": "Oggi",
    "week": "Settimana"
  },
  "parts": [
    "Testo nuovo",
    "Risposte di Claude",
    "Rilettura contesto",
    "Scrittura in cache"
  ],
  "help": "### Che cosa conta questo numero?\nTutto ciò che le tue conversazioni fanno passare da Claude, **ingressi e uscite insieme**, convertito in un’unica unità.\nÈ il tuo **consumo reale**, calcolato a partire da più elementi (testo inviato, risposte, contesto riletto, scrittura in cache, modello usato),\ne non il numero che Claude mostra in una conversazione, che indica solo la dimensione del contesto in un dato momento.\n\n- **Ciò che Claude legge**: a ogni risposta rilegge tutta la conversazione (i tuoi messaggi, i file, i risultati degli strumenti).\n  È di gran lunga il volume maggiore.\n- **Ciò che Claude scrive**: le sue risposte e il suo ragionamento. Pochi token, ma ognuno conta cinque volte di più.\n\n### Perché così tanti milioni?\nPerché la lettura si ripete. Una conversazione di 400.000 token che riceve 1.000 risposte fa rileggere\n400 milioni di token. Riletti dalla cache non pesano quasi nulla, ma il loro numero finisce per contare.\nIl contatore di una conversazione mostra solo la dimensione del contesto in un dato momento, non questo totale.\n\n### L’unità\nUn *token pesato* vale un token di ingresso di Opus 5.5. Uscita: 5. Riletto dalla cache: 0,05.\nScritto in cache: fino a 2. Un token Fable pesa 2,5 volte un token Opus, un token Sonnet la metà.\n\n### Il contatore «Questo turno»\nRiparte da zero a ogni messaggio che invii e sale a ogni passo di Claude (ragionamento, strumento, risposta),\nsotto-agenti compresi. Se non si muove, non si consuma nulla.\n\n### Gli agenti\nOgni agente parte con le sue istruzioni di sistema e la definizione di tutti i suoi strumenti: circa 50.000 token\nprima ancora di lavorare. Poi rilegge il suo contesto a ogni richiesta, come una conversazione.\nLa scheda **Agenti** mostra, per ciascuno, il numero visualizzato dall’app, la sua partenza, le sue richieste e la causa principale.\n\n### I limiti\nAnthropic non li pubblica in token. Sono stimati: token misurati su questo computer ÷ percentuale ufficiale,\nda cui il segno ≈. La stima si affina a ogni misura.\nIl numero di token del limite delle 5 h quindi non è fisso: il mod lo trova da solo dopo qualche richiesta\ne poi lo corregge man mano che usi Claude.\n\n### Per consumare meno\nRipartire da una conversazione nuova o compattare quando il contesto diventa lungo: ogni risposta costa allora meno.",
  "cmdOpen": "Apre il pannello del consumo di token",
  "cmdRefresh": "Fa comparire la fascia nelle conversazioni aperte prima dell’installazione del mod",
  "paneOpened": "Pannello dei consumi aperto.",
  "untitled": "Senza titolo",
  "refreshBusy": [
    "Non è stato fatto nulla: una conversazione lavora ancora con un vecchio motore.",
    "Non è stato fatto nulla: {0} conversazioni lavorano ancora con un vecchio motore."
  ],
  "refreshWait": "Aspetta che abbia finito (o fermala), poi rilancia /conso-actualiser.",
  "refreshNone": "È tutto aggiornato: nessuna conversazione aperta gira su un motore precedente al mod.",
  "refreshDone": [
    "1 conversazione aggiornata:",
    "{0} conversazioni aggiornate:"
  ],
  "refreshReopen": "Riaprile: la fascia dei consumi vi compare.",
  "refreshFailed": "Impossibile fermare il motore di: {0}. Chiudi e riavvia Claude per quelle.",
  "scanFailed": "scan.mjs è terminato con il codice {0}",
  "turn": "Questo turno",
  "running": "in corso",
  "idle": "a riposo",
  "unavailable": "Consumo non disponibile",
  "computingBand": "Consumo: calcolo in corso…",
  "computingPane": "Calcolo del consumo in corso…",
  "reset": "reset",
  "thisChat": "questa conversazione",
  "weekLower": "settimana",
  "weekly": "Settimana",
  "weekAll": "tutti i modelli",
  "estimated": "stimato",
  "details": "Dettagli",
  "detail": "Dettaglio",
  "of": "su",
  "ofUsage": "{0} dei consumi",
  "back": "← Tutte le conversazioni",
  "whereFrom": "Da dove viene questo consumo",
  "days7": "7 giorni",
  "models": "Modelli",
  "detailFoot": "{0} risposte di Claude · ≈ {1} token per risposta · sotto-agenti {2}",
  "none": "Nessun consumo in questo periodo.",
  "ofLimit": "≈ {0} del limite",
  "ofPeriod": "{0} del periodo",
  "noAgents": "Nessun agente avviato negli ultimi 7 giorni.",
  "agentsHead": "7 giorni: {0} agenti · {1} token · {2} dei tuoi consumi · partenza media {3} token",
  "shown": "Mostrato",
  "start": "Partenza",
  "requests": "Richieste",
  "use": "Consumo",
  "agentAlt": "mostrato {0}, partenza {1}, {2} richieste, consumo {3}.",
  "whyReread": "{0}: rilettura del contesto, {1} richieste hanno riletto in media {2} token ciascuna.",
  "whyCached": "{0}: scrittura del contesto, {1} token messi in cache (contano doppio).",
  "whyWritten": "{0}: ciò che ha scritto, {1} token di uscita (contano cinque volte).",
  "whyPlain": "{0}: testo inviato senza cache, {1} token.",
  "whyStart": "Partenza a {0} token prima di ogni lavoro: istruzioni di sistema e definizioni degli strumenti.",
  "slotsBy": "per intervallo di 10 min",
  "now": "adesso",
  "fromTo": "dalle {0} alle {1}",
  "last7": "Ultimi 7 giorni",
  "dayByDay": "Giorno per giorno",
  "heads": [
    "Giorno",
    "Token",
    "Quota"
  ],
  "dayTable": "Tabella giorno per giorno",
  "lastFailed": "Ultimo aggiornamento non riuscito",
  "inTotal": "token in totale",
  "version": "versione",
  "notSent": "percentuale non trasmessa dall’app",
  "left": "restano",
  "estimating": "limite in corso di stima",
  "chats": [
    "1 conversazione",
    "{0} conversazioni"
  ],
  "peak": "picco",
  "tokens": "token"
}

export default data
