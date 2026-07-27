import type { RepositoryProvider } from '../provider'

export const giteaProvider: RepositoryProvider = {
  name: 'Gitea',

  parse(source) {
    try {
      const url = new URL(source.replace(/^git\+/, ''))
      if (!/^https?:$/.test(url.protocol))
        return

      const path = url.pathname
        .replace(/^\/+|\/+$/g, '')
        .replace(/\.git$/, '')
      if (!path.includes('/'))
        return

      return {
        provider: giteaProvider,
        path,
        webUrl: `${url.origin}/${path}`,
      }
    }
    catch {}
  },

  token(explicit, env) {
    return explicit || env.GITEA_TOKEN
  },

  commitUrl(repository, hash) {
    return `${repository.webUrl}/commit/${hash}`
  },

  pullRequestUrl(repository, reference) {
    return `${repository.webUrl}/pulls/${reference.replace(/^#/, '')}`
  },

  compareUrl(repository, from, to) {
    return `${repository.webUrl}/compare/${from}...${to}`
  },

  async resolveAuthors(commits, repository, token, fetch) {
    const headers = {
      accept: 'application/json',
      authorization: `token ${token}`,
    }
    const commitsByEmail = new Map(
      commits.flatMap(commit =>
        commit.authors[0]
          ? [[commit.authors[0].email, commit] as const]
          : [],
      ),
    )
    const loginsByEmail = new Map<string, string>()

    await Promise.all([...commitsByEmail].map(async ([email, commit]) => {
      try {
        const response = await fetch(
          `${new URL(repository.webUrl).origin}/api/v1/repos/${repository.path}/git/commits/${commit.hash}`,
          { headers },
        )
        if (!response.ok)
          return

        const data = await response.json() as {
          author?: { login?: string }
        }
        if (data.author?.login)
          loginsByEmail.set(email, data.author.login)
      }
      catch {}
    }))

    for (const commit of commits) {
      for (const author of commit.authors)
        author.login = loginsByEmail.get(author.email)
    }
  },
}
