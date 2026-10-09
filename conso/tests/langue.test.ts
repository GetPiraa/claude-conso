import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { adopt, getLang, LANGS, limitLabel, parseLang, pickLang, t, toStrings } from '../hooks/i18n'
import { data as en } from '../hooks/lang/en'
import type { Data } from '../hooks/lang/shared'
import { fmt } from '../hooks/lib'
import type { Summary } from '../types'
import { FILES, mockLangs } from './langs'

const NOW = Date.parse('2026-10-09T12:00:00Z')
const summaryIn = (lang: string): Summary => ({
  now: NOW,
  lang,
  totals: { five: 16700000, week: 110000000, today: 30000000 },
  sessions: [
    {
      id: 'abc',
      title: 'Stadtmodell',
      project: 'Projekt-A',
      last: NOW,
      w: { five: 16700000, week: 110000000, today: 30000000 },
      models: { 'claude-opus-5-5': 110000000 },
      raw: [1000, 2000000, 500000000, 17000000],
      parts: [1000, 14000000, 28000000, 48000000],
      calls: 1000,
      agents: 0,
    },
  ],
  models: [{ name: 'claude-opus-5-5', w: { five: 16700000, week: 110000000, today: 30000000 } }],
  slots: { start: NOW - 3600000, step: 600000, values: [1, 2, 3, 4, 5, 6], from: '13:00', to: '14:00' },
  days: [1, 2, 3, 4, 5, 6, 7].map(n => ({ start: NOW - (7 - n) * 86400000, value: n * 1500000, label: `t${n}` })),
})

test('la langue du système choisit les textes, et une langue non traduite retombe sur l’anglais', async () => {
  expect(pickLang('de-CH')).toBe('de')
  expect(pickLang('pt_BR.UTF-8')).toBe('pt')
  expect(pickLang('ES')).toBe('es')
  expect(pickLang('ja-JP')).toBe('en')
  expect(pickLang('')).toBe('en')
  expect(pickLang(undefined)).toBe('en')
})

test('le séparateur décimal et les libellés suivent la langue', async () => {
  const before = getLang()
  adopt('en', en)
  expect(fmt(6745647)).toBe('6.7 M')
  expect(t().pct(32)).toBe('32%')
  expect(limitLabel('week')).toBe('Weekly · all models')
  adopt('de', FILES.de as Data)
  expect(fmt(6745647)).toBe('6,7 M')
  expect(fmt(2350000000)).toBe('2,35 Mrd.')
  expect(limitLabel('fable')).toBe('Woche · Fable')
  expect(t().chats(1)).toBe('1 Unterhaltung')
  expect(t().chats(12)).toBe('12 Unterhaltungen')
  adopt('fr', FILES.fr as Data)
  expect(fmt(6745647)).toBe('6,7 M')
  expect(limitLabel('five')).toBe('Session 5 h')
  expect(t().whyReread('82 %', 24, '250 k')).toBe('82 % : relecture du contexte, 24 requêtes ont relu en moyenne 250 k tokens chacune.')
  adopt(before, before === 'en' ? en : (FILES[before] as Data))
})

test('chaque langue a tous ses textes, avec les mêmes emplacements, et des noms de parts qui tiennent dans la légende', async () => {
  const holes = (value: unknown) => JSON.stringify(value).match(/[{][0-9][}]/g)?.sort().join('') ?? ''
  expect(LANGS).toEqual(['fr', 'en', 'es', 'de', 'pt', 'it'])
  for (const [lang, data] of Object.entries(FILES)) {
    // Un fichier incomplet serait refusé au chargement.
    const strings = toStrings(data as Data)
    expect(`${lang}: ${Object.keys(data as object).sort().join(',')}`).toBe(`${lang}: ${Object.keys(en).sort().join(',')}`)
    for (const [key, value] of Object.entries(data as object)) {
      // Le pluriel peut se passer du nombre au singulier (« une discussion ») ; ailleurs, chaque emplacement doit être repris.
      if (!Array.isArray(value)) {
        expect(`${lang}.${key}: ${holes(value)}`).toBe(`${lang}.${key}: ${holes((en as Record<string, unknown>)[key])}`)
      }
    }
    for (const part of strings.parts) {
      expect(part.length <= 19 ? '' : `${lang}: ${part}`).toBe('')
    }
  }
})

test('un fichier de langue abîmé est refusé en entier', async () => {
  expect(parseLang('import type { Data } from "./shared"\nconst data: Data = {"turn":"Ce tour"}\n\nexport default data\n')).toEqual({ turn: 'Ce tour' } as never)
  expect(() => toStrings({ ...(FILES.fr as Data), turn: undefined } as never)).toThrow()
  expect(() => toStrings({} as never)).toThrow()
})

// Le monde sous le mod : un scanner qui répond dans la langue donnée.
function world(on: On, lang: string, read: string[] = []) {
  mock.clock(on, { now: NOW })
  mock.store(on)
  mock.env(on, { USERPROFILE: 'C:/Users/test' })
  mockLangs(on, read)
  on('session.usage', async () => ({ value: { startedAt: 0, context: {}, rateLimits: [{ kind: 'five_hour', percentUsed: 32, resetsAt: '2026-10-09T14:30:00Z' }] } }) as never)
  on('process.run', async () => ({ value: { exitCode: 0, stdout: JSON.stringify(summaryIn(lang)), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
}

for (const surface of ['desktop', 'terminal'] as const) {
  test(`sur un système en allemand, la bande et le panneau sont en allemand (${surface})`, async ($, on) => {
    world(on, 'de')
    await $.turn.complete({ turnId: 't1', answer: '' } as never)

    const band = await $.ui.mount({ plugin: 'conso', surface, component: 'AbovePrompt', props: { bodyColumns: 120 } as never })
    const drawn = JSON.stringify(await band.drawn())
    expect(drawn).toMatch(/Diese Runde/)
    expect(drawn).toMatch(/5-Std\.-Sitzung: 17 M \/ ≈ 52 M Tokens/)
    expect(drawn).not.toMatch(/Ce tour/)
    await band.unmount()

    const pane = await $.ui.mount({ plugin: 'conso', surface, component: 'Pane', requestId: 'conso', props: { bodyColumns: 80 } as never })
    expect(await pane.find({ key: 'tab-chrono' })).toBeDefined()
    expect(JSON.stringify(await pane.drawn())).toMatch(/Unterhaltungen/)
    await pane.press({ key: 'tab-chrono' })
    expect(JSON.stringify(await pane.drawn())).toMatch(/Letzte 7 Tage: t1 1,5 M/)
    await pane.press({ key: 'tab-aide' })
    expect(JSON.stringify(await pane.drawn())).toMatch(/Was zählt diese Zahl/)
    await pane.unmount()
  })

  test(`sur un système dans une langue non traduite, tout s’affiche en anglais (${surface})`, async ($, on) => {
    // Le scanner répond « en » pour une telle langue ; même s'il rendait la langue brute, le mod retomberait sur l'anglais.
    world(on, 'ja-JP')
    await $.turn.complete({ turnId: 't1', answer: '' } as never)

    const band = await $.ui.mount({ plugin: 'conso', surface, component: 'AbovePrompt', props: { bodyColumns: 120 } as never })
    const drawn = JSON.stringify(await band.drawn())
    expect(drawn).toMatch(/This turn/)
    expect(drawn).toMatch(/5 h session: 17 M \/ ≈ 52 M tokens/)
    expect(drawn).toMatch(/32%/)
    await band.unmount()

    const pane = await $.ui.mount({ plugin: 'conso', surface, component: 'Pane', requestId: 'conso', props: { bodyColumns: 80 } as never })
    await pane.press({ key: 'tab-chrono' })
    expect(JSON.stringify(await pane.drawn())).toMatch(/Last 7 days: t1 1\.5 M/)
    await pane.unmount()
  })
}

for (const surface of ['desktop', 'terminal'] as const) {
  test(`le sélecteur du panneau change la langue, et « Auto » revient à celle du système (${surface})`, async ($, on) => {
    const read: string[] = []
    world(on, 'fr', read)
    await $.turn.complete({ turnId: 't1', answer: '' } as never)
    // Tant que personne ne la choisit, une autre langue n'est jamais lue.
    expect(read.filter(path => /lang.es/.test(path))).toEqual([])

    const pane = await $.ui.mount({ plugin: 'conso', surface, component: 'Pane', requestId: 'conso', props: { bodyColumns: 80 } as never })
    const seen = async () => JSON.stringify(await pane.drawn())
    // En automatique, la liste montre la langue réellement utilisée.
    expect(await seen()).toMatch(/FR · auto/)
    expect(await seen()).toMatch(/Comprendre/)
    expect(await pane.find({ type: 'Select', key: 'lang' })).toBeDefined()
    await pane.select({ key: 'lang', value: 'es' })
    expect(await seen()).toMatch(/Conversaciones/)
    expect(await seen()).not.toMatch(/Comprendre/)
    expect(read.filter(path => /lang.es[.]ts$/.test(path))).toHaveLength(1)

    await pane.select({ key: 'lang', value: 'auto' })
    expect(await seen()).toMatch(/FR · auto/)
    expect(await seen()).toMatch(/Comprendre/)
    await pane.unmount()
  })
}
