import type {
  RepositoryCommit,
  RepositoryRelease,
} from '../src/repository'
import { expect, it, vi } from 'vitest'
import { giteaRepository } from '../src/repositories/gitea'

const repository = giteaRepository.parse(
  'https://gitea.example.com/edram/keepchanges.git',
)!
const release: RepositoryRelease = {
  tag: 'v1.1.0',
  name: 'v1.1.0',
  body: '### Features\n\n- Add CLI',
  prerelease: false,
  draft: false,
}

it('creates a manual release URL for the selected tag', () => {
  const url = new URL(giteaRepository.manualReleaseUrl!(repository, release))

  expect(`${url.origin}${url.pathname}`).toBe(
    'https://gitea.example.com/edram/keepchanges/releases/new',
  )
  expect(Object.fromEntries(url.searchParams)).toEqual({
    tag: 'v1.1.0',
  })
})

it('resolves an author from the first valid Gitea commit', async () => {
  const commits: RepositoryCommit[] = [
    {
      hash: 'release',
      authors: [],
    },
    {
      hash: '1234567',
      authors: [{ name: 'edram', email: 'edram@example.com' }],
    },
    {
      hash: '2345678',
      authors: [{ name: 'edram', email: 'edram@example.com' }],
    },
  ]
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => Response.json({ author: { login: 'edram' } }),
  )
  const token = giteaRepository.token(
    undefined,
    { GITEA_TOKEN: 'secret' },
  )!

  await giteaRepository.resolveAuthors!(
    commits,
    repository,
    token,
    fetch,
  )

  expect(fetch).toHaveBeenCalledWith(
    'https://gitea.example.com/api/v1/repos/edram/keepchanges/git/commits/1234567',
    {
      headers: {
        accept: 'application/json',
        authorization: 'token secret',
      },
    },
  )
  expect(commits[1].authors[0].login).toBe('edram')
  expect(commits[2].authors[0].login).toBe('edram')
})

it('creates a Gitea release when the tag has not been published', async () => {
  const requests: Array<{ url: string, init?: RequestInit }> = []
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = String(input)
    requests.push({ url, init })
    if (url.endsWith('/releases/tags/v1.1.0'))
      return new Response(null, { status: 404 })
    return Response.json({
      html_url: 'https://gitea.example.com/edram/keepchanges/releases/tag/v1.1.0',
    })
  })

  const result = await giteaRepository.publishRelease!(
    repository,
    release,
    'secret',
    fetch,
  )

  expect(result).toEqual({
    action: 'created',
    url: 'https://gitea.example.com/edram/keepchanges/releases/tag/v1.1.0',
  })
  expect(requests[1]).toMatchObject({
    url: 'https://gitea.example.com/api/v1/repos/edram/keepchanges/releases',
    init: {
      method: 'POST',
      headers: {
        authorization: 'token secret',
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

it('updates the Gitea release already associated with the tag', async () => {
  const requests: Array<{ url: string, method?: string }> = []
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = String(input)
    requests.push({ url, method: init?.method })
    if (url.endsWith('/releases/tags/v1.1.0'))
      return Response.json({ id: 42 })
    return Response.json({
      html_url: 'https://gitea.example.com/edram/keepchanges/releases/tag/v1.1.0',
    })
  })

  const result = await giteaRepository.publishRelease!(
    repository,
    release,
    'secret',
    fetch,
  )

  expect(result.action).toBe('updated')
  expect(requests[1]).toEqual({
    url: 'https://gitea.example.com/api/v1/repos/edram/keepchanges/releases/42',
    method: 'PATCH',
  })
})

it('reports a failed Gitea release lookup', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    new Response(null, { status: 500 }))

  await expect(giteaRepository.publishRelease!(
    repository,
    release,
    'secret',
    fetch,
  )).rejects.toThrow('Gitea release lookup failed (500)')

  expect(fetch).toHaveBeenCalledOnce()
})

it('reports a failed Gitea release request', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async input =>
    String(input).includes('/releases/tags/')
      ? new Response(null, { status: 404 })
      : Response.json({}, { status: 422 }))

  await expect(giteaRepository.publishRelease!(
    repository,
    release,
    'secret',
    fetch,
  )).rejects.toThrow('Gitea release publishing failed (422)')
})
