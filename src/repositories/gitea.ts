import type { RepositoryProvider } from '../repository'
import { collectRepositoryAuthors } from '../repository'

export const giteaRepository: RepositoryProvider = {
  name: 'Gitea',
  tokenEnv: 'GITEA_TOKEN',

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
        provider: giteaRepository,
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

  manualReleaseUrl(repository, release, action) {
    if (action === 'edit')
      return `${repository.webUrl}/releases/edit/${encodeURIComponent(release.tag)}`

    const url = new URL(`${repository.webUrl}/releases/new`)
    url.search = new URLSearchParams({ tag: release.tag }).toString()
    return url.toString()
  },

  async resolveAuthors(commits, repository, token, fetch) {
    const headers = {
      accept: 'application/json',
      authorization: `token ${token}`,
    }
    const authorsByEmail = collectRepositoryAuthors(commits)

    await Promise.all([...authorsByEmail.values()].map(async (info) => {
      const { author, commit } = info
      if (!commit)
        return
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
          author.login = data.author.login
      }
      catch {}
    }))

    for (const commit of commits) {
      for (const author of commit.authors)
        author.login = authorsByEmail.get(author.email)?.author.login
    }
  },

  async publishRelease(repository, release, token, fetch) {
    const headers = {
      'accept': 'application/json',
      'authorization': `token ${token}`,
      'content-type': 'application/json',
    }
    const releasesUrl
      = `${new URL(repository.webUrl).origin}/api/v1/repos/${repository.path}/releases`
    const existing = await fetch(
      `${releasesUrl}/tags/${encodeURIComponent(release.tag)}`,
      { headers },
    )
    let url = releasesUrl
    let method = 'POST'
    let action: 'created' | 'updated' = 'created'
    if (existing.ok) {
      const data = await existing.json() as { id: number }
      url = `${releasesUrl}/${data.id}`
      method = 'PATCH'
      action = 'updated'
    }
    else if (existing.status !== 404) {
      throw new Error(`Gitea release lookup failed (${existing.status})`)
    }

    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify({
        tag_name: release.tag,
        name: release.name,
        body: release.body,
        prerelease: release.prerelease,
        draft: release.draft,
      }),
    })
    if (!response.ok)
      throw new Error(`Gitea release publishing failed (${response.status})`)

    const data = await response.json() as { html_url: string }
    return {
      url: data.html_url,
      action,
    }
  },
}
