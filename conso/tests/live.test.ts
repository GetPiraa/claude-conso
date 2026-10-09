import { expect, mock, test } from 'claude-code/testing'

import { mockLangs } from './langs'

const NOW = Date.parse('2026-10-09T12:00:00Z')
const EMPTY = {
  now: NOW,
  lang: 'fr',
  totals: { five: 0, week: 0, today: 0 },
  sessions: [],
  models: [],
  slots: { start: NOW, step: 600000, values: [0], from: '12:00', to: '12:00' },
  days: [],
}

test('le compteur du tour laisse passer la réponse et affiche son vrai coût', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test' })
  mockLangs(on)
  on('session.usage', async () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }) as never)
  on('process.run', async () => ({ value: { exitCode: 0, stdout: JSON.stringify(EMPTY), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('turn.step', async function* () {
    yield { kind: 'text', index: 0, text: 'x'.repeat(700) } as never

    return {
      turnId: 't1',
      index: 0,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 200, cache_read_input_tokens: 100000, cache_creation_input_tokens: 1000 },
    } as never
  })

  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 } as never)
  const chunks: unknown[] = []
  let step = await stream.next()
  while (!step.done) {
    chunks.push(step.value)
    step = await stream.next()
  }
  // La réponse traverse le mod sans être touchée.
  expect(chunks).toHaveLength(1)
  expect((step.value as { usage: { output_tokens: number } }).usage.output_tokens).toBe(200)

  await $.turn.complete({ turnId: 't1', answer: '' } as never)

  // (10 x 4 + 200 x 20 + 100 000 x 0,2 + 1 000 x 8) / 4 = 8 010 tokens pondérés.
  const band = await $.ui.mount({ plugin: 'conso', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 120 } as never })
  expect(await band.find({ type: 'Text', text: /^8 k$/ })).toBeDefined()
  await band.unmount()
})

test('dans une session cloud, les pourcentages s’affichent sans limite estimée', async ($, on) => {
  mock.clock(on, { now: NOW })
  mock.store(on)
  mock.env(on, { HOME: '/home/user', CLAUDE_CODE_REMOTE: 'true' })
  mockLangs(on)
  on('session.usage', async () => ({ value: { startedAt: 0, context: {}, rateLimits: [{ kind: 'five_hour', percentUsed: 40, resetsAt: '2026-10-09T14:30:00Z' }] } }) as never)
  let asked = ''
  on('process.run', async (_$, e) => {
    asked = String((e as { stdin?: string; init?: { stdin?: string } }).stdin ?? (e as { init?: { stdin?: string } }).init?.stdin ?? '')

    return { value: { exitCode: 0, stdout: JSON.stringify({ ...EMPTY, totals: { five: 200000, week: 200000, today: 200000 } }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as never
  })
  on('turn.complete', async () => ({ text: '' }) as never)
  await $.turn.complete({ turnId: 't1', answer: '' } as never)

  // Sans USERPROFILE, le mod lit le dossier personnel de la machine distante.
  expect(asked).toMatch(/\/home\/user\/\.claude\/projects/)
  const band = await $.ui.mount({ plugin: 'conso', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 120 } as never })
  const drawn = JSON.stringify(await band.drawn())
  expect(drawn).toMatch(/40 %/)
  // 200 k pour 40 % donnerait une « limite » de 500 k : fausse, donc non affichée.
  expect(drawn).not.toMatch(/≈/)
  await band.unmount()
})
