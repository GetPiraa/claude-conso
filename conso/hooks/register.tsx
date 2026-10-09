import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentUse, Limit, Live, Period, SessionUse, Summary, Tab, View } from '../types'
import {
  PART_COLORS,
  agentCard,
  bandGauge,
  barsCard,
  donutCard,
  limitsCard,
  pulseDot,
  modelSlices,
  setMotion,
  projectCard,
  sessionCard,
  sessionRow,
  tableCard,
} from './art'
import type { LimitRow } from './art'
import { adopt, getLang, hasLang, LANGS, limitLabel, parseLang, pickLang, setLang, t } from './i18n'
import type { Lang } from './i18n'
import { addSample, alivePids, decimal, estimate, fmt, modelName, settle, staleEngines, gauge, share, toLimits, weighUsage, windowsFor } from './lib'
import type { Engine, Samples } from './lib'

const PANE = 'conso'
const FIRST_VIEW: View = { tab: 'discussions', period: 'five' }
// L'onglet Agents ne dessine d'abord que les plus coûteux : un bouton déplie la suite.
const FIRST_AGENTS = 8
// Ce que le scanner garde par discussion (bin/scan.mjs) : au-delà, un agent est compté mais n'a pas de fiche.
const KEPT_AGENTS = 12
const IDLE: Live = { total: 0, last: 0, steps: 0, isRunning: false }

const summaryAtom = atom({ plugin: 'conso', key: 'summary' } as const, null)
const limitsAtom = atom({ plugin: 'conso', key: 'limits' } as const, [])
const estimatesAtom = atom({ plugin: 'conso', key: 'estimates' } as const, {})
const viewAtom = atom({ plugin: 'conso', key: 'view' } as const, FIRST_VIEW)
const sessionAtom = atom({ plugin: 'conso', key: 'sessionId' } as const, '')
const errorAtom = atom({ plugin: 'conso', key: 'error' } as const, '')
const liveAtom = atom({ plugin: 'conso', key: 'live' } as const, IDLE)

const TABS: Tab[] = ['discussions', 'agents', 'modeles', 'chrono', 'aide']
const PERIODS: Period[] = ['five', 'today', 'week']

let isRunning = false
let isQueued = false
let lastRun = 0
// Lue dans plugin.json au démarrage : elle s'affiche en bas du panneau, pour vérifier qu'une mise à jour est bien passée.
let modVersion = ''
let resetTimer: { cancel: () => void } | undefined

// La langue a-t-elle déjà été demandée au système ou retrouvée dans ce qui est gardé ?
/**
 * Fait d'une langue celle des textes. Son fichier n'est lu qu'ici, la première fois qu'elle sert :
 * qui reste en français ne charge ni l'espagnol ni l'italien. Si le fichier est illisible, la langue en cours reste.
 */
async function useLang($: EngineInterface, lang: Lang): Promise<void> {
  if (hasLang(lang)) {
    setLang(lang)

    return
  }
  try {
    adopt(lang, parseLang(await $.fs.read(`${$.plugin.root}/hooks/lang/${lang}.ts`)))
  } catch {
    // Les textes restent dans la langue en cours.
  }
}

let isSpoken = false
// La langue déjà rangée dans ce qui est gardé : elle n'y est réécrite que si elle change.
let keptLang: string | undefined
// Le choix fait dans le panneau : une langue, ou « auto » pour suivre celle du système. Indéfini tant qu'il n'a pas été relu.
let choice: Lang | 'auto' | undefined
let forcedLang: string | undefined

/**
 * Règle la langue des textes et rend celle à imposer au scanner, s'il y en a une.
 * Dans l'ordre : `CONSO_LANG` (pour les tests), le choix fait dans le panneau, puis la langue du système.
 * Le module ne voit pas cette dernière : c'est le scanner, lancé avec Node, qui la lit (`found`) ; elle est gardée d'une discussion à l'autre.
 * `isReread` : relit le choix gardé, qu'une autre discussion a pu changer.
 */
async function speak($: EngineInterface, found?: string, isReread = false): Promise<string | undefined> {
  // Lue une fois : elle ne change pas en cours de session, et la bande se redessine souvent.
  forcedLang ??= (await $.env.get('CONSO_LANG')) ?? ''
  const forced = forcedLang || undefined
  if (choice === undefined || isReread) {
    try {
      const kept = await $.store.get('langChoice')
      choice = typeof kept === 'string' && kept !== '' && kept !== 'auto' ? pickLang(kept) : 'auto'
    } catch {
      choice = 'auto'
    }
  }
  const imposed = forced || (choice !== 'auto' ? choice : undefined)
  const wanted = imposed || found
  if (wanted) {
    isSpoken = true
    const lang = pickLang(wanted)
    await useLang($, lang)
    if (!imposed && keptLang !== lang) {
      keptLang = lang
      try {
        if ((await $.store.get('lang')) !== lang) {
          await $.store.set('lang', lang)
        }
      } catch {
        // Rien n'est gardé : la langue sera relue au prochain démarrage.
      }
    }

    return imposed
  }
  if (isSpoken) {
    return undefined
  }
  isSpoken = true
  try {
    const kept = await $.store.get('lang')
    if (typeof kept === 'string' && kept !== '') {
      await useLang($, pickLang(kept))

      return undefined
    }
    const ran = await $.process.run(['node', `${$.plugin.root}/bin/scan.mjs`, 'lang'], { timeoutMs: 10000 })
    await useLang($, pickLang((JSON.parse(ran.stdout) as { lang?: string }).lang))
  } catch {
    // Sans réponse, les textes restent en anglais jusqu'au premier calcul.
  }

  return undefined
}

const differs = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b)
// Ce qui change à chaque passage sans rien apprendre ne doit pas faire redessiner le panneau.
const steady = (summary: Summary | null) => (summary === null ? null : { ...summary, now: 0, tookMs: 0, slots: { ...summary.slots, to: '' } })
const sizeOf = (source: string) => {
  const found = /width="([\d.]+)" height="([\d.]+)"/.exec(source)

  return { width: Number(found?.[1] ?? 480), height: Number(found?.[2] ?? 100) }
}

// Le tour en cours : ce qui est acquis, ce qui est estimé pendant qu'une réponse s'écrit, et ce que la bande montre.
let settled = 0
let shown = 0
let stepCount = 0
let ticker: { cancel: () => void } | undefined
const pending = new Map<number, number>()
// Par agent, ce qu'a coûté la lecture du contexte à sa dernière requête : la suivante coûtera à peu près autant.
const lastRead = new Map<string, number>()
const SCALE = 1.15

const goal = () => {
  let total = settled
  for (const estimate of pending.values()) {
    total += estimate
  }

  return Math.round(total)
}

/** Fait monter le chiffre affiché vers le total réel par petits pas, au lieu d'un saut par requête. */
function chase($: EngineInterface): void {
  if (ticker) {
    return
  }
  ticker = $.clock.every(120, () => {
    const gap = goal() - shown
    if (gap <= 0) {
      ticker?.cancel()
      ticker = undefined

      return
    }
    shown += Math.max(Math.ceil(gap * 0.12), Math.min(gap, 80))
    void update($, liveAtom, live => ({ ...live, total: shown, isRunning: true }))
  })
}

const liveText = (total: number) => (total >= 1e6 ? `${decimal(total / 1e6, 2)} M` : fmt(total))

/** Change de vue et note l'instant : les cartes dessinées dans la seconde qui suit jouent leur animation, sans second dessin. */
async function flash($: EngineInterface, change: Partial<View>, isOpening = false): Promise<void> {
  const freshAt = Date.now()
  await update($, viewAtom, now => ({ ...now, ...change, freshAt, ...(isOpening ? { openedAt: freshAt } : {}) }))
}

/** Pourquoi cet agent a coûté ce qu'il a coûté : sa cause principale, puis son coût de départ. */
function agentWhy(agent: AgentUse): string[] {
  const total = agent.parts.reduce((sum, part) => sum + part, 0)
  const top = agent.parts.indexOf(Math.max(...agent.parts))
  const part = t().pct(share(agent.parts[top] ?? 0, total))
  const calls = Math.max(1, agent.calls)
  const main =
    top === 2
      ? t().whyReread(part, agent.calls, fmt((agent.raw[2] ?? 0) / calls))
      : top === 3
        ? t().whyCached(part, fmt(agent.raw[3] ?? 0))
        : top === 1
          ? t().whyWritten(part, fmt(agent.raw[1] ?? 0))
          : t().whyPlain(part, fmt(agent.raw[0] ?? 0))

  return [main, t().whyStart(fmt(agent.first))]
}

async function refresh($: EngineInterface, isFresh: boolean, isForced = false): Promise<void> {
  // L'app signale une mesure à chaque requête : un recalcul toutes les dix secondes suffit.
  if (!isForced && Date.now() - lastRun < 10000) {
    return
  }
  if (isRunning) {
    isQueued = true

    return
  }
  isRunning = true
  lastRun = Date.now()
  try {
    const now = await $.clock.now()
    const usage = await $.session.usage()
    const measured = toLimits(usage.rateLimits, now)
    const kept = ((await $.store.get('limits')) as Limit[] | undefined) ?? []
    const limits = settle(measured, kept, now)
    // Dans une session cloud (un fil de projet), seuls les transcripts de la machine distante sont visibles :
    // les pourcentages restent justes, mais on n'en déduit aucune limite en tokens.
    const isCloud = (await $.env.get('CLAUDE_CODE_REMOTE')) === 'true'
    // Seule une mesure que l'app vient de donner, pour une fenêtre encore ouverte, sert à apprendre la limite.
    const current = new Set(measured.filter(limit => limit.resetsAt === undefined || Date.parse(limit.resetsAt) > now).map(limit => limit.key))
    const isMeasured = isFresh && current.size > 0 && !isCloud
    if (measured.length > 0) {
      await $.store.set('limits', limits)
    }
    // Au prochain reset, l'affichage se remet à jour tout de suite, sans attendre la minute suivante.
    const untilReset = Math.min(...limits.map(limit => (limit.resetsAt ? Date.parse(limit.resetsAt) - now : Infinity)))
    if (untilReset > 0 && untilReset < 8 * 3600000) {
      resetTimer?.cancel()
      resetTimer = $.clock.after(untilReset + 1500, () => void refresh($, false, true))
    }

    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
    const resets: Record<string, string> = {}
    for (const limit of limits) {
      if (limit.resetsAt !== undefined) {
        resets[limit.key] = limit.resetsAt
      }
    }
    const forced = await speak($, undefined, true)
    const asked = {
      ...(forced ? { lang: forced } : {}),
      projectsDir: `${home}/.claude/projects`,
      cachePath: `${home}/.claude/conso-cache/scan.json`,
      now,
      windows: windowsFor(limits, now),
      resets,
    }
    const ran = await $.process.run(['node', `${$.plugin.root}/bin/scan.mjs`, '-'], {
      stdin: JSON.stringify(asked),
      timeoutMs: 180000,
    })
    if (ran.exitCode !== 0) {
      throw new Error(ran.stderr.slice(0, 200) || t().scanFailed(ran.exitCode))
    }
    const summary = JSON.parse(ran.stdout) as Summary
    await speak($, summary.lang)

    let samples = ((await $.store.get('samples')) as Samples | undefined) ?? {}
    if (isMeasured) {
      const before = samples
      for (const limit of limits) {
        if (current.has(limit.key)) {
          samples = addSample(samples, limit.key, limit.percentUsed, summary.totals[limit.key] ?? 0, now, limit.start)
        }
      }
      if (samples !== before) {
        await $.store.set('samples', samples)
      }
    }
    const estimates: Record<string, number> = {}
    for (const limit of isCloud ? [] : limits) {
      // Sans mesure gardée, la lecture du moment donne déjà un ordre de grandeur.
      const single = addSample({}, limit.key, limit.percentUsed, summary.totals[limit.key] ?? 0, now)[limit.key]
      const found = estimate(samples[limit.key]) ?? estimate(single)
      if (found !== undefined) {
        estimates[limit.key] = found
      }
    }

    try {
      if (isCloud) {
        throw new Error('pas de relevé local dans le cloud')
      }
      const seeds = JSON.parse(await $.fs.read(`${home}/.claude/conso-cache/seeds.json`)) as Samples
      for (const [key, list] of Object.entries(seeds)) {
        const found = estimates[key] === undefined ? estimate(list) : undefined
        if (found !== undefined) {
          estimates[key] = found
        }
      }
    } catch {
      // Pas de relevé manuel : ces limites restent sans estimation.
    }

    if (differs(await read($, limitsAtom), limits)) {
      await update($, limitsAtom, () => limits)
    }
    if (differs(await read($, estimatesAtom), estimates)) {
      await update($, estimatesAtom, () => estimates)
    }
    if (differs(steady(await read($, summaryAtom)), steady(summary))) {
      await update($, summaryAtom, () => summary)
      // Gardé d'une discussion à l'autre : la suivante affiche ces chiffres dès son ouverture.
      await $.store.set('summary', summary)
      await $.store.set('estimates', estimates)
    }
    if ((await read($, errorAtom)) !== '') {
      await update($, errorAtom, () => '')
    }
  } catch (error) {
    await update($, errorAtom, () => String(error).slice(0, 200))
  } finally {
    isRunning = false
    if (isQueued) {
      isQueued = false
      void refresh($, false, true)
    }
  }
}

/** Les discussions qui tournent encore sur un moteur d'avant le mod, triées entre celles qui travaillent et celles au repos. */
async function findStale($: EngineInterface): Promise<{ busy: Engine[]; idle: Engine[] }> {
  const profile = await $.env.get('USERPROFILE')
  const isWindows = profile !== undefined
  const home = profile ?? (await $.env.get('HOME')) ?? ''
  const folder = `${home}/.claude/sessions`
  const engines: Engine[] = []
  for (const entry of await $.fs.list(folder)) {
    if (entry.kind !== 'file' || !/^\d+\.json$/.test(entry.name)) {
      continue
    }
    try {
      const read = JSON.parse(await $.fs.read(`${folder}/${entry.name}`)) as Partial<Engine>
      if (typeof read.pid === 'number' && typeof read.sessionId === 'string' && typeof read.startedAt === 'number') {
        engines.push({ pid: read.pid, sessionId: read.sessionId, name: read.name ?? t().untitled, status: read.status ?? '', startedAt: read.startedAt })
      }
    } catch {
      // Un fichier illisible : cette discussion est laissée tranquille.
    }
  }
  // Seuls les processus claude.exe réellement en vie comptent : un numéro réattribué à un autre programme n'en est pas un.
  const listed = await $.process.run(isWindows ? ['tasklist', '/FI', 'IMAGENAME eq claude.exe', '/FO', 'CSV', '/NH'] : ['ps', '-axo', 'pid=,comm='])
  const alive = alivePids(listed.stdout, isWindows)
  const installedAt = (await $.fs.stat(`${$.plugin.root}/.claude-plugin/plugin.json`)).mtimeMs

  return staleEngines(engines, alive, await $.session.id(), installedAt)
}

function periodLabel(period: Period): string {
  return t().periods[period]
}

function limitRows(summary: Summary, limits: readonly Limit[], estimates: Record<string, number>): LimitRow[] {
  if (limits.length === 0) {
    return [
      { label: t().periods.five, used: summary.totals.five ?? 0 },
      { label: t().periods.week, used: summary.totals.week ?? 0 },
    ]
  }
  const rows: LimitRow[] = limits.map(limit => ({
    label: limitLabel(limit.key),
    percent: limit.percentUsed,
    used: summary.totals[limit.key] ?? 0,
    cap: estimates[limit.key],
    reset: summary.resets?.[limit.key],
  }))
  if (!limits.some(limit => limit.key === 'fable') && (summary.totals.fable ?? 0) > 0) {
    const used = summary.totals.fable ?? 0
    const cap = estimates.fable
    rows.push(
      cap
        ? { label: `${limitLabel('fable')} (${t().estimated})`, percent: Math.min(100, (used / cap) * 100), used, cap, reset: summary.resets?.week }
        : { label: limitLabel('fable'), used },
    )
  }

  return rows
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await speak($)
    await $.command.register({
      name: 'conso',
      description: t().cmdOpen,
    })
    await $.command.register({
      name: 'conso-refresh',
      description: t().cmdRefresh,
    })
    try {
      modVersion = String((JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)) as { version?: string }).version ?? '')
    } catch {
      modVersion = ''
    }
    const sessionId = await $.session.id()
    await update($, sessionAtom, () => sessionId)
    // Les derniers chiffres connus s'affichent tout de suite ; le recalcul les remplace juste après.
    if ((await read($, summaryAtom)) === null) {
      const kept = (await $.store.get('summary')) as Summary | undefined
      const keptLimits = ((await $.store.get('limits')) as Limit[] | undefined) ?? []
      const keptEstimates = ((await $.store.get('estimates')) as Record<string, number> | undefined) ?? {}
      if (kept) {
        if (kept.lang) {
          await speak($, kept.lang)
        }
        await update($, limitsAtom, () => settle([], keptLimits, Date.now()))
        await update($, estimatesAtom, () => keptEstimates)
        await update($, summaryAtom, () => kept)
      }
    }
    $.clock.after(300, () => void refresh($, false, true))
    $.clock.every(60000, () => void refresh($, false, true))

    return next(e)
  })

  on('session.measure', ($, e, next) => {
    void refresh($, true)

    return next(e)
  })

  // Le compteur du tour repart de zéro à chaque message envoyé.
  on('prompt.submit', async ($, e, next) => {
    settled = 0
    shown = 0
    pending.clear()
    await update($, liveAtom, () => ({ total: 0, last: 0, steps: 0, isRunning: true }))

    return next(e)
  })

  // Chaque requête au modèle, sous-agents compris, ajoute ce qu'elle a coûté.
  // Pendant qu'elle s'écrit, son coût est estimé (contexte relu, puis texte produit) ; à la fin, le vrai compte le remplace.
  on('turn.step', async function* ($, e, next) {
    stepCount += 1
    const id = stepCount
    const agent = e.agentId ?? 'main'
    if (id === 1) {
      // Après un rechargement du mod en plein tour, on repart du chiffre déjà affiché.
      const live = await read($, liveAtom)
      if (live.isRunning && settled === 0) {
        settled = live.total
        shown = live.total
      }
    }
    const perOutput = weighUsage(e.model, { input_tokens: 0, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })
    let estimated = lastRead.get(agent) ?? 0
    pending.set(id, estimated)
    chase($)
    try {
      const stream = next(e)
      let step = await stream.next()
      while (!step.done) {
        const chunk = step.value
        const written = chunk.kind === 'text' || chunk.kind === 'thinking' ? chunk.text.length : chunk.kind === 'input' ? chunk.json.length : 0
        if (written > 0) {
          // Environ 3,5 caractères par token.
          estimated += (written / 3.5) * perOutput
          pending.set(id, estimated)
          chase($)
        }
        yield chunk
        step = await stream.next()
      }
      const response = step.value
      const usage = response.usage
      if (usage) {
        const cost = Math.round(weighUsage(usage.model, usage))
        settled += cost
        lastRead.set(agent, weighUsage(usage.model, { ...usage, output_tokens: 0, cache_creation_input_tokens: 0 }))
        await update($, liveAtom, live => ({ ...live, last: cost, steps: live.steps + 1 }))
      }

      return response
    } finally {
      pending.delete(id)
      chase($)
    }
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      ticker?.cancel()
      ticker = undefined
      shown = goal()
      await update($, liveAtom, live => ({ ...live, total: shown, last: 0, isRunning: false }))
      await refresh($, true, true)
    }

    return done
  })

  on('command.run', { command: 'conso' }, async $ => {
    await speak($)
    await flash($, {}, true)
    await $.ui.open({ id: PANE, title: 'Conso', focus: true })

    return { text: t().paneOpened }
  })

  on('command.run', { command: 'conso-refresh' }, async $ => {
    await speak($)
    const isWindows = (await $.env.get('USERPROFILE')) !== undefined
    const { busy, idle } = await findStale($)
    if (busy.length > 0) {
      // Rien n'est touché tant qu'une de ces discussions travaille : arrêter son moteur couperait son travail.
      return {
        text: `${t().refreshBusy(busy.length)}\n${busy.map(engine => `- ${engine.name}`).join('\n')}\n${t().refreshWait}`,
      }
    }
    if (idle.length === 0) {
      return { text: t().refreshNone }
    }
    const done: string[] = []
    const failed: string[] = []
    for (const engine of idle) {
      const stopped = await $.process.run(isWindows ? ['taskkill', '/F', '/PID', String(engine.pid)] : ['kill', '-TERM', String(engine.pid)])
      ;(stopped.exitCode === 0 ? done : failed).push(engine.name)
    }

    return {
      text:
        (done.length > 0 ? `${t().refreshDone(done.length)}\n${done.map(name => `- ${name}`).join('\n')}\n${t().refreshReopen}` : '') +
        (failed.length > 0 ? `\n${t().refreshFailed(failed.join(', '))}` : ''),
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }
    const [summary, limits, estimates, sessionId, failure, live] = await Promise.all([
      read($, summaryAtom),
      read($, limitsAtom),
      read($, estimatesAtom),
      read($, sessionAtom),
      read($, errorAtom),
      read($, liveAtom),
    ])
    await speak($, summary?.lang)
    const s = t()
    const els = $.ui.resolve(e)
    const { Box, Button, Text } = els
    const Svg = e.surface !== 'terminal' && 'Svg' in els ? els.Svg : undefined
    const open = async () => {
      await flash($, {}, true)
      await $.ui.open({ id: PANE, title: 'Conso', focus: true })
    }
    const sized = (source: string) => ({ source, ...sizeOf(source) })
    const turn = (
      <Box flexDirection="row" columnGap={1} alignItems="center">
        <Text bold>{s.turn}</Text>
        {Svg && <Svg {...sized(pulseDot(live.isRunning))} alt={live.isRunning ? s.running : s.idle} />}
        <Text color="claude" bold>
          {liveText(live.total)}
        </Text>
        <Text dimColor>{s.tokens}</Text>
      </Box>
    )

    if (summary === null) {
      return (
        <Box flexDirection="row" columnGap={2} alignItems="center">
          {turn}
          <Text dimColor>{failure ? `${s.unavailable}${s.colon}${failure}` : s.computingBand}</Text>
        </Box>
      )
    }

    const mine = summary.sessions.find(one => one.id === sessionId)
    const five = summary.totals.five ?? 0

    const fiveLimit = limits.find(limit => limit.key === 'five')
    const fiveCap = estimates.five
    const facts = [
      `${s.periods.five}${s.colon}${fmt(five)}${fiveCap ? ` / ≈ ${fmt(fiveCap)}` : ''} ${s.tokens}`,
      fiveLimit && summary.resets?.five ? `${s.reset} ${summary.resets.five}` : '',
      mine ? `${s.thisChat} ${fmt(mine.w.five ?? 0)} (${s.pct(share(mine.w.five ?? 0, five))})` : '',
    ].filter(fact => fact !== '')

    return (
      <Box flexDirection="column" width="100%">
      <Box flexDirection="row" flexWrap="wrap" columnGap={4} alignItems="center" justifyContent="center">
        {turn}
        {limits.length === 0 && (
          <Text>
            5 h {fmt(five)} · {s.weekLower} {fmt(summary.totals.week ?? 0)}
          </Text>
        )}
        {limits.map(limit => {
          const percent = Math.round(limit.percentUsed)
          const short = limit.key === 'five' ? '5 h' : limit.key === 'week' ? s.weekly : limitLabel(limit.key).replace(`${s.weekly} · `, '')

          return (
            <Box flexDirection="row" columnGap={1} alignItems="center">
              <Text bold>{short}</Text>
              {Svg ? (
                <Svg {...sized(bandGauge(limit.percentUsed, limit.key === 'five' ? 84 : 56))} alt={`${short}${s.colon}${s.pct(percent)}`} />
              ) : (
                <Text color="claude">{gauge(limit.percentUsed, limit.key === 'five' ? 10 : 6)}</Text>
              )}
              <Text color={limit.percentUsed >= 85 ? 'error' : 'claude'} bold>
                {s.pct(percent)}
              </Text>
            </Box>
          )
        })}
      </Box>
      <Box flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="center" columnGap={3}>
        <Text dimColor>{facts.join('\u00A0\u00A0\u00A0·\u00A0\u00A0\u00A0')}</Text>
        <Button key="details" label={s.details} onPress={open} />
      </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const [summary, limits, estimates, view, sessionId, failure] = await Promise.all([
      read($, summaryAtom),
      read($, limitsAtom),
      read($, estimatesAtom),
      read($, viewAtom),
      read($, sessionAtom),
      read($, errorAtom),
    ])
    await speak($, summary?.lang)
    const s = t()
    const els = $.ui.resolve(e)
    const { Box, Button, Text, Markdown } = els
    const Svg = e.surface !== 'terminal' && 'Svg' in els ? els.Svg : undefined
    const show = (change: Partial<View>) => () => flash($, change)
    // Une surface sans Svg lit le même contenu, en clair. La taille est fixée : sans elle la carte s'étire à la largeur du panneau.
    const pic = (source: string, alt: string) => {
      const size = sizeOf(source)

      return Svg ? <Svg source={source} alt={alt} width={Math.round(size.width * SCALE)} height={Math.round(size.height * SCALE)} /> : <Text>{alt}</Text>
    }

    if (summary === null) {
      return (
        <Box padding={1}>
          <Text dimColor>{failure ? `${s.unavailable}${s.colon}${failure}` : s.computingPane}</Text>
        </Box>
      )
    }

    // La carte des limites ne s'anime qu'à l'ouverture ; le reste, à chaque changement de vue.
    const sinceOpen = Date.now() - (view.openedAt ?? 0)
    setMotion(sinceOpen < 1400 ? sinceOpen : undefined)
    const rows = limitRows(summary, limits, estimates)
    const header = pic(
      limitsCard(rows),
      rows
        .map(row => `${row.label}${s.colon}${row.percent === undefined ? '' : `${s.pct(Math.round(row.percent))}, `}${fmt(row.used)}${row.cap ? ` ${s.of} ≈ ${fmt(row.cap)}` : ''} ${s.tokens}`)
        .join(' ; '),
    )

    // Le choix de la langue : « Auto » suit le système, sinon la langue choisie est gardée pour toutes les discussions.
    // Son fichier n'est lu qu'à ce moment-là ; le scanner est relancé pour que les dates et les heures suivent.
    const pick = async (code: Lang | 'auto') => {
      choice = code
      await $.store.set('langChoice', code)
      // « Auto » reprend tout de suite la dernière langue lue sur le système.
      await useLang($, code === 'auto' ? pickLang(keptLang ?? getLang()) : code)
      await update($, viewAtom, now => ({ ...now, langOpen: false, freshAt: Date.now() }))
      await refresh($, false, true)
    }
    const picked = choice ?? 'auto'
    const codes = ['auto', ...LANGS] as (Lang | 'auto')[]
    // En automatique, la case montre la langue réellement utilisée : « FR · auto ».
    const system = picked === 'auto' ? getLang() : keptLang ? pickLang(keptLang) : undefined
    const nameOf = (code: Lang | 'auto') => (code === 'auto' ? (system ? `${system.toUpperCase()} · auto` : 'Auto') : code.toUpperCase())
    // Une liste déroulante quand la surface en a une : elle s'ouvre par-dessus le panneau, sans rien pousser vers le bas,
    // et défile d'elle-même quand les langues deviennent nombreuses. Sinon, un bouton qui déplie une colonne.
    const langBar = (
      <Box flexDirection="column" alignItems="flex-end" width="100%">
        {'Select' in els ? (
          <els.Select key="lang" label="🌐" value={picked} options={codes.map(code => ({ value: code, label: nameOf(code) }))} onSelect={value => void pick(value as Lang | 'auto')} />
        ) : (
          <Button key="lang" label={`🌐 ${getLang().toUpperCase()}`} variant="secondary" onPress={() => update($, viewAtom, now => ({ ...now, langOpen: !now.langOpen }))} />
        )}
        {!('Select' in els) &&
          view.langOpen &&
          codes.map(code => <Button key={`lang-${code}`} label={nameOf(code)} variant={picked === code ? 'primary' : 'secondary'} onPress={() => pick(code)} />)}
      </Box>
    )

    const sinceChange = Date.now() - (view.freshAt ?? 0)
    setMotion(sinceChange < 1400 ? sinceChange : undefined)

    const tabs = (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {TABS.map(tab => (
          <Button
            key={`tab-${tab}`}
            label={s.tabs[tab]}
            variant={view.tab === tab && !view.sessionId ? 'primary' : 'secondary'}
            onPress={show({ tab, sessionId: undefined })}
          />
        ))}
      </Box>
    )
    const periods = (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {PERIODS.map(one => (
          <Button
            key={`period-${one}`}
            label={s.periods[one]}
            variant={view.period === one ? 'primary' : 'secondary'}
            onPress={show({ period: one })}
          />
        ))}
      </Box>
    )

    const period = view.period
    const total = summary.totals[period] ?? 0
    const cap = period === 'today' ? undefined : estimates[period]
    // Le pourcentage officiel de la période, quand l'app le donne : les parts « de la limite » en découlent,
    // pour rester d'accord avec lui même quand la limite estimée en tokens s'en écarte.
    const official = period === 'today' ? undefined : limits.find(limit => limit.key === period)?.percentUsed
    const ofCap = (value: number) => (official !== undefined && total > 0 ? Math.round((value / total) * official) : cap ? share(value, cap) : undefined)

    const detail = (one: SessionUse) => {
      const weighed = one.parts.reduce((sum, part) => sum + part, 0)
      const tiles = PERIODS.map(p => ({
        label: s.periods[p],
        value: one.w[p] ?? 0,
        note: s.ofUsage(s.pct(share(one.w[p] ?? 0, summary.totals[p] ?? 0))),
      }))
      const parts = one.parts
        .map((value, i) => ({ name: s.parts[i] ?? '', value, color: PART_COLORS[i] ?? '#D4A27F' }))
        .filter(part => part.value > 0)
        .sort((a, b) => b.value - a.value)
      const models = modelSlices(Object.entries(one.models).map(([name, value]) => ({ name, value })))

      return (
        <Box flexDirection="column" rowGap={1}>
          <Box flexDirection="row">
            <Button key="back" label={s.back} onPress={show({ sessionId: undefined })} />
          </Box>
          {pic(
            sessionCard(one.title, `${one.project}${one.id === sessionId ? ` · ${s.thisChat}` : ''}`, tiles),
            `${one.title} (${one.project}) : ${tiles.map(tile => `${tile.label} ${fmt(tile.value)}, ${tile.note}`).join(' ; ')}`,
          )}
          {pic(
            donutCard(`${s.whereFrom} · ${s.days7}`, parts, false),
            `${s.whereFrom}${s.colon}${parts.map(part => `${s.pct(share(part.value, weighed))} · ${part.name}`).join(' ; ')}`,
          )}
          {pic(donutCard(`${s.models} · ${s.days7}`, models, true), `${s.models}${s.colon}${models.map(model => `${model.name} ${fmt(model.value)}`).join(' ; ')}`)}
          <Text dimColor>
            {s.detailFoot(one.calls, fmt(one.calls > 0 ? weighed / one.calls : 0), s.pct(share(one.agents, weighed)))}
          </Text>
        </Box>
      )
    }

    const discussions = () => {
      const active = summary.sessions.filter(one => (one.w[period] ?? 0) > 0)
      const projects = new Map<string, SessionUse[]>()
      for (const one of active) {
        projects.set(one.project, [...(projects.get(one.project) ?? []), one])
      }
      const sum = (list: SessionUse[]) => list.reduce((all, one) => all + (one.w[period] ?? 0), 0)
      const ranked = [...projects.entries()].sort((a, b) => sum(b[1]) - sum(a[1]))
      let rank = 0

      return (
        <Box flexDirection="column" rowGap={1}>
          {ranked.length === 0 && <Text dimColor>{s.none}</Text>}
          {ranked.map(([project, list], at) => (
            <Box flexDirection="column" rowGap={1} marginTop={at === 0 ? 0 : 2}>
              {pic(
                projectCard(project, sum(list), share(sum(list), total), list.length),
                `${project} · ${fmt(sum(list))} · ${s.pct(share(sum(list), total))}`,
              )}
              {[...list]
                .sort((a, b) => (b.w[period] ?? 0) - (a.w[period] ?? 0))
                .map(one => {
                  const value = one.w[period] ?? 0
                  const part = ofCap(value)
                  const note = part === undefined ? s.ofPeriod(s.pct(share(value, total))) : `${s.pct(share(value, total))} · ${s.ofLimit(s.pct(part))}`
                  rank += 1

                  return (
                    <Box flexDirection="row" columnGap={1} alignItems="center">
                      {pic(
                        sessionRow(rank, one.title, value, share(value, total), note, one.id === sessionId),
                        `${one.title} · ${fmt(value)} · ${note}`,
                      )}
                      <Button key={`s-${one.id}`} label={s.detail} onPress={show({ sessionId: one.id })} />
                    </Box>
                  )
                })}
            </Box>
          ))}
        </Box>
      )
    }

    const agents = () => {
      const all = summary.sessions.flatMap(one => (one.agentList ?? []).map(agent => ({ agent, from: one })))
      const ranked = all.sort((a, b) => b.agent.week - a.agent.week)
      const count = summary.sessions.reduce((sum, one) => sum + (one.agentCount ?? 0), 0)
      const spent = summary.sessions.reduce((sum, one) => sum + one.agents, 0)
      const start = ranked.length > 0 ? ranked.reduce((sum, one) => sum + one.agent.first, 0) / ranked.length : 0
      if (ranked.length === 0) {
        return <Text dimColor>{s.noAgents}</Text>
      }

      return (
        <Box flexDirection="column" rowGap={1}>
          <Text dimColor>
            {s.agentsHead(count, fmt(spent), s.pct(share(spent, summary.totals.week ?? 0)), fmt(start))}
          </Text>
          {ranked.slice(0, view.allAgents ? ranked.length : FIRST_AGENTS).map(({ agent, from }) => {
            const why = agentWhy(agent)

            return pic(
              agentCard(
                agent.desc,
                `${agent.type} · ${modelName(agent.model)} · ${from.title}`,
                [
                  { label: s.shown, value: fmt(agent.peak) },
                  { label: s.start, value: fmt(agent.first) },
                  { label: s.requests, value: String(agent.calls) },
                  { label: s.use, value: fmt(agent.week) },
                ],
                why,
              ),
              `${agent.desc} (${from.title})${s.colon}${s.agentAlt(fmt(agent.peak), fmt(agent.first), agent.calls, fmt(agent.week))} ${why.join(' ')}`,
            )
          })}
          {count > ranked.length && <Text dimColor>{s.agentsKept(KEPT_AGENTS, ranked.length, count)}</Text>}
          {ranked.length > FIRST_AGENTS && (
            <Box flexDirection="row">
              <Button
                key="agents-more"
                label={view.allAgents ? s.fewerAgents : s.moreAgents(ranked.length - FIRST_AGENTS)}
                onPress={() => update($, viewAtom, now => ({ ...now, allAgents: !now.allAgents }))}
              />
            </Box>
          )}
        </Box>
      )
    }

    const models = () => {
      const slices = modelSlices(summary.models.map(one => ({ name: one.name, value: one.w[period] ?? 0 })))
      if (slices.length === 0) {
        return <Text dimColor>{s.none}</Text>
      }

      return pic(
        donutCard(`${s.models} · ${periodLabel(period)}`, slices, true),
        `${s.models}, ${periodLabel(period)}${s.colon}${slices.map(slice => `${slice.name} ${fmt(slice.value)} (${s.pct(share(slice.value, total))})`).join(' ; ')}`,
      )
    }

    const chrono = () => {
      const slots = summary.slots.values
      const days = summary.days

      return (
        <Box flexDirection="column" rowGap={1}>
          {pic(
            barsCard(`${s.periods.five} · ${s.slotsBy}`, slots, [
              { at: 0, text: summary.slots.from },
              { at: slots.length - 1, text: s.now },
            ]),
            `${s.periods.five}, ${s.fromTo(summary.slots.from, summary.slots.to)}, ${s.slotsBy}${s.colon}${slots.map(fmt).join(', ')}`,
          )}
          {pic(
            barsCard(
              s.last7,
              days.map(day => day.value),
              days.map((day, at) => ({ at, text: day.label })),
              { marks: true, bright: days.length - 1 },
            ),
            `${s.last7}${s.colon}${days.map(day => `${day.label} ${fmt(day.value)}`).join(', ')}`,
          )}
          {pic(
            tableCard(
              s.dayByDay,
              days.map(day => ({ label: day.label, value: day.value })),
              s.heads,
            ),
            s.dayTable,
          )}
        </Box>
      )
    }

    const chosen = view.sessionId ? summary.sessions.find(one => one.id === view.sessionId) : undefined
    const body = chosen ? detail(chosen) : view.tab === 'agents' ? agents() : view.tab === 'modeles' ? models() : view.tab === 'chrono' ? chrono() : view.tab === 'aide' ? <Markdown text={s.help} /> : discussions()

    return (
      <Box flexDirection="column" rowGap={1} padding={1}>
        {langBar}
        {header}
        {failure !== '' && <Text color="error">{`${s.lastFailed}${s.colon}${failure}`}</Text>}
        {tabs}
        {!chosen && (view.tab === 'discussions' || view.tab === 'modeles') && periods}
        {!chosen && view.tab === 'discussions' && (
          <Text dimColor>
            {`${periodLabel(period)}${s.colon}${fmt(total)} ${s.inTotal}${official !== undefined ? ` · ${s.ofLimit(s.pct(Math.round(official))).replace('≈ ', '')}` : cap ? ` · ${s.ofLimit(s.pct(share(total, cap)))}` : ''}`}
          </Text>
        )}
        {body}
        <Text dimColor>{`Mod Conso${modVersion ? ` · ${s.version} ${modVersion}` : ''}`}</Text>
      </Box>
    )
  })
}
