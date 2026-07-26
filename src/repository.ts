import type { Repository, RepositoryProvider } from './provider'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { x } from 'tinyexec'
import { githubProvider } from './providers/github'

const providers: RepositoryProvider[] = [githubProvider]

export async function resolveRepository(cwd: string): Promise<Repository | undefined> {
  let source = await readFile(resolve(cwd, 'package.json'), 'utf8')
    .then((contents) => {
      const repository = (
        JSON.parse(contents) as {
          repository?: string | { url?: string }
        }
      ).repository
      return typeof repository === 'string' ? repository : repository?.url || ''
    })
    .catch(() => '')

  if (!source) {
    source = (
      await x(
        'git',
        ['remote', 'get-url', 'origin'],
        { nodeOptions: { cwd } },
      )
    ).stdout.trim()
  }

  for (const provider of providers) {
    const repository = provider.parse(source)
    if (repository)
      return repository
  }
}
