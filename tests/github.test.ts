import type {
  RepositoryCommit,
  RepositoryRelease,
} from '../src/provider'
import { describe, expect, it, vi } from 'vitest'
import { githubProvider } from '../src/providers/github'

const repository = githubProvider.parse(
  'git@github.com:example/project.git',
)!
const release: RepositoryRelease = {
  tag: 'v1.1.0',
  name: 'v1.1.0',
  body: '### Features\n\n- Add CLI',
  prerelease: false,
}

describe('gitHub repository metadata', () => {
  it.each([
    'git@github.com:example/project.git',
    'https://github.com/example/project.git',
    'git+https://github.com/example/project.git',
  ])('parses %s', (source) => {
    expect(githubProvider.parse(source)).toMatchObject({
      path: 'example/project',
      webUrl: 'https://github.com/example/project',
    })
  })

  it('rejects repositories from other providers', () => {
    expect(githubProvider.parse('https://gitea.example.com/example/project.git'))
      .toBeUndefined()
  })

  it('resolves explicit and environment tokens in precedence order', () => {
    expect(githubProvider.token(
      'explicit',
      { GITHUB_TOKEN: 'github', GH_TOKEN: 'gh' },
    )).toBe('explicit')
    expect(githubProvider.token(
      undefined,
      { GITHUB_TOKEN: 'github', GH_TOKEN: 'gh' },
    )).toBe('github')
    expect(githubProvider.token(undefined, { GH_TOKEN: 'gh' })).toBe('gh')
  })

  it('creates commit, comparison, and manual release URLs', () => {
    expect(githubProvider.commitUrl(repository, '1234567')).toBe(
      'https://github.com/example/project/commit/1234567',
    )
    expect(githubProvider.compareUrl(repository, 'v1.0.0', 'v1.1.0')).toBe(
      'https://github.com/example/project/compare/v1.0.0...v1.1.0',
    )

    const url = new URL(githubProvider.manualReleaseUrl!(repository, release))
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://github.com/example/project/releases/new',
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      title: 'v1.1.0',
      body: release.body,
      tag: 'v1.1.0',
      prerelease: 'false',
    })
  })
})

describe('gitHub authors', () => {
  it('resolves an author from the GitHub commit when email search misses', async () => {
    const commits: RepositoryCommit[] = [{
      hash: '1234567',
      authors: [{ name: 'Test Author', email: 'author@example.com' }],
    }]
    const requests: string[] = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = String(input)
      requests.push(url)
      return Response.json(
        url.includes('/commits/')
          ? { author: { login: 'commit-author' } }
          : { items: [] },
      )
    })

    await githubProvider.resolveAuthors!(
      commits,
      repository,
      'secret',
      fetch,
    )

    expect(requests).toEqual([
      'https://api.github.com/search/users?q=author%40example.com%20type%3Auser%20in%3Aemail',
      'https://api.github.com/repos/example/project/commits/1234567',
    ])
    expect(commits[0].authors[0].login).toBe('commit-author')
  })

  it('reuses a resolved login for the same email', async () => {
    const commits: RepositoryCommit[] = [
      {
        hash: '1234567',
        authors: [{ name: 'Test Author', email: 'author@example.com' }],
      },
      {
        hash: '2345678',
        authors: [{ name: 'Test Author', email: 'author@example.com' }],
      },
    ]
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => Response.json({ items: [{ login: 'test-author' }] }),
    )

    await githubProvider.resolveAuthors!(
      commits,
      repository,
      'secret',
      fetch,
    )

    expect(fetch).toHaveBeenCalledOnce()
    expect(commits.map(commit => commit.authors[0].login)).toEqual([
      'test-author',
      'test-author',
    ])
  })
})

describe('gitHub releases', () => {
  it('creates a release when the tag has not been published', async () => {
    const requests: Array<{ url: string, init?: RequestInit }> = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.endsWith('/releases/tags/v1.1.0'))
        return new Response(null, { status: 404 })
      return Response.json({
        html_url: 'https://github.com/example/project/releases/tag/v1.1.0',
      })
    })

    const result = await githubProvider.publishRelease!(
      repository,
      release,
      'secret',
      fetch,
    )

    expect(result).toEqual({
      action: 'created',
      url: 'https://github.com/example/project/releases/tag/v1.1.0',
    })
    expect(requests[1]).toMatchObject({
      url: 'https://api.github.com/repos/example/project/releases',
      init: {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret',
        },
      },
    })
    expect(JSON.parse(String(requests[1].init?.body))).toEqual({
      tag_name: 'v1.1.0',
      name: 'v1.1.0',
      body: release.body,
      prerelease: false,
    })
  })

  it('updates the release already associated with the tag', async () => {
    const requests: Array<{ url: string, method?: string }> = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const url = String(input)
      requests.push({ url, method: init?.method })
      if (url.endsWith('/releases/tags/v1.1.0'))
        return Response.json({ id: 42 })
      return Response.json({
        html_url: 'https://github.com/example/project/releases/tag/v1.1.0',
      })
    })

    const result = await githubProvider.publishRelease!(
      repository,
      release,
      'secret',
      fetch,
    )

    expect(result.action).toBe('updated')
    expect(requests[1]).toEqual({
      url: 'https://api.github.com/repos/example/project/releases/42',
      method: 'PATCH',
    })
  })
})
