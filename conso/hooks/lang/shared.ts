import type { Period, Tab } from '../../types'

// Ce que chaque langue doit fournir. Une langue = un fichier de données de ce dossier (fr.json, de.json…), lu seulement quand elle sert.
export type Strings = {
  /** Le séparateur décimal et le suffixe des milliards. */
  decimal: string
  billion: string
  pct: (value: number) => string
  /** Ce qui sépare un libellé de sa valeur : « Session 5 h : 12 M ». */
  colon: string
  tabs: Record<Tab, string>
  periods: Record<Period, string>
  /** Les quatre natures de tokens, dans l'ordre du scanner. Dix-neuf caractères au plus : la légende de l'anneau n'en montre pas davantage. */
  parts: [string, string, string, string]
  help: string
  cmdOpen: string
  cmdRefresh: string
  paneOpened: string
  untitled: string
  refreshBusy: (count: number) => string
  refreshWait: string
  refreshNone: string
  refreshDone: (count: number) => string
  refreshReopen: string
  refreshFailed: (names: string) => string
  scanFailed: (code: number) => string
  turn: string
  running: string
  idle: string
  unavailable: string
  computingBand: string
  computingPane: string
  reset: string
  thisChat: string
  weekLower: string
  weekly: string
  weekAll: string
  estimated: string
  details: string
  detail: string
  of: string
  ofUsage: (percent: string) => string
  back: string
  whereFrom: string
  days7: string
  models: string
  detailFoot: (calls: number, perReply: string, agents: string) => string
  none: string
  ofLimit: (percent: string) => string
  ofPeriod: (percent: string) => string
  noAgents: string
  agentsHead: (count: number, spent: string, percent: string, start: string) => string
  shown: string
  start: string
  requests: string
  use: string
  agentAlt: (peak: string, first: string, calls: number, week: string) => string
  whyReread: (percent: string, calls: number, each: string) => string
  whyCached: (percent: string, tokens: string) => string
  whyWritten: (percent: string, tokens: string) => string
  whyPlain: (percent: string, tokens: string) => string
  whyStart: (first: string) => string
  slotsBy: string
  now: string
  fromTo: (from: string, to: string) => string
  last7: string
  dayByDay: string
  heads: [string, string, string]
  dayTable: string
  lastFailed: string
  inTotal: string
  version: string
  notSent: string
  left: string
  estimating: string
  chats: (count: number) => string
  peak: string
  tokens: string
}

/** Les textes qui s'accordent avec un nombre : [singulier, pluriel]. */
export type PluralKey = 'refreshBusy' | 'refreshDone' | 'chats'

/**
 * Une langue telle qu'elle est écrite dans son fichier : des données pures.
 * Là où `Strings` a une fonction, le fichier a un modèle (« {0} de ta conso »), ou une paire [singulier, pluriel].
 */
export type Data = {
  [K in keyof Strings]: K extends PluralKey ? [string, string] : Strings[K] extends (...args: never[]) => string ? string : Strings[K]
}
