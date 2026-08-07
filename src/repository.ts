import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { git } from './git'
import { giteaRepository } from './repositories/gitea'
import { githubRepository } from './repositories/github'

export interface RepositoryAuthor {
  name: string
  email: string
  login?: string
}

export interface RepositoryCommit {
  hash: string
  authors: RepositoryAuthor[]
}

export interface Repository {
  provider: RepositoryProvider
  path: string
  webUrl: string
}

export interface RepositoryRelease {
  tag: string
  name: string
  body: string
  prerelease: boolean
  draft: boolean
}

export interface RepositoryReleaseResult {
  url: string
  action: 'created' | 'updated'
}

export interface RepositoryProvider {
  name: string
  tokenEnv: string
  parse: (source: string) => Repository | undefined
  token: (explicit: string | undefined, env: NodeJS.ProcessEnv) => string | undefined
  commitUrl: (repository: Repository, hash: string) => string
  pullRequestUrl: (repository: Repository, reference: string) => string
  compareUrl: (repository: Repository, from: string, to: string) => string
  resolveAuthors?: (
    commits: RepositoryCommit[],
    repository: Repository,
    token: string,
    fetch: typeof globalThis.fetch,
  ) => Promise<void>
  publishRelease?: (
    repository: Repository,
    release: RepositoryRelease,
    token: string,
    fetch: typeof globalThis.fetch,
  ) => Promise<RepositoryReleaseResult>
  manualReleaseUrl?: (
    repository: Repository,
    release: RepositoryRelease,
  ) => string
}

const repositoryProviders: Record<string, RepositoryProvider> = {
  github: githubRepository,
  gitea: giteaRepository,
}

export async function resolveRepository(
  cwd: string,
  explicit?: string,
): Promise<Repository | undefined> {
  if (explicit) {
    const source = /^[^/:]+\/[^/]+$/.test(explicit)
      ? `https://github.com/${explicit}`
      : explicit
    const repository = parseRepository(source, Object.values(repositoryProviders))
    if (!repository)
      throw new Error(`Unsupported repository: ${explicit}`)
    return repository
  }

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
    source = await git(cwd, 'remote', 'get-url', 'origin')
      .then(output => output.trim())
      .catch(() => '')
  }

  if (providerName)
    return repositoryProviders[providerName]?.parse(source)

  return parseRepository(source, [githubRepository])
}

function parseRepository(
  source: string,
  providers: RepositoryProvider[],
): Repository | undefined {
  for (const provider of providers) {
    const repository = provider.parse(source)
    if (repository)
      return repository
  }
}
