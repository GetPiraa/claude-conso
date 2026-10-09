import { expect, test } from 'claude-code/testing'

import * as lib from '../hooks/lib'
import { settle, toLimits } from '../hooks/lib'

const NOW = Date.parse('2026-10-09T14:31:00Z')
const HOUR = 3600000

test('une fenêtre 5 h échue repart de zéro au lieu de disparaître', async () => {
  // L'app rapporte encore l'ancienne mesure, une minute après le reset.
  const stale = toLimits(
    [
      { kind: 'five_hour', percentUsed: 87, resetsAt: '2026-10-09T14:30:00Z' },
      { kind: 'seven_day', percentUsed: 53, resetsAt: '2026-10-12T18:00:00Z' },
    ],
    NOW,
  )
  const settled = settle(stale, [], NOW)
  expect(settled.map(limit => limit.key)).toEqual(['five', 'week'])
  expect(settled[0]?.percentUsed).toBe(0)
  expect(settled[0]?.resetsAt).toBeUndefined()
  expect(settled[0]?.start).toBe(Date.parse('2026-10-09T14:30:00Z'))
  expect(settled[1]?.percentUsed).toBe(53)
})

test('une fenêtre que l’app ne rapporte plus est reprise de la dernière connue', async () => {
  const before = toLimits(
    [
      { kind: 'five_hour', percentUsed: 87, resetsAt: '2026-10-09T14:30:00Z' },
      { kind: 'seven_day', percentUsed: 53, resetsAt: '2026-10-12T18:00:00Z' },
    ],
    NOW - 10 * 60000,
  )
  // Juste après le reset, l'app ne donne plus que l'hebdo.
  const onlyWeek = toLimits([{ kind: 'seven_day', percentUsed: 53, resetsAt: '2026-10-12T18:00:00Z' }], NOW)
  const settled = settle(onlyWeek, before, NOW)
  expect(settled.map(limit => limit.key)).toEqual(['five', 'week'])
  expect(settled[0]?.percentUsed).toBe(0)

  // Une mesure gardée depuis plus longtemps que sa fenêtre n'est plus reprise.
  expect(settle(onlyWeek, before, NOW + 6 * HOUR).map(limit => limit.key)).toEqual(['week'])
})

test('les mesures de plus de dix jours sont oubliées, pour suivre un changement d’abonnement', async () => {
  const { addSample, estimate } = await Promise.resolve(lib)
  const DAY = 86400000
  // Ancien abonnement : 50 % pour 10 M, donc une limite de 20 M.
  let samples = addSample({}, 'five', 50, 10000000, NOW - 12 * DAY)
  expect(estimate(samples.five)).toBe(20000000)
  // Nouvel abonnement, douze jours plus tard : 50 % pour 50 M. L'ancienne mesure ne compte plus.
  samples = addSample(samples, 'five', 50, 50000000, NOW)
  expect(estimate(samples.five)).toBe(100000000)
})

test('chaque fenêtre ne garde que sa dernière mesure, et l’estimation s’appuie sur plusieurs fenêtres', async () => {
  const { addSample, estimate } = lib
  const first = NOW - 10 * HOUR
  // Une première fenêtre de 5 h : trois mesures, seule la dernière reste.
  let samples = addSample({}, 'five', 20, 10000000, first + HOUR, first)
  samples = addSample(samples, 'five', 40, 20000000, first + 2 * HOUR, first)
  samples = addSample(samples, 'five', 80, 40000000, first + 4 * HOUR, first)
  expect(samples.five).toHaveLength(1)
  expect(estimate(samples.five)).toBe(50000000)
  // La fenêtre suivante commence bien plus bas : l'estimation ne s'effondre pas, elle tient compte des deux.
  samples = addSample(samples, 'five', 20, 4000000, NOW, NOW - HOUR)
  expect(samples.five).toHaveLength(2)
  expect(estimate(samples.five)).toBe(44000000)
  // Les mesures gardées par une version précédente, sans fenêtre, laissent la place.
  const old = { five: [{ p: 60, t: 12000000, at: NOW - HOUR }, { p: 61, t: 12000000, at: NOW - HOUR / 2 }] }
  expect(addSample(old, 'five', 62, 12400000, NOW, NOW - 3 * HOUR).five).toHaveLength(1)
})
