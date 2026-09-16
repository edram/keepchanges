import type { RepositoryProvider } from '../repository'
import { collectRepositoryAuthors } from '../repository'

export const githubRepository: RepositoryProvider = {
  name: 'GitHub',
  tokenEnv: 'GITHUB_TOKEN',
  supportsReleaseAssets: true,

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
    let existingAssets: Array<{ id: number, name: string }> = []
    if (existing.ok) {
      const data = await existing.json() as {
        id: number
        assets?: Array<{ id: number, name: string }>
      }
      url = `${releasesUrl}/${data.id}`
      method = 'PATCH'
      action = 'updated'
      existingAssets = data.assets ?? []
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

    const data = await response.json() as {
      html_url: string
      upload_url?: string
    }
    if (release.assets?.length) {
      if (!data.upload_url)
        throw new Error('GitHub release response did not include an upload URL')

      const uploadUrl = data.upload_url.replace(/\{.*$/, '')
      for (const asset of release.assets) {
        const existingAsset = existingAssets.find(
          candidate => candidate.name === asset.name,
        )
        if (existingAsset) {
          const deleteResponse = await fetch(
            `https://api.github.com/repos/${repository.path}/releases/assets/${existingAsset.id}`,
            { method: 'DELETE', headers },
          )
          if (!deleteResponse.ok) {
            throw new Error(
              `GitHub release asset replacement failed for ${asset.name} (${deleteResponse.status})`,
            )
          }
        }
        const uploadResponse = await fetch(
          `${uploadUrl}?name=${encodeURIComponent(asset.name)}`,
          {
            method: 'POST',
            headers: {
              'accept': 'application/vnd.github+json',
              'authorization': `Bearer ${token}`,
              'content-type': 'application/octet-stream',
            },
            body: asset.data,
          },
        )
        if (!uploadResponse.ok) {
          throw new Error(
            `GitHub release asset upload failed for ${asset.name} (${uploadResponse.status})`,
          )
        }
      }
    }
    return {
      url: data.html_url,
      action,
    }
  },
}
