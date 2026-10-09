import type { Data } from './shared'

// Les textes de cette langue. Entre les accolades, du JSON strict (guillemets doubles, pas de virgule finale) :
// le mod lit ce fichier comme un texte, seulement quand la langue sert, sans jamais l'importer.
const data: Data = {
  "decimal": ",",
  "billion": "Md",
  "pct": "{0} %",
  "colon": " : ",
  "tabs": {
    "discussions": "Discussions",
    "agents": "Agents",
    "modeles": "Modèles",
    "chrono": "Chronologie",
    "aide": "Comprendre"
  },
  "periods": {
    "five": "Session 5 h",
    "today": "Aujourd'hui",
    "week": "Semaine"
  },
  "parts": [
    "Nouveau texte",
    "Réponses de Claude",
    "Relecture contexte",
    "Mise en mémoire"
  ],
  "help": "### Que compte ce chiffre ?\nTout ce que tes discussions font passer par Claude, **entrées et sorties réunies**, ramené à une seule unité.\nC’est ta **consommation réelle**, calculée à partir de plusieurs éléments (texte envoyé, réponses, contexte relu, mise en cache, modèle utilisé),\net non le chiffre affiché par Claude dans une discussion, qui ne dit que la taille du contexte à un instant.\n\n- **Ce que Claude lit** : à chaque réponse il relit toute la discussion (tes messages, les fichiers, les résultats d’outils).\n  C’est de très loin le plus gros volume.\n- **Ce que Claude écrit** : ses réponses et sa réflexion. Peu de tokens, mais chacun compte cinq fois plus.\n\n### Pourquoi autant de millions ?\nParce que la lecture se répète. Une discussion de 400 000 tokens qui reçoit 1 000 réponses fait relire\n400 millions de tokens. Relus depuis le cache ils ne pèsent presque rien chacun, mais leur nombre finit par compter.\nLe compteur d’une discussion, lui, ne montre que la taille du contexte à un instant, pas ce cumul.\n\n### L’unité\nUn *token pondéré* vaut un token d’entrée Opus 5.5. Sortie : 5. Relu depuis le cache : 0,05.\nMis en cache : jusqu’à 2. Un token Fable pèse 2,5 fois un token Opus, un token Sonnet la moitié.\n\n### Le compteur « Ce tour »\nIl part de zéro à chaque message que tu envoies et monte à chaque étape de Claude (réflexion, outil, réponse),\nsous-agents compris. S’il ne bouge pas, rien n’est consommé.\n\n### Les agents\nChaque agent démarre avec ses consignes système et la définition de tous ses outils : environ 50 000 tokens\navant même de travailler. Ensuite il relit son contexte à chaque requête, comme une discussion.\nL’onglet **Agents** montre, pour chacun, le chiffre affiché par l’app, son départ, ses requêtes et la cause principale.\n\n### Les limites\nAnthropic ne les publie pas en tokens. Elles sont estimées : tokens mesurés sur ce PC ÷ pourcentage officiel,\nd’où le signe ≈. L’estimation s’affine à chaque mesure.\nLe nombre de tokens de la limite 5 h n’est donc pas fixe : le mod le trouve tout seul au bout de quelques requêtes,\npuis le corrige de lui-même au fil de ton utilisation.\n\n### Pour consommer moins\nRepartir sur une discussion neuve ou compacter quand le contexte devient long : chaque réponse coûte alors moins.",
  "cmdOpen": "Ouvre le panneau de consommation de tokens",
  "cmdRefresh": "Fait apparaître la bande dans les discussions ouvertes avant l’installation du mod",
  "paneOpened": "Panneau conso ouvert.",
  "untitled": "Sans titre",
  "refreshBusy": [
    "Rien n'a été fait : une discussion travaille encore sur un ancien moteur.",
    "Rien n'a été fait : {0} discussions travaillent encore sur un ancien moteur."
  ],
  "refreshWait": "Attends qu’elle ait fini (ou arrête-la), puis relance /conso-refresh.",
  "refreshNone": "Tout est à jour : aucune discussion ouverte ne tourne sur un moteur d’avant le mod.",
  "refreshDone": [
    "1 discussion rafraîchie :",
    "{0} discussions rafraîchies :"
  ],
  "refreshReopen": "Rouvre-les : la bande de conso y apparaît.",
  "refreshFailed": "Impossible d’arrêter le moteur de : {0}. Ferme et relance Claude pour celles-là.",
  "scanFailed": "scan.mjs a fini avec le code {0}",
  "turn": "Ce tour",
  "running": "en cours",
  "idle": "au repos",
  "unavailable": "Conso indisponible",
  "computingBand": "Conso : calcul en cours…",
  "computingPane": "Calcul de la conso en cours…",
  "reset": "reset",
  "thisChat": "cette discussion",
  "weekLower": "semaine",
  "weekly": "Hebdo",
  "weekAll": "tous modèles",
  "estimated": "estimé",
  "details": "Détails",
  "detail": "Détail",
  "of": "sur",
  "ofUsage": "{0} de ta conso",
  "back": "← Toutes les discussions",
  "whereFrom": "D’où vient cette conso",
  "days7": "7 jours",
  "models": "Modèles",
  "detailFoot": "{0} réponses de Claude · ≈ {1} tokens par réponse · sous-agents {2}",
  "none": "Aucune conso sur cette période.",
  "ofLimit": "≈ {0} de la limite",
  "ofPeriod": "{0} de la période",
  "noAgents": "Aucun agent lancé ces 7 derniers jours.",
  "agentsHead": "7 jours : {0} agents · {1} tokens · {2} de ta conso · départ moyen {3} tokens",
  "shown": "Affiché",
  "start": "Départ",
  "requests": "Requêtes",
  "use": "Conso",
  "agentAlt": "affiché {0}, départ {1}, {2} requêtes, conso {3}.",
  "whyReread": "{0} : relecture du contexte, {1} requêtes ont relu en moyenne {2} tokens chacune.",
  "whyCached": "{0} : mise en mémoire du contexte, {1} tokens mis en cache (ils comptent double).",
  "whyWritten": "{0} : ce qu’il a écrit, {1} tokens de sortie (ils comptent cinq fois).",
  "whyPlain": "{0} : du texte envoyé sans cache, {1} tokens.",
  "whyStart": "Départ à {0} tokens avant tout travail : consignes système et définitions d’outils.",
  "slotsBy": "par tranche de 10 min",
  "now": "maintenant",
  "fromTo": "de {0} à {1}",
  "last7": "7 derniers jours",
  "dayByDay": "Jour par jour",
  "heads": [
    "Jour",
    "Tokens",
    "Part"
  ],
  "dayTable": "Tableau jour par jour",
  "lastFailed": "Dernière mise à jour en échec",
  "inTotal": "tokens au total",
  "version": "version",
  "notSent": "pourcentage non transmis par l’app",
  "left": "reste",
  "estimating": "limite en cours d’estimation",
  "chats": [
    "1 discussion",
    "{0} discussions"
  ],
  "peak": "pic",
  "tokens": "tokens"
}

export default data
