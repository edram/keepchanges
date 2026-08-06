import { expect, it } from 'vitest'
import { git, readGitCommits } from '../src/git'
import { command, createRepository } from './fixtures'

it('reads raw commits from a Git range', async () => {
  const cwd = await createRepository()

  const commits = await readGitCommits(cwd, 'v1.0.0', 'HEAD')

  expect(commits).toEqual([{
    hash: expect.stringMatching(/^[0-9a-f]{7}$/),
    subject: 'feat: add CLI',
    body: '',
    author: {
      name: 'Test Author',
      email: 'author@example.com',
    },
  }])
})

it('reports Git stderr when a command fails', async () => {
  const cwd = await createRepository()
  await command(cwd, 'git', 'config', 'user.name', '')
  await command(cwd, 'git', 'config', 'user.email', '')

  await expect(
    git(cwd, 'commit', '--allow-empty', '-m', 'test'),
  ).rejects.toThrow(/Author identity unknown|empty ident name/)
})
