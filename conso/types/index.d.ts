/** Un sous-agent lancé par une discussion, sur la semaine. */
export type AgentUse = {
  desc: string
  type: string
  model: string
  week: number
  five: number
  /** Tokens bruts : entrée, sortie, lecture de cache, écriture de cache. */
  raw: number[]
  /** Les mêmes, en tokens pondérés. */
  parts: number[]
  calls: number
  /** Le contexte de sa première requête : ce qu'il coûte avant tout travail. */
  first: number
  /** Son plus grand contexte : le chiffre que l'app affiche à côté de l'agent. */
  peak: number
  last: number
}

/** Une discussion et ce qu'elle a consommé, en tokens pondérés, par fenêtre. */
export type SessionUse = {
  id: string
  title: string
  project: string
  last: number
  /** Par clé de fenêtre : five, week, today, ou une limite par modèle. */
  w: Record<string, number>
  /** Par modèle, sur la semaine. */
  models: Record<string, number>
  /** Tokens bruts sur la semaine : entrée, sortie, lecture de cache, écriture de cache. */
  raw: number[]
  /** Les mêmes quatre natures, en tokens pondérés. */
  parts: number[]
  calls: number
  /** La part des sous-agents, sur la semaine. */
  agents: number
  agentCount?: number
  /** Ses agents les plus coûteux de la semaine. */
  agentList?: AgentUse[]
}

export type Summary = {
  now: number
  /** La langue du système, lue par le scanner : fr, en, es, de, pt ou it. */
  lang?: string
  totals: Record<string, number>
  sessions: SessionUse[]
  models: { name: string; w: Record<string, number> }[]
  slots: { start: number; step: number; values: number[]; from: string; to: string }
  days: { start: number; value: number; label: string }[]
  /** Par clé de limite : l'heure locale du reset, en clair. */
  resets?: Record<string, string>
  tookMs?: number
}

/** Une limite du forfait telle que l'app la rapporte. */
export type Limit = {
  key: string
  kind: string
  label: string
  percentUsed: number
  resetsAt?: string
  start: number
  match?: string
}

/** Le tour en cours : son total, la dernière hausse, le nombre de réponses. */
export type Live = { total: number; last: number; steps: number; isRunning: boolean }

export type Tab = 'discussions' | 'agents' | 'modeles' | 'chrono' | 'aide'
export type Period = 'five' | 'today' | 'week'
/**
 * `freshAt` : l'instant du dernier changement de vue ; les cartes dessinées juste après jouent leur animation.
 * `openedAt` : l'instant de l'ouverture du panneau ; la carte des limites, commune à tous les onglets, ne s'anime qu'alors.
 * `langOpen` : la liste des langues est dépliée.
 */
export type View = { tab: Tab; period: Period; sessionId?: string; freshAt?: number; openedAt?: number; langOpen?: boolean }

declare module 'claude-code' {
  interface PluginState {
    conso: {
      summary: Summary | null
      limits: Limit[]
      /** La limite estimée de chaque fenêtre, en tokens pondérés. */
      estimates: Record<string, number>
      view: View
      sessionId: string
      error: string
      live: Live
    }
  }
}
