#!/usr/bin/env node
// Agrège la conso de tokens des transcripts Claude Code (~/.claude/projects).
// Appel : node scan.mjs - (le JSON arrive sur l'entrée standard), json = { projectsDir, cachePath, now, windows: [{ key, start, match? }], lang? }
// Appel : node scan.mjs lang, pour ne connaître que la langue du système.
// Écrit sur stdout un résumé JSON ; garde un cache incrémental (les .jsonl ne font que grandir).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BUCKET_MS = 10 * 60 * 1000
const CACHE_VERSION = 3
const KEEP_DAYS = 8
// Les périodes que l'onglet Agents sait montrer, et le nombre de fiches gardées pour chacune, par discussion.
const AGENT_KEYS = ['five', 'today', 'week']
const AGENT_KEPT = 12

// Prix API en $ par million de tokens : [entrée, sortie, lecture de cache].
// L'écriture de cache vaut 1,25 x l'entrée (5 min) ou 2 x (1 h).
const PRICES = [
  [/fable|mythos/, [10, 50, 0.25]],
  [/opus-5-5/, [4, 20, 0.2]],
  [/opus/, [5, 25, 0.5]],
  [/sonnet-5/, [2, 10, 0.2]],
  [/sonnet/, [3, 15, 0.3]],
  [/haiku-5/, [0.1, 0.5, 0.01]],
  [/haiku/, [1, 5, 0.1]],
]
const DEFAULT_PRICE = [4, 20, 0.2]
// L'unité affichée : 1 token pondéré = le coût d'un token d'entrée Opus 5.5.
const UNIT_PRICE = 4

const priceOf = model => (PRICES.find(([re]) => re.test(model)) ?? [null, DEFAULT_PRICE])[1]

export function weigh(model, usage) {
  const [pIn, pOut, pRead] = priceOf(model)
  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const read = usage.cache_read_input_tokens ?? 0
  const write = usage.cache_creation_input_tokens ?? 0
  const write1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0
  const write5m = Math.max(0, write - write1h)
  // La part de chaque nature de token dans le coût, en tokens pondérés.
  const parts = [input * pIn, output * pOut, read * pRead, write5m * pIn * 1.25 + write1h * pIn * 2].map(c => c / UNIT_PRICE)
  return { weighted: parts[0] + parts[1] + parts[2] + parts[3], input, output, read, write, parts }
}

function loadCache(cachePath) {
  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
    if (cache.version === CACHE_VERSION) return cache
  } catch {}
  return { version: CACHE_VERSION, files: {}, seen: [] }
}

function listTranscripts(projectsDir) {
  const found = []
  for (const project of safeList(projectsDir)) {
    if (!project.isDirectory()) continue
    const dir = path.join(projectsDir, project.name)
    for (const entry of safeList(dir)) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        found.push({ file: path.join(dir, entry.name), sessionId: entry.name.slice(0, -6), isMain: true })
      } else if (entry.isDirectory()) {
        const sub = path.join(dir, entry.name, 'subagents')
        for (const agent of safeList(sub)) {
          if (agent.isFile() && agent.name.endsWith('.jsonl')) {
            found.push({ file: path.join(sub, agent.name), sessionId: entry.name, isMain: false })
          }
        }
      }
    }
  }
  return found
}

function safeList(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

function firstText(message) {
  const content = message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.find(b => b.type === 'text')?.text ?? ''
  return ''
}

function readLine(line, record, seen) {
  if (line.includes('"usage"') && line.includes('"type":"assistant"')) {
    let row
    try {
      row = JSON.parse(line)
    } catch {
      return
    }
    const message = row.message
    if (row.type !== 'assistant' || !message?.usage || !message.id) return
    if (!record.cwd && row.cwd) record.cwd = row.cwd
    if (message.model === '<synthetic>' || seen.has(message.id)) return
    seen.add(message.id)
    const at = Date.parse(row.timestamp)
    if (!Number.isFinite(at)) return
    const model = message.model ?? 'inconnu'
    const bucket = Math.floor(at / BUCKET_MS) * BUCKET_MS
    const key = `${bucket}|${model}`
    const cell = (record.buckets[key] ??= [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const w = weigh(model, message.usage)
    cell[0] += w.weighted
    cell[1] += w.input
    cell[2] += w.output
    cell[3] += w.read
    cell[4] += w.write
    cell[5] += 1
    const context = w.input + w.read + w.write
    record.first ??= context
    record.peak = Math.max(record.peak ?? 0, context)
    record.model = model
    for (let i = 0; i < 4; i++) cell[6 + i] += w.parts[i]
    record.last = Math.max(record.last ?? 0, at)
  } else if (line.includes('"type":"custom-title"')) {
    try {
      record.title = JSON.parse(line).customTitle ?? record.title
    } catch {}
  } else if (!record.firstPrompt && line.includes('"type":"user"') && !line.includes('"tool_result"')) {
    try {
      const row = JSON.parse(line)
      if (row.type === 'user' && !row.isMeta && !row.isSidechain) {
        const text = firstText(row.message).replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        if (text) record.firstPrompt = text.slice(0, 80)
        if (!record.cwd && row.cwd) record.cwd = row.cwd
      }
    } catch {}
  }
}

// Lit le fichier à partir de record.offset, ligne complète par ligne complète.
function readFrom(file, record, seen) {
  const fd = fs.openSync(file, 'r')
  const chunk = Buffer.allocUnsafe(4 << 20)
  let pending = []
  let position = record.offset
  try {
    for (;;) {
      const count = fs.readSync(fd, chunk, 0, chunk.length, position)
      if (count === 0) break
      let from = 0
      for (;;) {
        const nl = chunk.indexOf(10, from)
        if (nl === -1 || nl >= count) break
        const piece = chunk.subarray(from, nl)
        const line = pending.length ? Buffer.concat([...pending, piece]).toString('utf8') : piece.toString('utf8')
        pending = []
        readLine(line, record, seen)
        from = nl + 1
        record.offset = position + from
      }
      if (from < count) pending.push(Buffer.from(chunk.subarray(from, count)))
      position += count
    }
  } finally {
    fs.closeSync(fd)
  }
}

function prune(record, oldest) {
  for (const key of Object.keys(record.buckets)) {
    if (Number(key.slice(0, key.indexOf('|'))) < oldest) delete record.buckets[key]
  }
}

// Les quelques textes que le scanner écrit lui-même, par langue ; `at` : « à 14:30 ».
const TEXTS = {
  fr: { noFolder: 'Sans dossier', unknown: 'Inconnu', untitled: 'Sans titre', at: time => `à ${time}` },
  en: { noFolder: 'No folder', unknown: 'Unknown', untitled: 'Untitled', at: time => `at ${time}` },
  es: { noFolder: 'Sin carpeta', unknown: 'Desconocido', untitled: 'Sin título', at: (time, hour) => `${hour === 1 ? 'a la' : 'a las'} ${time}` },
  de: { noFolder: 'Ohne Ordner', unknown: 'Unbekannt', untitled: 'Ohne Titel', at: time => `um ${time}` },
  pt: { noFolder: 'Sem pasta', unknown: 'Desconhecido', untitled: 'Sem título', at: (time, hour) => `${hour === 1 ? 'à' : 'às'} ${time}` },
  it: { noFolder: 'Senza cartella', unknown: 'Sconosciuto', untitled: 'Senza titolo', at: time => `alle ${time}` },
}

const usable = locale => {
  try {
    if (typeof locale !== 'string' || locale === '') return undefined
    // « pt_BR.UTF-8 » s'écrit « pt-BR » pour Intl.
    return new Intl.DateTimeFormat(locale.split('.')[0].replace(/_/g, '-')).resolvedOptions().locale
  } catch {
    return undefined
  }
}

// La langue d'affichage du système, lue sur la machine même, sans rien demander à Internet.
// Windows et macOS la rangent à part du format régional ; ailleurs, et en cas d'échec, celle de Node fait foi.
function displayLocale() {
  const read = (file, args) => execFileSync(file, args, { encoding: 'utf8', timeout: 3000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    if (process.platform === 'win32') {
      return /REG_MULTI_SZ\s+([A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*)/.exec(read('reg', ['query', ['HKCU', 'Control Panel', 'Desktop'].join(path.win32.sep), '/v', 'PreferredUILanguages']))?.[1]
    }
    if (process.platform === 'darwin') {
      return /"?([A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*)"?/.exec(read('defaults', ['read', '-g', 'AppleLanguages']).replace(/[()\s]/g, ''))?.[1]
    }
  } catch {}
  return undefined
}

/**
 * La langue des textes et la locale des dates. `forced` : une langue imposée par l'appelant (le choix fait dans le panneau).
 * `detect` : ce qui lit la langue d'affichage du système.
 * Une langue qui n'est pas traduite retombe sur l'anglais, avec des heures sur 24 h.
 */
export function tongue(forced, detect = displayLocale) {
  const system = usable(Intl.DateTimeFormat().resolvedOptions().locale) ?? 'en-GB'
  const wanted = usable(forced) ?? usable(detect()) ?? system
  const code = wanted.toLowerCase().split('-')[0]
  if (!(code in TEXTS)) return { lang: 'en', locale: 'en-GB' }
  // Le format régional du système est gardé quand il parle la même langue (« fr-CH », « en-US »).
  return { lang: code, locale: system.toLowerCase().split('-')[0] === code ? system : wanted }
}

let spoken = { lang: 'en', locale: 'en-GB' }
const texts = () => TEXTS[spoken.lang]

const clock = at => new Date(at).toLocaleTimeString(spoken.locale, { hour: spoken.lang === 'en' ? 'numeric' : '2-digit', minute: '2-digit' })

// Le jour de la semaine en abrégé. Certaines langues n'abrègent pas (« sábado » en portugais) : trois lettres suffisent alors.
export function weekday(at, locale) {
  const name = new Date(at).toLocaleDateString(locale, { weekday: 'short' })
  return name.length > 4 ? name.slice(0, 3) : name
}

/** « ven. 9 », « Fri 9 », « Fr., 9. » : le libellé d'un jour sous sa barre. */
export function dayLabel(at, locale) {
  const date = new Date(at)
  const name = date.toLocaleDateString(locale, { weekday: 'short' })
  return name.length > 4 ? `${name.slice(0, 3)} ${date.getDate()}` : date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })
}

function dayKey(at) {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Garde pour toujours un total par jour et par discussion : les transcripts, eux, finissent par être effacés.
// Seuls les jours entièrement couverts par le cache sont réécrits ; les plus anciens restent tels quels.
function saveHistory(file, daily, sessions, oldest) {
  let history = { days: {}, sessions: {} }
  try {
    history = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {}
  const firstWhole = dayKey(oldest + 86400000)
  for (const [day, perSession] of Object.entries(daily)) {
    if (day < firstWhole) continue
    history.days[day] = Object.fromEntries(Object.entries(perSession).map(([id, value]) => [id, Math.round(value)]))
    for (const id of Object.keys(perSession)) {
      const session = sessions.get(id)
      if (session) history.sessions[id] = { title: session.title, project: projectOf(session.cwd) }
    }
  }
  const draft = `${file}.${process.pid}.tmp`
  fs.writeFileSync(draft, JSON.stringify(history))
  fs.renameSync(draft, file)
}

function resetLabel(at, now) {
  if (!Number.isFinite(at)) return ''
  const isToday = new Date(at).toDateString() === new Date(now).toDateString()
  return isToday ? texts().at(clock(at), new Date(at).getHours()) : `${weekday(at, spoken.locale)} ${clock(at)}`
}

function projectOf(cwd) {
  if (!cwd) return texts().unknown
  if (/scratch-workspaces/i.test(cwd)) return texts().noFolder
  return cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd
}

export function scan({ projectsDir, cachePath, now, windows: asked, resets = {}, lang }) {
  // Le module appelant ne connaît pas le fuseau : 'midnight' est résolu ici, en heure locale.
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const windows = asked.map(w => (w.start === 'midnight' ? { ...w, start: midnight.getTime() } : w))
  const cache = loadCache(cachePath)
  // Lire la langue du système lance un petit programme : le résultat est gardé dix minutes dans le cache.
  spoken = tongue(lang, () => {
    if (!cache.display || !(now - cache.display.at < 600000) || now < cache.display.at) {
      cache.display = { at: now, locale: displayLocale() ?? '' }
    }
    return cache.display.locale || undefined
  })
  const seen = new Set(cache.seen)
  const oldest = now - KEEP_DAYS * 86400000
  const transcripts = listTranscripts(projectsDir)
  const live = new Set()

  for (const { file, sessionId, isMain } of transcripts) {
    let stat
    try {
      stat = fs.statSync(file)
    } catch {
      continue
    }
    live.add(file)
    let record = cache.files[file]
    if (!record || stat.size < record.offset) {
      record = cache.files[file] = { offset: 0, sessionId, isMain, buckets: {} }
      if (!isMain) {
        // Le type et la mission de l'agent, écrits par Claude Code à côté de son transcript.
        try {
          const meta = JSON.parse(fs.readFileSync(file.replace(/\.jsonl$/, '.meta.json'), 'utf8'))
          record.type = meta.agentType
          record.desc = meta.description
        } catch {}
      }
    }
    if (stat.size > record.offset) {
      try {
        readFrom(file, record, seen)
      } catch {}
    }
    prune(record, oldest)
  }
  for (const file of Object.keys(cache.files)) {
    if (!live.has(file)) delete cache.files[file]
  }

  const sessions = new Map()
  const models = new Map()
  const daily = {}
  const fiveStart = windows.find(w => w.key === 'five')?.start ?? now - 5 * 3600000
  const slots = new Array(Math.max(1, Math.ceil((now - fiveStart) / BUCKET_MS))).fill(0)
  const dayStart = midnight
  const days = Array.from({ length: 7 }, (_, i) => ({ start: dayStart.getTime() - (6 - i) * 86400000, value: 0 }))
  const totals = Object.fromEntries(windows.map(w => [w.key, 0]))

  for (const record of Object.values(cache.files)) {
    let session = sessions.get(record.sessionId)
    if (!session) {
      session = { id: record.sessionId, title: '', cwd: '', last: 0, w: {}, models: {}, raw: [0, 0, 0, 0], parts: [0, 0, 0, 0], calls: 0, agents: 0, agentList: [], agentsBy: {} }
      sessions.set(record.sessionId, session)
    }
    if (record.isMain) {
      session.title = record.title || record.firstPrompt || session.title
      session.cwd = record.cwd || session.cwd
    } else if (!session.cwd) {
      session.cwd = record.cwd ?? ''
    }
    session.last = Math.max(session.last, record.last ?? 0)
    let subagentWeek = 0
    const agent = { week: 0, five: 0, raw: [0, 0, 0, 0], parts: [0, 0, 0, 0], calls: 0, by: {} }
    for (const [key, cell] of Object.entries(record.buckets)) {
      const split = key.indexOf('|')
      const at = Number(key.slice(0, split))
      const model = key.slice(split + 1)
      for (const window of windows) {
        // Un créneau de 10 min compte dès qu'il chevauche la fenêtre.
        if (at + BUCKET_MS <= window.start) continue
        if (window.match && !model.includes(window.match)) continue
        session.w[window.key] = (session.w[window.key] ?? 0) + cell[0]
        totals[window.key] += cell[0]
        const perModel = (models.get(model) ?? models.set(model, {}).get(model))
        perModel[window.key] = (perModel[window.key] ?? 0) + cell[0]
        if (window.key === 'week') {
          session.models[model] = (session.models[model] ?? 0) + cell[0]
          for (let i = 0; i < 4; i++) session.raw[i] += cell[i + 1]
          for (let i = 0; i < 4; i++) session.parts[i] += cell[i + 6]
          session.calls += cell[5]
          if (!record.isMain) {
            subagentWeek += cell[0]
            agent.week += cell[0]
            agent.calls += cell[5]
            for (let i = 0; i < 4; i++) {
              agent.raw[i] += cell[i + 1]
              agent.parts[i] += cell[i + 6]
            }
          }
        }
        if (window.key === 'five' && !record.isMain) {
          agent.five += cell[0]
        }
        if (!record.isMain && AGENT_KEYS.includes(window.key)) {
          const by = (agent.by[window.key] ??= { w: 0, calls: 0, raw: [0, 0, 0, 0], parts: [0, 0, 0, 0] })
          by.w += cell[0]
          by.calls += cell[5]
          for (let i = 0; i < 4; i++) {
            by.raw[i] += cell[i + 1]
            by.parts[i] += cell[i + 6]
          }
        }
      }
      if (at + BUCKET_MS > fiveStart) {
        const slot = Math.min(slots.length - 1, Math.max(0, Math.floor((at - fiveStart) / BUCKET_MS)))
        slots[slot] += cell[0]
      }
      const day = days.findLast(d => at >= d.start)
      if (day) day.value += cell[0]
    }
    session.agents += subagentWeek
    if (!record.isMain) {
      // Par période : combien d'agents de cette discussion ont travaillé, et ce qu'ils ont coûté.
      for (const [key, by] of Object.entries(agent.by)) {
        if (by.w <= 0) continue
        const sum = (session.agentsBy[key] ??= { count: 0, w: 0 })
        sum.count += 1
        sum.w += by.w
      }
    }
    if (!record.isMain && Object.values(agent.by).some(by => by.w > 0)) {
      session.agentList.push({
        by: Object.fromEntries(Object.entries(agent.by).map(([key, by]) => [key, { w: Math.round(by.w), calls: by.calls, raw: by.raw.map(Math.round), parts: by.parts.map(Math.round) }])),
        desc: record.desc || record.firstPrompt || 'Agent',
        type: record.type || 'agent',
        model: record.model || '',
        week: Math.round(agent.week),
        five: Math.round(agent.five),
        raw: agent.raw.map(Math.round),
        parts: agent.parts.map(Math.round),
        calls: agent.calls,
        first: record.first ?? 0,
        peak: record.peak ?? 0,
        last: record.last ?? 0,
      })
    }
    // L'historique : un total par jour local et par discussion.
    for (const [key, cell] of Object.entries(record.buckets)) {
      const at = Number(key.slice(0, key.indexOf('|')))
      const day = dayKey(at)
      const perDay = (daily[day] ??= {})
      perDay[record.sessionId] = (perDay[record.sessionId] ?? 0) + cell[0]
    }
  }

  cache.seen = [...seen]
  fs.mkdirSync(path.dirname(cachePath), { recursive: true })
  const draft = `${cachePath}.${process.pid}.tmp`
  fs.writeFileSync(draft, JSON.stringify(cache))
  fs.renameSync(draft, cachePath)

  const round = n => Math.round(n)
  saveHistory(path.join(path.dirname(cachePath), 'history.json'), daily, sessions, oldest)
  const roundAll = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v)]))
  return {
    now,
    // La langue du système : le module de hooks, qui ne la voit pas, affiche ses textes dans celle-ci.
    lang: spoken.lang,
    totals: roundAll(totals),
    // L'heure locale de chaque reset, écrite ici où le fuseau est connu.
    resets: Object.fromEntries(Object.entries(resets).map(([key, iso]) => [key, resetLabel(Date.parse(iso), now)])),
    sessions: [...sessions.values()]
      .filter(s => Object.values(s.w).some(v => v > 0))
      .map(s => ({
        id: s.id,
        title: s.title || `${texts().untitled} (${s.id.slice(0, 8)})`,
        project: projectOf(s.cwd),
        last: s.last,
        w: roundAll(s.w),
        models: roundAll(s.models),
        raw: s.raw.map(round),
        parts: s.parts.map(round),
        calls: s.calls,
        agents: round(s.agents),
        agentCount: s.agentList.filter(a => a.week > 0).length,
        agentsBy: Object.fromEntries(Object.entries(s.agentsBy).map(([key, sum]) => [key, { count: sum.count, w: round(sum.w) }])),
        // Les plus coûteux de chaque période : un agent des cinq dernières heures garde sa fiche même s'il pèse peu sur la semaine.
        agentList: [...new Set(AGENT_KEYS.flatMap(key => [...s.agentList].sort((a, b) => (b.by[key]?.w ?? 0) - (a.by[key]?.w ?? 0)).slice(0, AGENT_KEPT).filter(a => (a.by[key]?.w ?? 0) > 0)))].sort(
          (a, b) => b.week - a.week,
        ),
      }))
      .sort((a, b) => (b.w.week ?? 0) - (a.w.week ?? 0)),
    models: [...models.entries()].map(([name, w]) => ({ name, w: roundAll(w) })),
    slots: { start: fiveStart, step: BUCKET_MS, values: slots.map(round), from: clock(fiveStart), to: clock(now) },
    days: days.map(d => ({
      start: d.start,
      value: round(d.value),
      label: dayLabel(d.start, spoken.locale),
    })),
  }
}

if (process.argv[2] === 'lang') {
  // Appel court, au démarrage d'une discussion : seulement la langue du système.
  process.stdout.write(JSON.stringify(tongue(process.argv[3])))
} else if (process.argv[2] === '-') {
  const started = Date.now()
  const summary = scan(JSON.parse(fs.readFileSync(0, 'utf8')))
  summary.tookMs = Date.now() - started
  process.stdout.write(JSON.stringify(summary))
}
