import type { Data } from './shared'

// Les textes de cette langue. Entre les accolades, du JSON strict (guillemets doubles, pas de virgule finale) :
// le mod lit ce fichier comme un texte, seulement quand la langue sert, sans jamais l'importer.
const data: Data = {
  "decimal": ",",
  "billion": "Mrd.",
  "pct": "{0} %",
  "colon": ": ",
  "tabs": {
    "discussions": "Unterhaltungen",
    "agents": "Agenten",
    "modeles": "Modelle",
    "chrono": "Verlauf",
    "aide": "Verstehen"
  },
  "periods": {
    "five": "5-Std.-Sitzung",
    "today": "Heute",
    "week": "Woche"
  },
  "parts": [
    "Neuer Text",
    "Claudes Antworten",
    "Kontext neu gelesen",
    "Cache-Schreiben"
  ],
  "help": "### Was zählt diese Zahl?\nAlles, was deine Unterhaltungen durch Claude schicken, **Eingabe und Ausgabe zusammen**, umgerechnet in eine einzige Einheit.\nDas ist dein **tatsächlicher Verbrauch**, berechnet aus mehreren Bestandteilen (gesendeter Text, Antworten, neu gelesener Kontext, Cache-Schreiben, verwendetes Modell),\nund nicht die Zahl, die Claude in einer Unterhaltung anzeigt: Die nennt nur die Größe des Kontexts in einem Moment.\n\n- **Was Claude liest**: Bei jeder Antwort liest es die ganze Unterhaltung neu (deine Nachrichten, die Dateien, die Tool-Ergebnisse).\n  Das ist mit großem Abstand die größte Menge.\n- **Was Claude schreibt**: seine Antworten und sein Nachdenken. Wenige Tokens, aber jedes zählt fünfmal so viel.\n\n### Warum so viele Millionen?\nWeil sich das Lesen wiederholt. Eine Unterhaltung mit 400.000 Tokens, die 1.000 Antworten bekommt, lässt\n400 Millionen Tokens neu lesen. Aus dem Cache gelesen wiegt jedes fast nichts, aber ihre Menge summiert sich.\nDer Zähler einer Unterhaltung zeigt dagegen nur die Größe des Kontexts in einem Moment, nicht diese Summe.\n\n### Die Einheit\nEin *gewichtetes Token* entspricht einem Eingabe-Token von Opus 5.5. Ausgabe: 5. Aus dem Cache gelesen: 0,05.\nIn den Cache geschrieben: bis zu 2. Ein Fable-Token wiegt 2,5-mal so viel wie ein Opus-Token, ein Sonnet-Token die Hälfte.\n\n### Der Zähler „Diese Runde“\nEr beginnt bei jeder Nachricht, die du sendest, bei null und steigt mit jedem Schritt von Claude (Nachdenken, Tool, Antwort),\nUnteragenten eingeschlossen. Bewegt er sich nicht, wird nichts verbraucht.\n\n### Die Agenten\nJeder Agent startet mit seinen Systemanweisungen und der Definition all seiner Tools: rund 50.000 Tokens,\nnoch bevor er arbeitet. Danach liest er seinen Kontext bei jeder Anfrage neu, wie eine Unterhaltung.\nDer Tab **Agenten** zeigt für jeden die Zahl, die die App anzeigt, seinen Start, seine Anfragen und die Hauptursache.\n\n### Die Limits\nAnthropic veröffentlicht sie nicht in Tokens. Sie werden geschätzt: auf diesem PC gemessene Tokens ÷ offizieller Prozentwert,\ndaher das Zeichen ≈. Die Schätzung wird mit jeder Messung genauer.\nDie Token-Zahl des 5-Stunden-Limits steht also nicht fest: Der Mod ermittelt sie nach einigen Anfragen von selbst\nund korrigiert sie dann laufend, während du Claude nutzt.\n\n### Weniger verbrauchen\nEine neue Unterhaltung beginnen oder komprimieren, wenn der Kontext lang wird: Jede Antwort kostet dann weniger.",
  "cmdOpen": "Öffnet das Panel zum Token-Verbrauch",
  "cmdRefresh": "Lässt die Leiste in Unterhaltungen erscheinen, die vor der Installation des Mods geöffnet wurden",
  "paneOpened": "Verbrauchs-Panel geöffnet.",
  "untitled": "Ohne Titel",
  "refreshBusy": [
    "Es wurde nichts getan: Eine Unterhaltung arbeitet noch mit einer alten Engine.",
    "Es wurde nichts getan: {0} Unterhaltungen arbeiten noch mit einer alten Engine."
  ],
  "refreshWait": "Warte, bis sie fertig ist (oder stoppe sie), und starte /conso-refresh dann erneut.",
  "refreshNone": "Alles ist aktuell: Keine offene Unterhaltung läuft mit einer Engine von vor dem Mod.",
  "refreshDone": [
    "1 Unterhaltung aktualisiert:",
    "{0} Unterhaltungen aktualisiert:"
  ],
  "refreshReopen": "Öffne sie erneut: Die Verbrauchsleiste erscheint dort.",
  "refreshFailed": "Die Engine konnte nicht gestoppt werden für: {0}. Schließe Claude und starte es für diese neu.",
  "scanFailed": "scan.mjs endete mit dem Code {0}",
  "turn": "Diese Runde",
  "running": "läuft",
  "idle": "in Ruhe",
  "unavailable": "Verbrauch nicht verfügbar",
  "computingBand": "Verbrauch: wird berechnet…",
  "computingPane": "Verbrauch wird berechnet…",
  "reset": "Reset",
  "thisChat": "diese Unterhaltung",
  "weekLower": "Woche",
  "weekly": "Woche",
  "weekAll": "alle Modelle",
  "estimated": "geschätzt",
  "details": "Details",
  "detail": "Detail",
  "of": "von",
  "ofUsage": "{0} vom Verbrauch",
  "back": "← Alle Unterhaltungen",
  "whereFrom": "Woher dieser Verbrauch kommt",
  "days7": "7 Tage",
  "models": "Modelle",
  "detailFoot": "{0} Antworten von Claude · ≈ {1} Tokens pro Antwort · Unteragenten {2}",
  "none": "Kein Verbrauch in diesem Zeitraum.",
  "ofLimit": "≈ {0} des Limits",
  "ofPeriod": "{0} des Zeitraums",
  "noAgents": "In diesem Zeitraum hat kein Agent gearbeitet.",
  "agentsHead": "{4}: {0} Agenten · {1} Tokens · {2} deines Verbrauchs · Start im Schnitt {3} Tokens",
  "shown": "Angezeigt",
  "start": "Start",
  "requests": "Anfragen",
  "use": "Verbrauch",
  "agentAlt": "angezeigt {0}, Start {1}, {2} Anfragen, Verbrauch {3}.",
  "whyReread": "{0}: Kontext neu gelesen, {1} Anfragen lasen im Schnitt je {2} Tokens neu.",
  "whyCached": "{0}: Kontext zwischengespeichert, {1} Tokens in den Cache geschrieben (sie zählen doppelt).",
  "whyWritten": "{0}: was er geschrieben hat, {1} Ausgabe-Tokens (sie zählen fünffach).",
  "whyPlain": "{0}: Text, der ohne Cache gesendet wurde, {1} Tokens.",
  "whyStart": "Start mit {0} Tokens vor jeder Arbeit: Systemanweisungen und Tool-Definitionen.",
  "slotsBy": "je 10 Minuten",
  "now": "jetzt",
  "fromTo": "von {0} bis {1}",
  "last7": "Letzte 7 Tage",
  "dayByDay": "Tag für Tag",
  "heads": [
    "Tag",
    "Tokens",
    "Anteil"
  ],
  "dayTable": "Tabelle Tag für Tag",
  "lastFailed": "Letzte Aktualisierung fehlgeschlagen",
  "inTotal": "Tokens insgesamt",
  "version": "Version",
  "notSent": "Prozentwert von der App nicht übermittelt",
  "left": "übrig",
  "estimating": "Limit wird noch geschätzt",
  "chats": [
    "1 Unterhaltung",
    "{0} Unterhaltungen"
  ],
  "peak": "Spitze",
  "tokens": "Tokens",
  "moreAgents": "Mehr anzeigen ({0})",
  "fewerAgents": "Weniger anzeigen",
  "agentsKept": "Nur die {0} teuersten Agenten jeder Unterhaltung werden im Detail behalten: {1} Karten für {2} Agenten."
}

export default data
