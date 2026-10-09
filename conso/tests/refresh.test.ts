import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { alivePids, staleEngines } from '../hooks/lib'
import { langFile } from './langs'

const INSTALLED = 1000
const ENGINES = [
  { pid: 1, sessionId: 'moi', name: 'Cette discussion', status: 'busy', startedAt: 10 },
  { pid: 2, sessionId: 'a', name: 'Ancienne au repos', status: 'idle', startedAt: 20 },
  { pid: 3, sessionId: 'b', name: 'Ancienne qui travaille', status: 'busy', startedAt: 30 },
  { pid: 4, sessionId: 'c', name: 'Récente', status: 'idle', startedAt: 2000 },
  { pid: 5, sessionId: 'd', name: 'Fichier sans processus', status: 'idle', startedAt: 40 },
]

test('seules les anciennes discussions encore en vie sont retenues, jamais la discussion en cours', async () => {
  const found = staleEngines(ENGINES, new Set([1, 2, 3, 4]), 'moi', INSTALLED)
  expect(found.idle.map(engine => engine.name)).toEqual(['Ancienne au repos'])
  expect(found.busy.map(engine => engine.name)).toEqual(['Ancienne qui travaille'])
})

// Le monde sous le mod : les fichiers de session, la liste des processus, et les arrêts demandés.
function world(on: On, engines: typeof ENGINES, killed: string[]) {
  mock.env(on, { USERPROFILE: 'C:/Users/test', CONSO_LANG: 'fr' })
  on('session.id', async () => ({ value: 'moi' }) as never)
  on('fs.list', async () => ({ value: engines.map(engine => ({ name: `${engine.pid}.json`, kind: 'file', size: 1, mtimeMs: 1, isLink: false })) }) as never)
  on('fs.read', async (_$, e) => {
    const path = (e as { path: string }).path.split(String.fromCharCode(92)).join("/")
    const engine = engines.find(one => path.includes(`/${one.pid}.json`))

    return { value: langFile(path) ?? JSON.stringify(engine ?? {}) } as never
  })
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: INSTALLED, isLink: false } }) as never)
  on('process.run', async (_$, e) => {
    const argv = (e as { argv: string[] }).argv
    if (argv[0] === 'taskkill') {
      killed.push(argv[argv.length - 1] ?? '')
    }
    const stdout = argv[0] === 'tasklist' ? engines.filter(engine => engine.pid !== 5).map(engine => `"claude.exe","${engine.pid}","Console","1","1 Ko"`).join('\r\n') : ''

    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as never
  })
}

test('/conso-refresh ne touche à rien tant qu’une ancienne discussion travaille', async ($, on) => {
  const killed: string[] = []
  world(on, ENGINES, killed)
  const answer = await $.command.run({ command: 'conso-refresh' } as never)
  expect(JSON.stringify(answer)).toMatch(/Rien n'a été fait/)
  expect(JSON.stringify(answer)).toMatch(/Ancienne qui travaille/)
  expect(killed).toEqual([])
})

test('/conso-refresh arrête seulement les anciens moteurs au repos', async ($, on) => {
  const killed: string[] = []
  world(
    on,
    ENGINES.filter(engine => engine.sessionId !== 'b'),
    killed,
  )
  const answer = await $.command.run({ command: 'conso-refresh' } as never)
  expect(killed).toEqual(['2'])
  expect(JSON.stringify(answer)).toMatch(/1 discussion rafraîchie/)
})

test('sous macOS, seuls les binaires « claude » comptent comme moteurs, pas l’application', async () => {
  const ps = [
    '  501 /Applications/Claude.app/Contents/MacOS/Claude',
    '  640 /Applications/Claude.app/Contents/Frameworks/Claude Helper.app/Contents/MacOS/Claude Helper',
    '  702 /Users/moi/Library/Application Support/Claude/claude-code/2.1.293/claude',
    '  703 claude',
    '  900 /usr/bin/python3',
  ].join('\n')
  expect([...alivePids(ps, false)]).toEqual([702, 703])
})

test('/conso-refresh fonctionne aussi sans Windows : ps pour lister, kill pour arrêter', async ($, on) => {
  const killed: string[] = []
  const engines = ENGINES.filter(engine => engine.sessionId !== 'b')
  mock.env(on, { HOME: '/Users/moi', CONSO_LANG: 'fr' })
  on('session.id', async () => ({ value: 'moi' }) as never)
  on('fs.list', async () => ({ value: engines.map(engine => ({ name: `${engine.pid}.json`, kind: 'file', size: 1, mtimeMs: 1, isLink: false })) }) as never)
  on('fs.read', async (_$, e) => {
    const path = (e as { path: string }).path.split(String.fromCharCode(92)).join('/')
    const engine = engines.find(one => path.endsWith(`/${one.pid}.json`))

    return { value: langFile(path) ?? JSON.stringify(engine ?? {}) } as never
  })
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: INSTALLED, isLink: false } }) as never)
  const calls: string[] = []
  on('process.run', async (_$, e) => {
    const argv = (e as { argv: string[] }).argv
    calls.push(argv.join(' '))
    if (argv[0] === 'kill') {
      killed.push(argv[argv.length - 1] ?? '')
    }
    const stdout = argv[0] === 'ps' ? engines.filter(engine => engine.pid !== 5).map(engine => `  ${engine.pid} /Users/moi/Library/claude-code/claude`).join('\n') : ''

    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as never
  })
  const answer = await $.command.run({ command: 'conso-refresh' } as never)
  expect(calls[0]).toBe('ps -axo pid=,comm=')
  expect(calls).toContain('kill -TERM 2')
  expect(killed).toEqual(['2'])
  expect(JSON.stringify(answer)).toMatch(/1 discussion rafraîchie/)
})
