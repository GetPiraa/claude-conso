import { expect, mock, test } from 'claude-code/testing'

import type { Summary } from '../types'
import { mockLangs } from './langs'

const NOW = Date.parse('2026-10-09T12:00:00Z')
const SUMMARY: Summary = {
  now: NOW,
  lang: 'fr',
  totals: { five: 16000000, week: 110000000, fable: 49000000, today: 30000000 },
  sessions: [
    {
      id: 'abc',
      title: 'Maquette du quartier',
      project: 'Projet-A',
      last: NOW,
      w: { five: 12000000, week: 90000000, today: 20000000, fable: 49000000 },
      models: { 'claude-opus-5-5': 41000000, 'claude-fable-5-1': 49000000 },
      raw: [1000, 2000000, 500000000, 17000000],
      parts: [1000, 14000000, 28000000, 48000000],
      calls: 1000,
      agents: 9000000,
      agentCount: 1,
      agentList: [
        { desc: 'Relevé du site', type: 'general-purpose', model: 'claude-fable-5-1', week: 1400000, five: 0, raw: [1000, 5000, 250000, 600000], parts: [2000, 5000, 250000, 1200000], calls: 24, first: 52000, peak: 255000, last: NOW },
      ],
    },
    {
      id: 'def',
      title: 'Veille marché',
      project: 'Sans dossier',
      last: NOW,
      w: { five: 4000000, week: 20000000, today: 10000000 },
      models: { 'claude-opus-5-5': 20000000 },
      raw: [300, 200000, 40000000, 500000],
      parts: [300, 1000000, 2000000, 1000000],
      calls: 100,
      agents: 0,
    },
  ],
  models: [
    { name: 'claude-opus-5-5', w: { five: 16000000, week: 61000000, today: 30000000 } },
    { name: 'claude-fable-5-1', w: { week: 49000000, fable: 49000000 } },
  ],
  slots: { start: NOW - 2 * 3600000, step: 600000, values: [1, 2, 3, 0, 5, 6, 7, 8, 9, 10, 11, 12], from: '12:00', to: '14:00' },
  days: [1, 2, 3, 4, 5, 6, 7].map(n => ({ start: NOW - (7 - n) * 86400000, value: n * 1000000, label: `j${n}` })),
}

for (const surface of ['desktop', 'terminal'] as const) {
  test(`la bande et le panneau montrent la conso (${surface})`, async ($, on) => {
    mock.clock(on, { now: NOW })
    mock.store(on)
    mock.env(on, { USERPROFILE: 'C:/Users/test' })
    mockLangs(on)
    let asked = ''
    on('session.usage', async () => ({ value: {
      startedAt: 0,
      context: {} as never,
      rateLimits: [
        { kind: 'five_hour', percentUsed: 32, resetsAt: '2026-10-09T14:30:00Z' },
        { kind: 'seven_day', percentUsed: 50, resetsAt: '2026-10-12T18:00:00Z' },
        { kind: 'seven_day_fable', percentUsed: 62, resetsAt: '2026-10-12T18:00:00Z' },
      ],
    } }) as never)
    on('process.run', async (_$, e) => {
      const input = e as { stdin?: string; init?: { stdin?: string } }
      asked = input.stdin ?? input.init?.stdin ?? JSON.stringify(e)

      return { value: { exitCode: 0, stdout: JSON.stringify(SUMMARY), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as never
    })
    on('turn.complete', async () => ({ text: '' }) as never)

    await $.turn.complete({ turnId: 't1', answer: '' } as never)

    const windows = (JSON.parse(asked) as { windows: { key: string }[] }).windows.map(w => w.key)
    expect(windows).toEqual(['five', 'week', 'fable', 'today'])

    const seen = async (ui: { drawn: () => Promise<unknown> }) => JSON.stringify(await ui.drawn())

    const band = await $.ui.mount({ plugin: 'conso', surface, component: 'AbovePrompt', props: { bodyColumns: 120 } as never })
    expect(await band.find({ key: 'details' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: /32 %/ })).toBeDefined()
    // 16 M mesurés pour 32 % officiels : la limite 5 h est estimée à 50 M.
    expect(await band.find({ type: 'Text', text: /16 M \/ ≈ 50 M/ })).toBeDefined()
    expect(await seen(band)).toMatch(/Ce tour/)
    await band.unmount()

    const pane = await $.ui.mount({ plugin: 'conso', surface, component: 'Pane', requestId: 'conso', props: { bodyColumns: 80 } as never })
    expect(await seen(pane)).toMatch(/Hebdo · Fable : 62 %, 49 M sur ≈ 79 M tokens/)
    expect(await seen(pane)).toMatch(/Projet-A · 12 M · 75 %/)
    await pane.press({ key: 'period-week' })
    expect(await seen(pane)).toMatch(/Projet-A · 90 M · 82 %/)
    await pane.press({ key: 's-abc' })
    expect(await seen(pane)).toMatch(/53 % · Mise en mémoire/)
    await pane.press({ key: 'tab-agents' })
    expect(await seen(pane)).toMatch(/affiché 255 k, départ 52 k, 24 requêtes/)
    expect(await seen(pane)).toMatch(/82 % : mise en mémoire du contexte/)
    await pane.press({ key: 'tab-modeles' })
    expect(await seen(pane)).toMatch(/Fable 5\.1 49 M \(45 %\)/)
    await pane.press({ key: 'tab-chrono' })
    expect(await seen(pane)).toMatch(/7 derniers jours : j1 1,0 M/)
    if (surface === 'desktop') {
      // La carte des limites, deux histogrammes et un tableau, tous bien formés.
      const drawn = await pane.findAll({ type: 'Svg' })
      expect(drawn).toHaveLength(4)
      for (const one of drawn) {
        expect(String(one.props.source)).toMatch(/^<svg [^]*<\/svg>$/)
      }
    }
    await pane.unmount()
  })
}

test('l’onglet Agents montre les 8 plus coûteux, puis toute la liste sur demande', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test' })
  mockLangs(on)
  const agent = SUMMARY.sessions[0]?.agentList?.[0]
  const first = SUMMARY.sessions[0]
  if (!agent || !first) throw new Error('données de test incomplètes')
  const many: Summary = {
    ...SUMMARY,
    sessions: [{ ...first, agentCount: 15, agentList: Array.from({ length: 11 }, (_, i) => ({ ...agent, desc: `Agent ${i + 1}`, week: agent.week - i })) }],
  }
  on('session.usage', async () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }) as never)
  on('process.run', async () => ({ value: { exitCode: 0, stdout: JSON.stringify(many), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  await $.turn.complete({ turnId: 't1', answer: '' } as never)

  const pane = await $.ui.mount({ plugin: 'conso', surface: 'desktop', component: 'Pane', requestId: 'conso', props: { bodyColumns: 80 } as never })
  await pane.press({ key: 'tab-agents' })
  // La carte des limites, puis une fiche par agent.
  expect(await pane.findAll({ type: 'Svg' })).toHaveLength(1 + 8)
  // Le scanner n'a gardé que 11 fiches sur 15 agents : le panneau le dit.
  expect(JSON.stringify(await pane.drawn())).toMatch(/Seuls les 12 agents les plus coûteux de chaque discussion sont gardés en détail : 11 fiches pour 15 agents/)
  expect(JSON.stringify(await pane.drawn())).toMatch(/Afficher la suite \(3\)/)
  await pane.press({ key: 'agents-more' })
  expect(await pane.findAll({ type: 'Svg' })).toHaveLength(1 + 11)
  expect(JSON.stringify(await pane.drawn())).toMatch(/Réduire la liste/)
  await pane.press({ key: 'agents-more' })
  expect(await pane.findAll({ type: 'Svg' })).toHaveLength(1 + 8)
  await pane.unmount()
})
