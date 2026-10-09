import { data as en } from './lang/en'
import type { Data, PluralKey, Strings } from './lang/shared'

export type { Strings } from './lang/shared'

// Les textes du mod, dans chaque langue. La langue vient du scanner (bin/scan.mjs), qui lit celle du système,
// ou du choix fait dans le panneau ; une langue qui n'est pas ici retombe sur l'anglais.
export type Lang = 'fr' | 'en' | 'es' | 'de' | 'pt' | 'it'

/** Les langues, dans l'ordre du sélecteur. */
export const LANGS: Lang[] = ['fr', 'en', 'es', 'de', 'pt', 'it']

const PLURALS: PluralKey[] = ['refreshBusy', 'refreshDone', 'chats']

const fill = (template: string, args: readonly unknown[]) => template.replace(/\{(\d)\}/g, (_, at: string) => String(args[Number(at)] ?? ''))

/** Fait des données d'une langue les textes que le mod appelle : chaque modèle devient une fonction qui le remplit. */
export function toStrings(data: Data): Strings {
  const strings: Record<string, unknown> = {}
  for (const [key, shape] of Object.entries(en)) {
    const value = (data as Record<string, unknown>)[key]
    const isPlural = (PLURALS as string[]).includes(key)
    // Un fichier incomplet ou abîmé ne doit pas donner un panneau à moitié vide : la langue entière est refusée.
    if (typeof value !== typeof shape || Array.isArray(value) !== Array.isArray(shape)) {
      throw new Error(`conso: texte manquant ou mal formé : ${key}`)
    }
    if (isPlural) {
      const [one, many] = value as [string, string]
      strings[key] = (count: number) => fill(count === 1 ? one : many, [count])
    } else if (typeof value === 'string' && /\{\d\}/.test(shape as string)) {
      strings[key] = (...args: unknown[]) => fill(value, args)
    } else {
      strings[key] = value
    }
  }

  return strings as Strings
}

// Une langue n'est lue que lorsqu'elle sert : qui reste en français ne charge ni l'espagnol ni l'italien.
// L'anglais est toujours là : c'est le repli tant que rien d'autre n'est chargé.
const loaded: Partial<Record<Lang, Strings>> = { en: toStrings(en) }
let current: Lang = 'en'

/** "de-CH" -> "de" ; "pt_BR" -> "pt" ; une langue qui n'est pas traduite, ou rien -> "en". */
export function pickLang(locale: string | undefined | null): Lang {
  const code = String(locale ?? '').trim().toLowerCase().split(/[-_.]/)[0] ?? ''
  return (LANGS as string[]).includes(code) ? (code as Lang) : 'en'
}

/** Cette langue est-elle déjà chargée ? */
export const hasLang = (lang: Lang): boolean => loaded[lang] !== undefined

/** Les données d'une langue, tirées du texte de son fichier (hooks/lang/fr.ts…) : le JSON entre les accolades de `const data`. */
export function parseLang(source: string): Data {
  const from = source.indexOf('{', source.indexOf('const data'))
  return JSON.parse(source.slice(from, source.lastIndexOf('}') + 1)) as Data
}

/** Prend les données d'une langue et en fait la langue des textes. Des données incomplètes sont refusées : la langue en cours reste. */
export function adopt(lang: Lang, data: Data): void {
  loaded[lang] = toStrings(data)
  current = lang
}

/** Fait d'une langue déjà chargée la langue des textes. */
export function setLang(lang: Lang): void {
  if (hasLang(lang)) current = lang
}

export const getLang = (): Lang => current

/** Les textes de la langue en cours. */
export const t = (): Strings => loaded[current] ?? (loaded.en as Strings)

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/** Le libellé d'une limite du forfait : « Session 5 h », « Hebdo · tous modèles », « Hebdo · Fable ». */
export function limitLabel(key: string): string {
  const s = t()
  return key === 'five' ? s.periods.five : `${s.weekly} · ${key === 'week' ? s.weekAll : capital(key)}`
}
