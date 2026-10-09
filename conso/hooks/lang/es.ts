import type { Data } from './shared'

// Les textes de cette langue. Entre les accolades, du JSON strict (guillemets doubles, pas de virgule finale) :
// le mod lit ce fichier comme un texte, seulement quand la langue sert, sans jamais l'importer.
const data: Data = {
  "decimal": ",",
  "billion": "mil M",
  "pct": "{0} %",
  "colon": ": ",
  "tabs": {
    "discussions": "Conversaciones",
    "agents": "Agentes",
    "modeles": "Modelos",
    "chrono": "Cronología",
    "aide": "Entender"
  },
  "periods": {
    "five": "Sesión 5 h",
    "today": "Hoy",
    "week": "Semana"
  },
  "parts": [
    "Texto nuevo",
    "Respuestas Claude",
    "Relectura contexto",
    "Guardado en caché"
  ],
  "help": "### ¿Qué cuenta esta cifra?\nTodo lo que tus conversaciones hacen pasar por Claude, **entradas y salidas juntas**, convertido a una sola unidad.\nEs tu **consumo real**, calculado a partir de varios elementos (texto enviado, respuestas, contexto releído, guardado en caché, modelo usado),\ny no la cifra que Claude muestra en una conversación, que solo indica el tamaño del contexto en un momento dado.\n\n- **Lo que Claude lee**: en cada respuesta relee toda la conversación (tus mensajes, los archivos, los resultados de herramientas).\n  Es, con mucha diferencia, el mayor volumen.\n- **Lo que Claude escribe**: sus respuestas y su razonamiento. Pocos tokens, pero cada uno cuenta cinco veces más.\n\n### ¿Por qué tantos millones?\nPorque la lectura se repite. Una conversación de 400 000 tokens que recibe 1000 respuestas hace releer\n400 millones de tokens. Releídos desde la caché casi no pesan, pero su cantidad acaba contando.\nEl contador de una conversación solo muestra el tamaño del contexto en un momento dado, no este acumulado.\n\n### La unidad\nUn *token ponderado* equivale a un token de entrada de Opus 5.5. Salida: 5. Releído desde la caché: 0,05.\nGuardado en caché: hasta 2. Un token de Fable pesa 2,5 veces un token de Opus; uno de Sonnet, la mitad.\n\n### El contador «Este turno»\nEmpieza de cero con cada mensaje que envías y sube con cada paso de Claude (razonamiento, herramienta, respuesta),\nsubagentes incluidos. Si no se mueve, no se consume nada.\n\n### Los agentes\nCada agente arranca con sus instrucciones de sistema y la definición de todas sus herramientas: unos 50 000 tokens\nantes incluso de trabajar. Después relee su contexto en cada petición, como una conversación.\nLa pestaña **Agentes** muestra, para cada uno, la cifra que enseña la app, su arranque, sus peticiones y la causa principal.\n\n### Los límites\nAnthropic no los publica en tokens. Son estimados: tokens medidos en este equipo ÷ porcentaje oficial,\nde ahí el signo ≈. La estimación se afina con cada medición.\nPor eso el número de tokens del límite de 5 h no es fijo: el mod lo encuentra solo tras unas pocas peticiones\ny luego lo va corrigiendo a medida que usas Claude.\n\n### Para consumir menos\nEmpezar una conversación nueva o compactar cuando el contexto se alarga: cada respuesta cuesta entonces menos.",
  "cmdOpen": "Abre el panel de consumo de tokens",
  "cmdRefresh": "Hace aparecer la banda en las conversaciones abiertas antes de instalar el mod",
  "paneOpened": "Panel de consumo abierto.",
  "untitled": "Sin título",
  "refreshBusy": [
    "No se ha hecho nada: una conversación sigue trabajando con un motor antiguo.",
    "No se ha hecho nada: {0} conversaciones siguen trabajando con un motor antiguo."
  ],
  "refreshWait": "Espera a que termine (o detenla) y vuelve a lanzar /conso-refresh.",
  "refreshNone": "Todo está al día: ninguna conversación abierta funciona con un motor anterior al mod.",
  "refreshDone": [
    "1 conversación actualizada:",
    "{0} conversaciones actualizadas:"
  ],
  "refreshReopen": "Vuelve a abrirlas: la banda de consumo aparece en ellas.",
  "refreshFailed": "No se pudo detener el motor de: {0}. Cierra y vuelve a abrir Claude para esas.",
  "scanFailed": "scan.mjs terminó con el código {0}",
  "turn": "Este turno",
  "running": "en curso",
  "idle": "en reposo",
  "unavailable": "Consumo no disponible",
  "computingBand": "Consumo: calculando…",
  "computingPane": "Calculando el consumo…",
  "reset": "reinicio",
  "thisChat": "esta conversación",
  "weekLower": "semana",
  "weekly": "Semanal",
  "weekAll": "todos los modelos",
  "estimated": "estimado",
  "details": "Detalles",
  "detail": "Detalle",
  "of": "de",
  "ofUsage": "{0} de tu consumo",
  "back": "← Todas las conversaciones",
  "whereFrom": "De dónde viene este consumo",
  "days7": "7 días",
  "models": "Modelos",
  "detailFoot": "{0} respuestas de Claude · ≈ {1} tokens por respuesta · subagentes {2}",
  "none": "Sin consumo en este periodo.",
  "ofLimit": "≈ {0} del límite",
  "ofPeriod": "{0} del periodo",
  "noAgents": "Ningún agente lanzado en los últimos 7 días.",
  "agentsHead": "7 días: {0} agentes · {1} tokens · {2} de tu consumo · arranque medio {3} tokens",
  "shown": "Mostrado",
  "start": "Arranque",
  "requests": "Peticiones",
  "use": "Consumo",
  "agentAlt": "mostrado {0}, arranque {1}, {2} peticiones, consumo {3}.",
  "whyReread": "{0}: relectura del contexto, {1} peticiones releyeron de media {2} tokens cada una.",
  "whyCached": "{0}: guardado del contexto, {1} tokens puestos en caché (cuentan doble).",
  "whyWritten": "{0}: lo que escribió, {1} tokens de salida (cuentan cinco veces).",
  "whyPlain": "{0}: texto enviado sin caché, {1} tokens.",
  "whyStart": "Arranque con {0} tokens antes de trabajar: instrucciones de sistema y definiciones de herramientas.",
  "slotsBy": "por tramo de 10 min",
  "now": "ahora",
  "fromTo": "de {0} a {1}",
  "last7": "Últimos 7 días",
  "dayByDay": "Día a día",
  "heads": [
    "Día",
    "Tokens",
    "Parte"
  ],
  "dayTable": "Tabla día a día",
  "lastFailed": "La última actualización falló",
  "inTotal": "tokens en total",
  "version": "versión",
  "notSent": "porcentaje no facilitado por la app",
  "left": "quedan",
  "estimating": "límite en proceso de estimación",
  "chats": [
    "1 conversación",
    "{0} conversaciones"
  ],
  "peak": "pico",
  "tokens": "tokens"
}

export default data
