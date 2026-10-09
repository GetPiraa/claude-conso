import type { Limit } from '../types'
import { limitLabel, t } from './i18n'

export const HOUR = 3600000
export const DAY = 86400000

export type Reading = { kind: string; percentUsed: number; resetsAt?: string }
/** `w` : le début de la fenêtre (5 h ou semaine) où la mesure a été prise. */
export type Sample = { p: number; t: number; at: number; w?: number }
export type Samples = Record<string, Sample[]>

/** Un nombre à décimales, avec le séparateur de la langue en cours : "16,7" en français, "16.7" en anglais. */
export function decimal(n: number, digits: number): string {
  return n.toFixed(digits).replace('.', t().decimal)
}

/** 16745647 -> "16,7 M" ; 428819 -> "429 k" ; 950 -> "950". */
export function fmt(n: number): string {
  if (n >= 1e9) return `${decimal(n / 1e9, 2)} ${t().billion}`
  if (n >= 1e7) return `${Math.round(n / 1e6)} M`
  if (n >= 1e6) return `${decimal(n / 1e6, 1)} M`
  if (n >= 1e3) return `${Math.round(n / 1e3)} k`
  return String(Math.round(n))
}

export function share(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/** Les fenêtres du forfait que l'app rapporte, chacune avec son début. */
export function toLimits(readings: readonly Reading[], now: number): Limit[] {
  const limits: Limit[] = []
  for (const reading of readings) {
    const perModel = /^seven_day_(.+)$/.exec(reading.kind)
    const reset = reading.resetsAt ? Date.parse(reading.resetsAt) : NaN
    const startOf = (span: number) => (Number.isFinite(reset) ? reset : now + span) - span
    const base = { kind: reading.kind, percentUsed: reading.percentUsed, resetsAt: reading.resetsAt }
    if (reading.kind === 'five_hour') {
      limits.push({ ...base, key: 'five', label: limitLabel('five'), start: startOf(5 * HOUR) })
    } else if (reading.kind === 'seven_day') {
      limits.push({ ...base, key: 'week', label: limitLabel('week'), start: startOf(7 * DAY) })
    } else if (perModel) {
      const model = (perModel[1] ?? '').toLowerCase()
      limits.push({ ...base, key: model, label: limitLabel(model), start: startOf(7 * DAY), match: model })
    }
  }
  const order = (limit: Limit) => (limit.key === 'five' ? 0 : limit.key === 'week' ? 1 : 2)
  return limits.sort((a, b) => order(a) - order(b))
}

/**
 * Complète les mesures de l'app pour qu'aucune fenêtre ne disparaisse de l'affichage.
 * Une fenêtre dont l'heure de reset est passée repart de zéro à cette heure-là ; une fenêtre que l'app
 * ne rapporte plus un instant (juste après un reset, avant la réponse suivante) est reprise de la dernière connue.
 */
export function settle(read: readonly Limit[], kept: readonly Limit[], now: number): Limit[] {
  const spanOf = (limit: Limit) => (limit.key === 'five' ? 5 * HOUR : 7 * DAY)
  const renew = (limit: Limit): Limit => {
    const reset = limit.resetsAt ? Date.parse(limit.resetsAt) : NaN
    if (!(reset <= now)) return limit
    const { resetsAt: _past, ...rest } = limit
    return { ...rest, percentUsed: 0, start: reset }
  }
  const limits = read.map(renew)
  for (const old of kept) {
    const since = old.resetsAt ? Date.parse(old.resetsAt) : old.start
    // Une mesure gardée depuis plus longtemps que sa fenêtre ne dit plus rien.
    if (limits.some(limit => limit.key === old.key) || now - since > spanOf(old)) continue
    limits.push(renew(old))
  }
  const order = (limit: Limit) => (limit.key === 'five' ? 0 : limit.key === 'week' ? 1 : 2)
  return limits.sort((a, b) => order(a) - order(b))
}

/**
 * Les numéros des processus Claude en vie, lus dans la sortie de `tasklist` (Windows) ou de `ps -axo pid=,comm=` (macOS, Linux).
 * Un numéro de session réattribué à un autre programme n'y figure pas, donc n'est jamais arrêté.
 */
export function alivePids(output: string, isWindows: boolean): Set<number> {
  const alive = new Set<number>()
  if (isWindows) {
    for (const found of output.matchAll(/"claude\.exe","(\d+)"/gi)) {
      alive.add(Number(found[1]))
    }
    return alive
  }
  for (const line of output.split('\n')) {
    const found = /^\s*(\d+)\s+(.+)$/.exec(line)
    // Le moteur est le binaire « claude » ; l'application elle-même s'appelle « Claude » ou « Claude Helper ».
    if (found && /(^|\/)claude$/.test((found[2] ?? '').trim())) {
      alive.add(Number(found[1]))
    }
  }
  return alive
}

/** Le moteur d'une discussion, tel que Claude Code le décrit dans .claude/sessions. */
export type Engine = { pid: number; sessionId: string; name: string; status: string; startedAt: number }

/**
 * Les discussions dont le moteur a démarré avant l'installation du mod : elles ne l'ont pas chargé.
 * `alive` : les processus Claude réellement en vie ; un fichier de session sans processus est ignoré.
 */
export function staleEngines(
  engines: readonly Engine[],
  alive: ReadonlySet<number>,
  selfId: string,
  installedAt: number,
): { busy: Engine[]; idle: Engine[] } {
  const stale = engines.filter(engine => engine.sessionId !== selfId && alive.has(engine.pid) && engine.startedAt < installedAt)
  return { busy: stale.filter(engine => engine.status !== 'idle'), idle: stale.filter(engine => engine.status === 'idle') }
}

/** Ce que le scanner doit totaliser : les limites connues, plus 5 h, semaine et aujourd'hui. */
export function windowsFor(limits: readonly Limit[], now: number): { key: string; start: number | 'midnight'; match?: string }[] {
  const windows: { key: string; start: number | 'midnight'; match?: string }[] = limits.map(limit => ({
    key: limit.key,
    start: limit.start,
    ...(limit.match ? { match: limit.match } : {}),
  }))
  if (!windows.some(w => w.key === 'five')) windows.push({ key: 'five', start: now - 5 * HOUR })
  if (!windows.some(w => w.key === 'week')) windows.push({ key: 'week', start: now - 7 * DAY })
  // La limite Fable n'est pas toujours rapportée : sa conso de la semaine est comptée quand même.
  if (!windows.some(w => w.key === 'fable')) {
    windows.push({ key: 'fable', start: windows.find(w => w.key === 'week')?.start ?? now - 7 * DAY, match: 'fable' })
  }
  windows.push({ key: 'today', start: 'midnight' })
  return windows
}

/**
 * Garde une mesure (pourcentage officiel, tokens mesurés) quand elle apprend quelque chose.
 * `window` : le début de la fenêtre mesurée. Chaque fenêtre ne garde que sa mesure la plus récente, la plus précise :
 * l'estimation s'appuie ainsi sur plusieurs fenêtres passées au lieu de suivre la seule en cours, et varie moins de l'une à l'autre.
 */
export function addSample(samples: Samples, key: string, p: number, t: number, at: number, window?: number): Samples {
  if (p < 5 || t <= 0) return samples
  // Les mesures de plus de dix jours sont oubliées : après un changement d'abonnement, l'estimation suit la nouvelle limite.
  const list = (samples[key] ?? []).filter(sample => at - sample.at < 10 * DAY)
  const last = list[list.length - 1]
  if (last && last.p === p && last.w === window && Math.abs(last.t - t) < last.t * 0.02) return samples
  if (window === undefined) return { ...samples, [key]: [...list, { p, t, at }].slice(-30) }
  // Les mesures d'avant ce classement par fenêtre venaient toutes de la même : elles laissent la place.
  const others = list.filter(sample => sample.w !== undefined && sample.w !== window)
  return { ...samples, [key]: [...others, { p, t, at, w: window }].slice(-30) }
}

/**
 * La limite estimée : tokens mesurés rapportés aux pourcentages officiels.
 * Ce qui est consommé ailleurs que sur ce PC (autre appareil, onglet Discussion, cloud) fait monter le pourcentage
 * sans rien ajouter aux tokens mesurés : une fenêtre peut donc donner une limite trop basse, jamais trop haute.
 * La plus haute des mesures solides (20 % et plus, où l'arrondi du pourcentage pèse peu) est la plus proche de la vraie.
 */
export function estimate(list: readonly Sample[] | undefined): number | undefined {
  if (!list || list.length === 0) return undefined
  const solid = list.filter(sample => sample.p >= 20)
  if (solid.length > 0) return Math.round(Math.max(...solid.map(sample => sample.t / (sample.p / 100))))
  const tokens = list.reduce((sum, s) => sum + s.t, 0)
  const percent = list.reduce((sum, s) => sum + s.p, 0)
  return percent > 0 ? Math.round(tokens / (percent / 100)) : undefined
}

/** "claude-opus-5-5" -> "Opus 5.5". */
export function modelName(id: string): string {
  const found = /claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/.exec(id)
  if (!found) return id
  return `${capital(found[1] ?? '')} ${found[2]}${found[3] ? `.${found[3]}` : ''}`
}

export function gauge(percent: number, cells = 10): string {
  const full = Math.max(0, Math.min(cells, Math.round((percent / 100) * cells)))
  return '▰'.repeat(full) + '▱'.repeat(cells - full)
}

export function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * La largeur approximative d'un texte dessiné, en pixels : les capitales et les chiffres prennent plus de place que les minuscules.
 * Volontairement large, pour qu'un texte jugé « à sa place » le soit aussi avec les polices d'un autre système.
 */
export function widthOf(text: string, size: number): number {
  let ems = 0
  for (const char of text) {
    ems += /[ .,:;'’|!·ijlI]/.test(char) ? 0.3 : /[MW@%]/.test(char) ? 0.95 : /[A-ZÀ-Þ]/.test(char) ? 0.74 : /[0-9]/.test(char) ? 0.6 : /[ftr()\-]/.test(char) ? 0.4 : /[mw]/.test(char) ? 0.85 : 0.56
  }
  return ems * size * 1.06
}

/** Coupe un texte pour qu'il tienne dans `width` pixels à la taille `size`. */
export function fit(text: string, width: number, size: number): string {
  if (widthOf(text, size) <= width) return text
  let kept = text
  while (kept.length > 1 && widthOf(`${kept}…`, size) > width) kept = kept.slice(0, -1)
  return `${kept.trimEnd()}…`
}

// Prix API en $ par million de tokens : [entrée, sortie, lecture de cache] ; la même table que bin/scan.mjs.
const PRICES: [RegExp, [number, number, number]][] = [
  [/fable|mythos/, [10, 50, 0.25]],
  [/opus-5-5/, [4, 20, 0.2]],
  [/opus/, [5, 25, 0.5]],
  [/sonnet-5/, [2, 10, 0.2]],
  [/sonnet/, [3, 15, 0.3]],
  [/haiku-5/, [0.1, 0.5, 0.01]],
  [/haiku/, [1, 5, 0.1]],
]

export type RawUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

/** Une réponse de Claude en tokens pondérés (1 = un token d'entrée Opus 5.5), le cache écrit compté à 1 h. */
export function weighUsage(model: string, usage: RawUsage): number {
  const [input, output, read] = PRICES.find(([re]) => re.test(model))?.[1] ?? [4, 20, 0.2]
  const cost =
    usage.input_tokens * input +
    usage.output_tokens * output +
    usage.cache_read_input_tokens * read +
    usage.cache_creation_input_tokens * input * 2
  return cost / 4
}
