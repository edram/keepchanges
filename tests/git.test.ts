import { expect, it } from 'vitest'
import { git, readGitCommits, resolveVersionRef } from '../src/git'
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

it.each([
  { prefix: 'v', tag: 'v1.0.0' },
  { prefix: '', tag: '1.0.0' },
  { prefix: 'package@', tag: 'package@1.0.0' },
])('resolves versions with the "$prefix" tag prefix', async ({ prefix, tag }) => {
  const cwd = await createRepository()
  await command(cwd, 'git', 'tag', '--delete', 'v1.0.0')
  await command(cwd, 'git', 'tag', tag, 'HEAD~1')

  await expect(resolveVersionRef(cwd, '1.0.0', prefix)).resolves.toBe(tag)
})

it('falls back to an existing unprefixed tag', async () => {
  const cwd = await createRepository()
  await command(cwd, 'git', 'tag', '--delete', 'v1.0.0')
  await command(cwd, 'git', 'tag', '1.0.0', 'HEAD~1')

  await expect(resolveVersionRef(cwd, '1.0.0', 'v'))
    .resolves
    .toBe('1.0.0')
})

it('preserves non-version Git references', async () => {
  const cwd = await createRepository()

  await expect(resolveVersionRef(cwd, 'HEAD', 'v')).resolves.toBe('HEAD')
})
