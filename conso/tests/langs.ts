import type { On } from 'claude-code'

import de from '../hooks/lang/de'
import es from '../hooks/lang/es'
import fr from '../hooks/lang/fr'
import it from '../hooks/lang/it'
import pt from '../hooks/lang/pt'
import type { Data } from '../hooks/lang/shared'

export const FILES: Record<string, Data> = { fr, es, de, pt, it }

/** Le texte d'un fichier de langue du mod, tel que le mod le lit, ou undefined si le chemin n'en est pas un. */
export function langFile(path: string): string | undefined {
  const data = FILES[/lang.([a-z]{2})[.]ts$/.exec(path)?.[1] ?? '']

  return data ? `const data: Data = ${JSON.stringify(data)}` : undefined
}

/** Le monde sous le mod, pour ses fichiers de langue : ils se lisent comme sur le disque. `read` note chaque chemin lu. */
export function mockLangs(on: On, read: string[] = []): void {
  on('fs.read', async (_$, e) => {
    const path = (e as { path: string }).path
    read.push(path)

    return { value: langFile(path) ?? '{}' } as never
  })
}
