import { t } from './i18n'
import { cut, fit, fmt, modelName, share, widthOf } from './lib'

// Les dessins du panneau : des cartes SVG sombres, autonomes, aux couleurs de Claude.
const W = 480
const SANS = "ui-sans-serif,system-ui,'Segoe UI',sans-serif"
const SERIF = "Georgia,'Times New Roman',serif"
const INK = '#F0EEE6'
const MUTE = '#A6A39A'
const CARD = '#2B2A27'
const EDGE = '#3D3B36'
const TRACK = '#3F3D38'
const HOT = '#C4453A'
export const ORANGE = '#D97757'

const MODEL_COLORS: [RegExp, string][] = [
  [/opus/, '#D97757'],
  [/fable|mythos/, '#C46686'],
  [/sonnet/, '#6A9BCC'],
  [/haiku/, '#788C5D'],
]
export const modelColor = (name: string) => MODEL_COLORS.find(([re]) => re.test(name))?.[1] ?? '#D4A27F'

// Entrée, sortie, cache lu, cache écrit : l'ordre du scanner.
export const PART_COLORS = ['#6A9BCC', '#D97757', '#D4A27F', '#C46686']

const style = (elapsed: number) =>
  '<style>' +
  `.gx,.gy,.f{animation-delay:${-elapsed}ms}` +
  '.gx{transform-box:fill-box;transform-origin:left center;animation:gx .55s cubic-bezier(.2,.8,.2,1) both}' +
  '.gy{transform-box:fill-box;transform-origin:center bottom;animation:gy .5s cubic-bezier(.2,.8,.2,1) both}' +
  '.f{animation:f .35s ease-out both}' +
  '@keyframes gx{from{transform:scaleX(.55)}}@keyframes gy{from{transform:scaleY(.55)}}' +
  '@keyframes f{from{opacity:.35;transform:translateY(3px)}}' +
  '@media (prefers-reduced-motion:reduce){.gx,.gy,.f{animation:none}}' +
  '</style>'
const DEFS =
  '<defs>' +
  '<linearGradient id="o" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#D97757"/><stop offset="1" stop-color="#EDAE8E"/></linearGradient>' +
  '<linearGradient id="v" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stop-color="#C96442"/><stop offset="1" stop-color="#EDAE8E"/></linearGradient>' +
  '</defs>'

// Les cartes ne s'animent qu'à l'apparition d'une vue : redessinées ensuite (défilement, mise à jour), elles restent fixes.
// `elapsed` : les millisecondes écoulées depuis le changement de vue, ou undefined une fois l'apparition finie.
let isMoving = false
let elapsed = 0
export function setMotion(sinceChange: number | undefined): void {
  isMoving = sinceChange !== undefined
  elapsed = Math.max(0, Math.round(sinceChange ?? 0))
}

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (value: number) => (Math.round(value * 10) / 10).toString()

type TextOptions = {
  size?: number
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
  weight?: number
  serif?: boolean
  spacing?: number
  delay?: number
}

function text(x: number, y: number, value: string, o: TextOptions = {}): string {
  return (
    `<text x="${n(x)}" y="${n(y)}" font-family="${o.serif ? SERIF : SANS}" font-size="${o.size ?? 12}" fill="${o.fill ?? INK}"` +
    (o.anchor ? ` text-anchor="${o.anchor}"` : '') +
    (o.weight ? ` font-weight="${o.weight}"` : '') +
    (o.spacing ? ` letter-spacing="${o.spacing}"` : '') +
    ` class="f" style="animation-delay:${(o.delay ?? 0) - elapsed}ms">${esc(value)}</text>`
  )
}

function frame(width: number, height: number, body: string, hasCard = true): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    DEFS +
    (isMoving ? style(elapsed) : '') +
    (hasCard ? `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="${CARD}" stroke="${EDGE}"/>` : '') +
    body +
    '</svg>'
  )
}

function hbar(x: number, y: number, width: number, height: number, percent: number, fill = 'url(#o)', delay = 0): string {
  const filled = Math.max(0, Math.min(100, percent))
  const long = Math.max(filled > 0 ? height : 0, (width * filled) / 100)
  return (
    `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${height}" rx="${height / 2}" fill="${TRACK}"/>` +
    `<rect x="${n(x)}" y="${n(y)}" width="${n(long)}" height="${height}" rx="${height / 2}" fill="${fill}" class="gx" style="animation-delay:${delay - elapsed}ms"/>`
  )
}

/** Une étoile à huit branches, la marque de chaque modèle dans sa couleur. */
function spark(cx: number, cy: number, color: string, radius = 7): string {
  let rays = ''
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4
    const far = i % 2 === 0 ? radius : radius * 0.72
    rays += `<line x1="${n(cx + Math.cos(angle) * 1.8)}" y1="${n(cy + Math.sin(angle) * 1.8)}" x2="${n(cx + Math.cos(angle) * far)}" y2="${n(cy + Math.sin(angle) * far)}"/>`
  }
  return `<g stroke="${color}" stroke-width="2" stroke-linecap="round" class="f">${rays}</g>`
}

/** La jauge de la bande, sans carte. */
export function bandGauge(percent: number, width = 72): string {
  const filled = Math.max(0, Math.min(100, percent))
  const fill = percent >= 85 ? HOT : 'url(#o)'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="8" viewBox="0 0 ${width} 8">${DEFS}` +
    `<rect width="${width}" height="8" rx="4" fill="#8A8880" fill-opacity="0.35"/>` +
    `<rect width="${n(Math.max(filled > 0 ? 8 : 0, (width * filled) / 100))}" height="8" rx="4" fill="${fill}"/></svg>`
  )
}

export type LimitRow = { label: string; percent?: number; used: number; cap?: number; reset?: string }

/** Les limites du forfait : pourcentage, tokens utilisés sur la limite estimée, reset. */
export function limitsCard(rows: readonly LimitRow[]): string {
  const tall = 58
  let body = ''
  rows.forEach((row, i) => {
    const y = 8 + i * tall
    const delay = i * 90
    if (i > 0) body += `<line x1="20" x2="${W - 20}" y1="${y - 2}" y2="${y - 2}" stroke="${EDGE}"/>`
    body += text(20, y + 17, row.label.toUpperCase(), { size: 10, fill: MUTE, spacing: 0.8, weight: 600, delay })
    body += text(20, y + 40, row.percent === undefined ? '—' : t().pct(Math.round(row.percent)), {
      size: 21,
      serif: true,
      fill: (row.percent ?? 0) >= 85 ? '#F08A7B' : INK,
      delay,
    })
    body += text(W - 20, y + 23, `${fmt(row.used)}${row.cap ? ` / ≈ ${fmt(row.cap)}` : ''} ${t().tokens}`, { size: 13, weight: 600, anchor: 'end', delay })
    const under =
      row.percent === undefined
        ? t().notSent
        : `${row.cap ? `${t().left} ≈ ${fmt(Math.max(0, row.cap - row.used))}` : t().estimating}${row.reset ? ` · ${t().reset} ${row.reset}` : ''}`
    body += text(W - 20, y + 38, under, { size: 10.5, fill: MUTE, anchor: 'end', delay })
    body += hbar(20, y + 47, W - 40, 5, row.percent ?? 0, (row.percent ?? 0) >= 85 ? HOT : 'url(#o)', delay + 80)
  })
  return frame(W, 8 + rows.length * tall + 4, body)
}

/** L'en-tête d'un projet. */
export function projectCard(name: string, total: number, percent: number, count: number): string {
  const facts = `${fmt(total)} · ${t().pct(percent)} · ${t().chats(count)}`
  // Le nom cède la place aux chiffres : plus ils sont longs (« 12 Unterhaltungen »), plus il est coupé court.
  const room = W - 18 - widthOf(facts, 11.5) - 14 - 28
  const body =
    `<rect x="16" y="11" width="3" height="16" rx="1.5" fill="${ORANGE}" class="gy"/>` +
    text(28, 24, fit(cut(name, 30), room, 15), { size: 15, serif: true }) +
    text(W - 18, 24, facts, { size: 11.5, fill: MUTE, anchor: 'end' })
  return frame(W, 38, body)
}

/** Le point « en direct » : il bat en continu, comme un voyant d'enregistrement. */
function liveDot(cx: number, cy: number): string {
  return (
    `<circle cx="${cx}" cy="${cy}" r="5.5" fill="none" stroke="${ORANGE}" stroke-width="1.5">` +
    '<animate attributeName="r" values="5.5;11;11" dur="1.4s" repeatCount="indefinite"/>' +
    '<animate attributeName="stroke-opacity" values="0.9;0;0" dur="1.4s" repeatCount="indefinite"/></circle>' +
    `<circle cx="${cx}" cy="${cy}" r="5.5" fill="${ORANGE}"/>`
  )
}

/** Une discussion : rang, titre, barre, tokens, part. */
export function sessionRow(rank: number, title: string, value: number, percent: number, note: string, isHere: boolean): string {
  const width = 400
  const delay = Math.min(rank, 8) * 50
  const body =
    text(18, 26, String(rank).padStart(2, '0'), { size: 11, fill: ORANGE, weight: 700, delay }) +
    text(42, 26, fit(cut(title, 39), width - 18 - widthOf(fmt(value), 16) - 12 - 42, 13.5), { size: 13, weight: 600, delay }) +
    (isHere ? liveDot(25, 45) : '') +
    text(width - 18, 26, fmt(value), { size: 16, serif: true, fill: '#E88D6B', anchor: 'end', delay }) +
    hbar(42, 42, width - 42 - 180, 6, percent, 'url(#o)', delay + 60) +
    text(width - 18, 49, note, { size: 10.5, fill: '#D4A27F', anchor: 'end', delay })
  return frame(width, 64, body)
}

const SWEEP = 900

export type Slice = { name: string; value: number; color: string }

/** Un anneau et sa légende : la répartition d'un total entre quelques parts. */
export function donutCard(title: string, slices: readonly Slice[], hasSparks: boolean): string {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const rows = Math.max(slices.length, 1)
  const height = Math.max(190, 58 + rows * 40 + 14)
  const cx = 96
  const cy = height / 2 + 12
  const radius = 58
  const round = 2 * Math.PI * radius
  let rings = `<circle cx="${cx}" cy="${n(cy)}" r="${radius}" fill="none" stroke="${TRACK}" stroke-width="20"/>`
  let legend = ''
  let before = 0
  slices.forEach((slice, i) => {
    const part = total > 0 ? slice.value / total : 0
    const long = Math.max(0, round * part - (slices.length > 1 ? 2 : 0))
    const delay = i * 120
    const full = `${n(long)} ${n(round - long)}`
    // Le balayage dure SWEEP ms en tout ; cette part en prend sa proportion, à la suite des précédentes.
    const sweep = isMoving
      ? `<animate attributeName="stroke-dasharray" from="0 ${n(round)}" to="${full}" begin="${Math.round(before * SWEEP) - elapsed}ms" dur="${Math.max(1, Math.round(part * SWEEP))}ms" fill="freeze"/>`
      : ''
    rings +=
      `<circle cx="${cx}" cy="${n(cy)}" r="${radius}" fill="none" stroke="${slice.color}" stroke-width="20" ` +
      `stroke-dasharray="${isMoving ? `0 ${n(round)}` : full}" transform="rotate(${n(before * 360 - 90)} ${cx} ${n(cy)})">` +
      sweep +
      '</circle>'
    before += part
    const y = 58 + i * 40
    legend += hasSparks
      ? spark(214, y + 9, slice.color)
      : `<circle cx="214" cy="${y + 9}" r="5" fill="${slice.color}" class="f"/>`
    legend += text(230, y + 13, cut(slice.name, 19), { size: 12.5, weight: 600, delay })
    legend += text(W - 20, y + 13, `${fmt(slice.value)} · ${t().pct(share(slice.value, total))}`, { size: 11.5, anchor: 'end', delay })
    legend += hbar(230, y + 21, W - 250, 4, share(slice.value, total), slice.color, delay + 60)
  })
  const body =
    text(20, 30, title, { size: 15, serif: true }) +
    rings +
    text(cx, cy + 2, fmt(total), { size: 22, serif: true, anchor: 'middle' }) +
    text(cx, cy + 18, t().tokens, { size: 10.5, fill: MUTE, anchor: 'middle' }) +
    legend
  return frame(W, height, body)
}

export function modelSlices(models: readonly { name: string; value: number }[]): Slice[] {
  return models
    .filter(model => model.value > 0)
    .sort((a, b) => b.value - a.value)
    .map(model => ({ name: modelName(model.name), value: model.value, color: modelColor(model.name) }))
}

/** Un histogramme dans sa carte ; `marks` écrit la valeur au-dessus de chaque barre. */
export function barsCard(
  title: string,
  values: readonly number[],
  labels: readonly { at: number; text: string }[],
  options: { marks?: boolean; bright?: number } = {},
): string {
  const height = 204
  const left = 20
  const right = W - 20
  const top = 58
  const floor = 168
  const peak = Math.max(1, ...values)
  const step = (right - left) / Math.max(1, values.length)
  let body = text(20, 30, title, { size: 15, serif: true }) + text(W - 20, 30, `${t().peak} ${fmt(peak)}`, { size: 11, fill: MUTE, anchor: 'end' })
  for (const level of [0, 0.5, 1]) {
    const y = floor - (floor - top) * level
    body += `<line x1="${left}" x2="${right}" y1="${n(y)}" y2="${n(y)}" stroke="${EDGE}"${level > 0 ? ' stroke-dasharray="3 4"' : ''}/>`
  }
  values.forEach((value, i) => {
    const tall = Math.max(value > 0 ? 2 : 0, ((floor - top) * value) / peak)
    const wide = Math.min(46, step * 0.72)
    const x = left + i * step + (step - wide) / 2
    const dim = options.bright !== undefined && options.bright !== i
    body += `<rect x="${n(x)}" y="${n(floor - tall)}" width="${n(wide)}" height="${n(tall)}" rx="${Math.min(4, wide / 2)}" fill="url(#v)"${dim ? ' fill-opacity="0.6"' : ''} class="gy" style="animation-delay:${i * 28 - elapsed}ms"/>`
    if (options.marks) {
      body += text(x + wide / 2, floor - tall - 6, fmt(value), { size: 10.5, anchor: 'middle', delay: 200 + i * 28 })
    }
  })
  for (const label of labels) {
    const isFirst = label.at === 0 && !options.marks
    const isLast = label.at >= values.length - 1 && !options.marks
    const x = isFirst ? left : isLast ? right : left + (label.at + 0.5) * step
    body += text(x, floor + 18, label.text, { size: 10.5, fill: MUTE, anchor: isFirst ? 'start' : isLast ? 'end' : 'middle' })
  }
  return frame(W, height, body)
}

/** Un tableau à barres : un libellé, une barre, une valeur, une part. */
export function tableCard(title: string, rows: readonly { label: string; value: number }[], heads: [string, string, string]): string {
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  const peak = Math.max(1, ...rows.map(row => row.value))
  let body = text(20, 30, title, { size: 15, serif: true })
  body += text(20, 54, heads[0].toUpperCase(), { size: 10, fill: MUTE, spacing: 0.8, weight: 600 })
  body += text(W - 76, 54, heads[1].toUpperCase(), { size: 10, fill: MUTE, spacing: 0.8, weight: 600, anchor: 'end' })
  body += text(W - 20, 54, heads[2].toUpperCase(), { size: 10, fill: MUTE, spacing: 0.8, weight: 600, anchor: 'end' })
  rows.forEach((row, i) => {
    const y = 64 + i * 30
    const delay = i * 45
    body += `<line x1="20" x2="${W - 20}" y1="${y}" y2="${y}" stroke="${EDGE}"/>`
    body += text(20, y + 20, row.label, { size: 12.5, weight: 600, delay })
    body += hbar(110, y + 12, W - 110 - 150, 6, (row.value / peak) * 100, 'url(#o)', delay + 60)
    body += text(W - 76, y + 20, fmt(row.value), { size: 13, serif: true, anchor: 'end', delay })
    body += text(W - 20, y + 20, t().pct(share(row.value, total)), { size: 12, fill: MUTE, anchor: 'end', delay })
  })
  return frame(W, 64 + rows.length * 30 + 10, body)
}

/** L'en-tête d'une discussion ouverte : son titre et trois chiffres. */
export function sessionCard(title: string, project: string, tiles: readonly { label: string; value: number; note: string }[]): string {
  let body = text(20, 34, cut(title, 44), { size: 18, serif: true }) + text(20, 54, project, { size: 11.5, fill: MUTE })
  const wide = (W - 40 - 16) / 3
  tiles.forEach((tile, i) => {
    const x = 20 + i * (wide + 8)
    const delay = 100 + i * 90
    body += `<rect x="${n(x)}" y="70" width="${n(wide)}" height="74" rx="10" fill="#33312D" stroke="${EDGE}" class="f" style="animation-delay:${delay - elapsed}ms"/>`
    body += text(x + 12, 90, tile.label.toUpperCase(), { size: 10, fill: MUTE, spacing: 0.8, weight: 600, delay })
    body += text(x + 12, 116, fmt(tile.value), { size: 22, serif: true, delay })
    body += text(x + 12, 134, tile.note, { size: 10.5, fill: ORANGE, delay })
  })
  return frame(W, 158, body)
}

/** Coupe un texte en lignes d'au plus `max` caractères, entre deux mots. */
export function wrap(value: string, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of value.split(' ')) {
    if (line !== '' && line.length + 1 + word.length > max) {
      lines.push(line)
      line = word
    } else {
      line = line === '' ? word : `${line} ${word}`
    }
  }
  return line === '' ? lines : [...lines, line]
}

/** La fiche d'un agent : quatre chiffres et, en clair, pourquoi il a coûté ce qu'il a coûté. */
export function agentCard(
  title: string,
  sub: string,
  tiles: readonly { label: string; value: string }[],
  why: readonly string[],
): string {
  let body = text(20, 28, cut(title, 52), { size: 15, serif: true }) + text(20, 45, cut(sub, 76), { size: 10.5, fill: MUTE })
  const wide = (W - 40 - 24) / 4
  tiles.forEach((tile, i) => {
    const x = 20 + i * (wide + 8)
    const delay = 60 + i * 60
    body += `<rect x="${n(x)}" y="56" width="${n(wide)}" height="50" rx="8" fill="#33312D" stroke="${EDGE}"/>`
    body += text(x + 10, 73, tile.label.toUpperCase(), { size: 9, fill: MUTE, spacing: 0.7, weight: 600, delay })
    body += text(x + 10, 96, tile.value, { size: 17, serif: true, fill: '#E88D6B', delay })
  })
  // Une phrase trop longue pour la carte passe à la ligne au lieu d'être coupée : les traductions n'ont pas toutes la même longueur.
  let row = 0
  why.forEach((line, i) => {
    for (const piece of wrap(line, 80)) {
      body += text(20, 126 + row * 16, piece, { size: 10.5, fill: i === 0 ? INK : MUTE })
      row += 1
    }
  })
  return frame(W, 126 + row * 16, body)
}

/** Le témoin du tour : il bat tant que Claude travaille. Sa source ne change pas d'un chiffre à l'autre, donc il ne saute pas. */
export function pulseDot(isRunning: boolean): string {
  const style =
    '<style>.p{transform-box:fill-box;transform-origin:center;animation:p 1.2s ease-in-out infinite}' +
    '@keyframes p{50%{transform:scale(1.8);opacity:.35}}@media (prefers-reduced-motion:reduce){.p{animation:none}}</style>'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">${isRunning ? style : ''}` +
    `<circle cx="7" cy="7" r="3.5" fill="${isRunning ? ORANGE : '#8A8880'}"${isRunning ? ' class="p"' : ''}/></svg>`
  )
}
