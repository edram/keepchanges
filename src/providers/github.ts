import type { RepositoryProvider } from '../provider'

export const githubProvider: RepositoryProvider = {
  name: 'GitHub',

  parse(source) {
    const match = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(source)
    if (!match)
      return

    return {
      provider: githubProvider,
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

  compareUrl(repository, from, to) {
    return `${repository.webUrl}/compare/${from}...${to}`
  },

  async resolveAuthors(commits, repository, token, fetch) {
    const headers = {
      accept: 'application/vnd.github.v3+json',
      authorization: `token ${token}`,
    }
    const authorsByEmail = new Map(
      commits
        .flatMap(commit => commit.authors)
        .map(author => [author.email, author]),
    )

    await Promise.all([...authorsByEmail.values()].map(async (author) => {
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

        const commit = commits.find(
          commit => commit.authors[0].email === author.email,
        )
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
        author.login = authorsByEmail.get(author.email)?.login
    }
  },
}
