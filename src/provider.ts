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
}

export interface RepositoryReleaseResult {
  url: string
  action: 'created' | 'updated'
}

export interface RepositoryProvider {
  name: string
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
