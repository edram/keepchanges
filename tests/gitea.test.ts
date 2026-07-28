import type { RepositoryCommit } from '../src/provider'
import { expect, it, vi } from 'vitest'
import { giteaProvider } from '../src/providers/gitea'

it('resolves a Gitea commit author with GITEA_TOKEN', async () => {
  const repository = giteaProvider.parse(
    'http://10.102.248.21/edram/keepchanges.git',
  )!
  const commits: RepositoryCommit[] = [{
    hash: '1234567',
    authors: [{ name: 'edram', email: 'edram@example.com' }],
  }]
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => Response.json({ author: { login: 'edram' } }),
  )
  const token = giteaProvider.token(
    undefined,
    { GITEA_TOKEN: 'secret' },
  )!

  await giteaProvider.resolveAuthors!(
    commits,
    repository,
    token,
    fetch,
  )

  expect(fetch).toHaveBeenCalledWith(
    'http://10.102.248.21/api/v1/repos/edram/keepchanges/git/commits/1234567',
    {
      headers: {
        accept: 'application/json',
        authorization: 'token secret',
      },
    },
  )
  expect(commits[0].authors[0].login).toBe('edram')
})
