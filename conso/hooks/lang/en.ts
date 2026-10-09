import type { Data } from './shared'

// L'anglais est la seule langue toujours chargée : c'est le repli quand aucune autre ne l'est.
export const data: Data = {
  "decimal": ".",
  "billion": "B",
  "pct": "{0}%",
  "colon": ": ",
  "tabs": {
    "discussions": "Conversations",
    "agents": "Agents",
    "modeles": "Models",
    "chrono": "Timeline",
    "aide": "How it works"
  },
  "periods": {
    "five": "5 h session",
    "today": "Today",
    "week": "Week"
  },
  "parts": [
    "New text",
    "Claude’s replies",
    "Context re-reads",
    "Cache writes"
  ],
  "help": "### What does this number count?\nEverything your conversations send through Claude, **input and output combined**, converted to a single unit.\nThis is your **real usage**, calculated from several elements (text sent, replies, context re-read, cache writes, model used),\nnot the figure Claude displays in a conversation, which only tells the size of the context at one moment.\n\n- **What Claude reads**: with every reply it re-reads the whole conversation (your messages, files, tool results).\n  This is by far the largest volume.\n- **What Claude writes**: its replies and its thinking. Few tokens, but each one counts five times as much.\n\n### Why so many millions?\nBecause the reading repeats. A 400,000-token conversation that gets 1,000 replies makes Claude re-read\n400 million tokens. Re-read from the cache, each one weighs almost nothing, but their number adds up.\nA conversation’s own counter only shows the size of the context at one moment, not this running total.\n\n### The unit\nOne *weighted token* equals one Opus 5.5 input token. Output: 5. Re-read from the cache: 0.05.\nWritten to the cache: up to 2. A Fable token weighs 2.5 times an Opus token, a Sonnet token half.\n\n### The “This turn” counter\nIt starts from zero with each message you send and climbs with each step Claude takes (thinking, tool, reply),\nsub-agents included. If it is not moving, nothing is being used.\n\n### Agents\nEach agent starts with its system instructions and the definition of all its tools: about 50,000 tokens\nbefore doing any work. Then it re-reads its context on every request, like a conversation.\nThe **Agents** tab shows, for each one, the figure displayed by the app, its starting cost, its requests and the main cause.\n\n### The limits\nAnthropic does not publish them in tokens. They are estimated: tokens measured on this computer ÷ official percentage,\nhence the ≈ sign. The estimate gets sharper with each measurement.\nSo the token figure for the 5 h limit is not fixed: the mod works it out by itself after a few requests,\nthen keeps correcting it as you use Claude.\n\n### To use less\nStart a fresh conversation or compact when the context gets long: each reply then costs less.",
  "cmdOpen": "Opens the token usage panel",
  "cmdRefresh": "Makes the band appear in conversations opened before the mod was installed",
  "paneOpened": "Usage panel opened.",
  "untitled": "Untitled",
  "refreshBusy": [
    "Nothing was done: one conversation is still working on an old engine.",
    "Nothing was done: {0} conversations are still working on an old engine."
  ],
  "refreshWait": "Wait for it to finish (or stop it), then run /conso-refresh again.",
  "refreshNone": "Everything is up to date: no open conversation is running on an engine from before the mod.",
  "refreshDone": [
    "1 conversation refreshed:",
    "{0} conversations refreshed:"
  ],
  "refreshReopen": "Reopen them: the usage band now appears there.",
  "refreshFailed": "Could not stop the engine of: {0}. Close and restart Claude for those.",
  "scanFailed": "scan.mjs exited with code {0}",
  "turn": "This turn",
  "running": "running",
  "idle": "idle",
  "unavailable": "Usage unavailable",
  "computingBand": "Usage: calculating…",
  "computingPane": "Calculating usage…",
  "reset": "resets",
  "thisChat": "this conversation",
  "weekLower": "week",
  "weekly": "Weekly",
  "weekAll": "all models",
  "estimated": "estimated",
  "details": "Details",
  "detail": "Detail",
  "of": "of",
  "ofUsage": "{0} of your usage",
  "back": "← All conversations",
  "whereFrom": "Where this usage comes from",
  "days7": "7 days",
  "models": "Models",
  "detailFoot": "{0} replies from Claude · ≈ {1} tokens per reply · sub-agents {2}",
  "none": "No usage in this period.",
  "ofLimit": "≈ {0} of the limit",
  "ofPeriod": "{0} of the period",
  "noAgents": "No agent launched in the last 7 days.",
  "agentsHead": "7 days: {0} agents · {1} tokens · {2} of your usage · average start {3} tokens",
  "shown": "Displayed",
  "start": "Start",
  "requests": "Requests",
  "use": "Usage",
  "agentAlt": "displayed {0}, start {1}, {2} requests, usage {3}.",
  "whyReread": "{0}: re-reading the context, {1} requests re-read {2} tokens each on average.",
  "whyCached": "{0}: caching the context, {1} tokens written to the cache (they count double).",
  "whyWritten": "{0}: what it wrote, {1} output tokens (they count five times).",
  "whyPlain": "{0}: text sent without the cache, {1} tokens.",
  "whyStart": "Started at {0} tokens before any work: system instructions and tool definitions.",
  "slotsBy": "per 10 min slot",
  "now": "now",
  "fromTo": "from {0} to {1}",
  "last7": "Last 7 days",
  "dayByDay": "Day by day",
  "heads": [
    "Day",
    "Tokens",
    "Share"
  ],
  "dayTable": "Day-by-day table",
  "lastFailed": "Last update failed",
  "inTotal": "tokens in total",
  "version": "version",
  "notSent": "percentage not provided by the app",
  "left": "left",
  "estimating": "limit still being estimated",
  "chats": [
    "1 conversation",
    "{0} conversations"
  ],
  "peak": "peak",
  "tokens": "tokens"
}
