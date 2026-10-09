import type { Data } from './shared'

// Les textes de cette langue. Entre les accolades, du JSON strict (guillemets doubles, pas de virgule finale) :
// le mod lit ce fichier comme un texte, seulement quand la langue sert, sans jamais l'importer.
const data: Data = {
  "decimal": ",",
  "billion": "mil M",
  "pct": "{0}%",
  "colon": ": ",
  "tabs": {
    "discussions": "Conversas",
    "agents": "Agentes",
    "modeles": "Modelos",
    "chrono": "Cronologia",
    "aide": "Entender"
  },
  "periods": {
    "five": "Sessão 5 h",
    "today": "Hoje",
    "week": "Semana"
  },
  "parts": [
    "Texto novo",
    "Respostas do Claude",
    "Releitura contexto",
    "Gravação em cache"
  ],
  "help": "### O que este número conta?\nTudo o que as suas conversas fazem passar pelo Claude, **entradas e saídas juntas**, convertido numa única unidade.\nÉ o seu **consumo real**, calculado a partir de vários elementos (texto enviado, respostas, contexto relido, gravação em cache, modelo usado),\ne não o número que o Claude mostra numa conversa, que indica apenas o tamanho do contexto num dado momento.\n\n- **O que o Claude lê**: a cada resposta ele relê a conversa inteira (as suas mensagens, os ficheiros, os resultados de ferramentas).\n  É, de longe, o maior volume.\n- **O que o Claude escreve**: as respostas e o raciocínio. Poucos tokens, mas cada um conta cinco vezes mais.\n\n### Porquê tantos milhões?\nPorque a leitura se repete. Uma conversa de 400 000 tokens que recebe 1000 respostas faz reler\n400 milhões de tokens. Relidos a partir da cache quase não pesam, mas a quantidade acaba por contar.\nO contador de uma conversa mostra apenas o tamanho do contexto num dado momento, não este acumulado.\n\n### A unidade\nUm *token ponderado* equivale a um token de entrada do Opus 5.5. Saída: 5. Relido a partir da cache: 0,05.\nGravado em cache: até 2. Um token do Fable pesa 2,5 vezes um token do Opus; um do Sonnet, metade.\n\n### O contador «Este turno»\nComeça do zero a cada mensagem enviada e sobe a cada passo do Claude (raciocínio, ferramenta, resposta),\nsubagentes incluídos. Se não se mexe, nada está a ser consumido.\n\n### Os agentes\nCada agente arranca com as instruções de sistema e a definição de todas as suas ferramentas: cerca de 50 000 tokens\nantes mesmo de trabalhar. Depois relê o contexto a cada pedido, como uma conversa.\nO separador **Agentes** mostra, para cada um, o número apresentado pela app, o arranque, os pedidos e a causa principal.\n\n### Os limites\nA Anthropic não os publica em tokens. São estimados: tokens medidos neste computador ÷ percentagem oficial,\ndaí o sinal ≈. A estimativa fica mais precisa a cada medição.\nPor isso o número de tokens do limite de 5 h não é fixo: o mod encontra-o sozinho ao fim de alguns pedidos\ne depois vai corrigindo-o à medida que o Claude é usado.\n\n### Para consumir menos\nComeçar uma conversa nova ou compactar quando o contexto fica longo: cada resposta passa a custar menos.",
  "cmdOpen": "Abre o painel de consumo de tokens",
  "cmdRefresh": "Faz aparecer a faixa nas conversas abertas antes da instalação do mod",
  "paneOpened": "Painel de consumo aberto.",
  "untitled": "Sem título",
  "refreshBusy": [
    "Nada foi feito: uma conversa ainda trabalha com um motor antigo.",
    "Nada foi feito: {0} conversas ainda trabalham com um motor antigo."
  ],
  "refreshWait": "Espere que termine (ou pare-a) e volte a executar /conso-refresh.",
  "refreshNone": "Está tudo atualizado: nenhuma conversa aberta funciona com um motor anterior ao mod.",
  "refreshDone": [
    "1 conversa atualizada:",
    "{0} conversas atualizadas:"
  ],
  "refreshReopen": "Volte a abri-las: a faixa de consumo aparece nelas.",
  "refreshFailed": "Não foi possível parar o motor de: {0}. Feche e reabra o Claude para essas.",
  "scanFailed": "scan.mjs terminou com o código {0}",
  "turn": "Este turno",
  "running": "em curso",
  "idle": "em repouso",
  "unavailable": "Consumo indisponível",
  "computingBand": "Consumo: a calcular…",
  "computingPane": "A calcular o consumo…",
  "reset": "reinício",
  "thisChat": "esta conversa",
  "weekLower": "semana",
  "weekly": "Semanal",
  "weekAll": "todos os modelos",
  "estimated": "estimado",
  "details": "Detalhes",
  "detail": "Detalhe",
  "of": "de",
  "ofUsage": "{0} do consumo",
  "back": "← Todas as conversas",
  "whereFrom": "De onde vem este consumo",
  "days7": "7 dias",
  "models": "Modelos",
  "detailFoot": "{0} respostas do Claude · ≈ {1} tokens por resposta · subagentes {2}",
  "none": "Sem consumo neste período.",
  "ofLimit": "≈ {0} do limite",
  "ofPeriod": "{0} do período",
  "noAgents": "Nenhum agente lançado nos últimos 7 dias.",
  "agentsHead": "7 dias: {0} agentes · {1} tokens · {2} do consumo · arranque médio {3} tokens",
  "shown": "Mostrado",
  "start": "Arranque",
  "requests": "Pedidos",
  "use": "Consumo",
  "agentAlt": "mostrado {0}, arranque {1}, {2} pedidos, consumo {3}.",
  "whyReread": "{0}: releitura do contexto, {1} pedidos releram em média {2} tokens cada.",
  "whyCached": "{0}: gravação do contexto, {1} tokens postos em cache (contam a dobrar).",
  "whyWritten": "{0}: o que escreveu, {1} tokens de saída (contam cinco vezes).",
  "whyPlain": "{0}: texto enviado sem cache, {1} tokens.",
  "whyStart": "Arranque com {0} tokens antes de qualquer trabalho: instruções de sistema e definições de ferramentas.",
  "slotsBy": "por intervalo de 10 min",
  "now": "agora",
  "fromTo": "das {0} às {1}",
  "last7": "Últimos 7 dias",
  "dayByDay": "Dia a dia",
  "heads": [
    "Dia",
    "Tokens",
    "Parte"
  ],
  "dayTable": "Tabela dia a dia",
  "lastFailed": "A última atualização falhou",
  "inTotal": "tokens no total",
  "version": "versão",
  "notSent": "percentagem não fornecida pela app",
  "left": "restam",
  "estimating": "limite ainda em estimativa",
  "chats": [
    "1 conversa",
    "{0} conversas"
  ],
  "peak": "pico",
  "tokens": "tokens"
}

export default data
