import type { RepositoryProvider } from '../repository'
import { collectRepositoryAuthors } from '../repository'

export const githubRepository: RepositoryProvider = {
  name: 'GitHub',
  tokenEnv: 'GITHUB_TOKEN',

  parse(source) {
    const match = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(source)
    if (!match)
      return

    return {
      provider: githubRepository,
      path: match[1],
      webUrl: `https://github.com/${match[1]}`,
    }
  },

  token(explicit, env) {
    return explicit || env.GITHUB_TOKEN || env.GH_TOKEN
  },

  commitUrl(repository, hash) {
    return `${repository.webUrl}/commit/${hash}`
  },

  pullRequestUrl(repository, reference) {
    return `${repository.webUrl}/pull/${reference.replace(/^#/, '')}`
  },

  compareUrl(repository, from, to) {
    return `${repository.webUrl}/compare/${from}...${to}`
  },

  manualReleaseUrl(repository, release, action) {
    if (action === 'edit')
      return `${repository.webUrl}/releases/edit/${encodeURIComponent(release.tag)}`

    const url = new URL(`${repository.webUrl}/releases/new`)
    url.search = new URLSearchParams({
      title: release.name,
      body: release.body,
      tag: release.tag,
      prerelease: String(release.prerelease),
    }).toString()
    return url.toString()
  },

  async resolveAuthors(commits, repository, token, fetch) {
    const headers = {
      accept: 'application/vnd.github.v3+json',
      authorization: `token ${token}`,
    }
    const authorsByEmail = collectRepositoryAuthors(commits)

    await Promise.all([...authorsByEmail.values()].map(async (info) => {
      const { author, commit } = info
      try {
        const query = encodeURIComponent(`${author.email} type:user in:email`)
        const response = await fetch(
          `https://api.github.com/search/users?q=${query}`,
          { headers },
        )
        const data = await response.json() as {
          items?: Array<{ login?: string }>
        }
        author.login = data.items?.[0]?.login

        if (!author.login && commit) {
          const commitResponse = await fetch(
            `https://api.github.com/repos/${repository.path}/commits/${commit.hash}`,
            { headers },
          )
          const commitData = await commitResponse.json() as {
            author?: { login?: string }
          }
          author.login = commitData.author?.login
        }
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
      'accept': 'application/vnd.github+json',
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json',
    }
    const releasesUrl
      = `https://api.github.com/repos/${repository.path}/releases`
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
      throw new Error(`GitHub release lookup failed (${existing.status})`)
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
      throw new Error(`GitHub release publishing failed (${response.status})`)

    const data = await response.json() as { html_url: string }
    return {
      url: data.html_url,
      action,
    }
  },
}
