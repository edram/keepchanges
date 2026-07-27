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
}
