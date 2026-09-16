import type {
  RepositoryCommit,
  RepositoryRelease,
} from '../src/repository'
import { describe, expect, it, vi } from 'vitest'
import { githubRepository } from '../src/repositories/github'

const repository = githubRepository.parse(
  'git@github.com:example/project.git',
)!
const release: RepositoryRelease = {
  tag: 'v1.1.0',
  name: 'v1.1.0',
  body: '### Features\n\n- Add CLI',
  prerelease: false,
  draft: false,
}

describe('gitHub repository metadata', () => {
  it.each([
    'git@github.com:example/project.git',
    'https://github.com/example/project.git',
    'git+https://github.com/example/project.git',
  ])('parses %s', (source) => {
    expect(githubRepository.parse(source)).toMatchObject({
      path: 'example/project',
      webUrl: 'https://github.com/example/project',
    })
  })

  it('rejects repositories from other providers', () => {
    expect(githubRepository.parse('https://gitea.example.com/example/project.git'))
      .toBeUndefined()
  })

  it('resolves explicit and environment tokens in precedence order', () => {
    expect(githubRepository.token(
      'explicit',
      { GITHUB_TOKEN: 'github', GH_TOKEN: 'gh' },
    )).toBe('explicit')
    expect(githubRepository.token(
      undefined,
      { GITHUB_TOKEN: 'github', GH_TOKEN: 'gh' },
    )).toBe('github')
    expect(githubRepository.token(undefined, { GH_TOKEN: 'gh' })).toBe('gh')
  })

  it('creates commit, comparison, and manual release URLs', () => {
    expect(githubRepository.commitUrl(repository, '1234567')).toBe(
      'https://github.com/example/project/commit/1234567',
    )
    expect(githubRepository.compareUrl(repository, 'v1.0.0', 'v1.1.0')).toBe(
      'https://github.com/example/project/compare/v1.0.0...v1.1.0',
    )

    const url = new URL(githubRepository.manualReleaseUrl!(repository, release))
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
  it('resolves an author when a commit without authors comes first', async () => {
    const commits: RepositoryCommit[] = [
      {
        hash: 'release',
        authors: [],
      },
      {
        hash: '1234567',
        authors: [{ name: 'Test Author', email: 'author@example.com' }],
      },
    ]
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

    await githubRepository.resolveAuthors!(
      commits,
      repository,
      'secret',
      fetch,
    )

    expect(requests).toEqual([
      'https://api.github.com/search/users?q=author%40example.com%20type%3Auser%20in%3Aemail',
      'https://api.github.com/repos/example/project/commits/1234567',
    ])
    expect(commits[1].authors[0].login).toBe('commit-author')
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

    await githubRepository.resolveAuthors!(
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
  it('uploads release assets after creating the release', async () => {
    const requests: Array<{ url: string, init?: RequestInit }> = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const url = String(input)
      requests.push({ url, init })
      if (url.endsWith('/releases/tags/v1.1.0'))
        return new Response(null, { status: 404 })
      if (url.endsWith('/releases')) {
        return Response.json({
          html_url: 'https://github.com/example/project/releases/tag/v1.1.0',
          upload_url: 'https://uploads.github.com/repos/example/project/releases/42/assets{?name,label}',
        })
      }
      return Response.json({}, { status: 201 })
    })

    await githubRepository.publishRelease!(
      repository,
      {
        ...release,
        assets: [{
          name: 'keepchanges.mjs',
          data: new TextEncoder().encode('release asset'),
        }],
      },
      'secret',
      fetch,
    )

    expect(requests[2]).toMatchObject({
      url: 'https://uploads.github.com/repos/example/project/releases/42/assets?name=keepchanges.mjs',
      init: {
        method: 'POST',
        headers: {
          'authorization': 'Bearer secret',
          'content-type': 'application/octet-stream',
        },
      },
    })
    expect(new TextDecoder().decode(requests[2].init?.body as Uint8Array))
      .toBe('release asset')
  })

  it('reports a failed release asset upload', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = String(input)
      if (url.endsWith('/releases/tags/v1.1.0'))
        return new Response(null, { status: 404 })
      if (url.endsWith('/releases')) {
        return Response.json({
          html_url: 'https://github.com/example/project/releases/tag/v1.1.0',
          upload_url: 'https://uploads.github.com/repos/example/project/releases/42/assets{?name,label}',
        })
      }
      return Response.json({}, { status: 422 })
    })

    await expect(githubRepository.publishRelease!(
      repository,
      {
        ...release,
        assets: [{
          name: 'keepchanges.mjs',
          data: new Uint8Array(),
        }],
      },
      'secret',
      fetch,
    )).rejects.toThrow(
      'GitHub release asset upload failed for keepchanges.mjs (422)',
    )
  })

  it('requires GitHub to return an asset upload URL', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async input =>
      String(input).endsWith('/releases/tags/v1.1.0')
        ? new Response(null, { status: 404 })
        : Response.json({
            html_url: 'https://github.com/example/project/releases/tag/v1.1.0',
          }))

    await expect(githubRepository.publishRelease!(
      repository,
      {
        ...release,
        assets: [{ name: 'keepchanges.mjs', data: new Uint8Array() }],
      },
      'secret',
      fetch,
    )).rejects.toThrow('GitHub release response did not include an upload URL')
  })

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

    const result = await githubRepository.publishRelease!(
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
      draft: false,
    })
  })

  it('updates the release already associated with the tag', async () => {
    const requests: Array<{ url: string, method?: string, body?: string }> = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const url = String(input)
      requests.push({
        url,
        method: init?.method,
        body: typeof init?.body === 'string' ? init.body : undefined,
      })
      if (url.endsWith('/releases/tags/v1.1.0'))
        return Response.json({ id: 42, body: 'Old release notes' })
      return Response.json({
        html_url: 'https://github.com/example/project/releases/tag/v1.1.0',
      })
    })

    const result = await githubRepository.publishRelease!(
      repository,
      release,
      'secret',
      fetch,
    )

    expect(result.action).toBe('updated')
    expect(requests[1]).toMatchObject({
      url: 'https://api.github.com/repos/example/project/releases/42',
      method: 'PATCH',
    })
    expect(JSON.parse(requests[1].body!)).toMatchObject({
      tag_name: 'v1.1.0',
      body: release.body,
    })
  })

  it('replaces an existing release asset with the same name', async () => {
    const requests: Array<{ url: string, method?: string }> = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const url = String(input)
      requests.push({ url, method: init?.method })
      if (url.endsWith('/releases/tags/v1.1.0')) {
        return Response.json({
          id: 42,
          assets: [{ id: 7, name: 'keepchanges.mjs' }],
        })
      }
      if (init?.method === 'PATCH') {
        return Response.json({
          html_url: 'https://github.com/example/project/releases/tag/v1.1.0',
          upload_url: 'https://uploads.github.com/repos/example/project/releases/42/assets{?name,label}',
        })
      }
      return new Response(null, { status: init?.method === 'DELETE' ? 204 : 201 })
    })

    await githubRepository.publishRelease!(
      repository,
      {
        ...release,
        assets: [{
          name: 'keepchanges.mjs',
          data: new TextEncoder().encode('replacement'),
        }],
      },
      'secret',
      fetch,
    )

    expect(requests).toContainEqual({
      url: 'https://api.github.com/repos/example/project/releases/assets/7',
      method: 'DELETE',
    })
    expect(requests.at(-1)).toEqual({
      url: 'https://uploads.github.com/repos/example/project/releases/42/assets?name=keepchanges.mjs',
      method: 'POST',
    })
  })
})
