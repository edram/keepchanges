import type { Repository, RepositoryProvider } from './provider'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { x } from 'tinyexec'
import { giteaProvider } from './providers/gitea'
import { githubProvider } from './providers/github'

const providers: Record<string, RepositoryProvider> = {
  gitea: giteaProvider,
  github: githubProvider,
}

export async function resolveRepository(cwd: string): Promise<Repository | undefined> {
  let providerName = ''
  let source = await readFile(resolve(cwd, 'package.json'), 'utf8')
    .then((contents) => {
      const repository = (
        JSON.parse(contents) as {
          repository?: string | { provider?: string, url?: string }
        }
      ).repository
      if (typeof repository === 'object')
        providerName = repository?.provider?.toLowerCase() || ''
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

  if (providerName)
    return providers[providerName]?.parse(source)

  for (const provider of [githubProvider]) {
    const repository = provider.parse(source)
    if (repository)
      return repository
  }
}
