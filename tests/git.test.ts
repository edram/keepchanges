import { join } from 'node:path'
import { expect, it } from 'vitest'
import { git, readGitCommits, resolveVersionRef } from '../src/git'
import { command, commitFiles, createRepository } from './fixtures'

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

it.each([
  {
    paths: ['packages/core'],
    subjects: ['feat: coordinate core and CLI', 'fix(core): repair parser'],
  },
  {
    paths: ['packages/core', 'shared'],
    subjects: ['feat: coordinate core and CLI', 'fix: update shared utils', 'fix(core): repair parser'],
  },
  {
    paths: [':(glob)packages/core/*.ts'],
    subjects: ['feat: coordinate core and CLI', 'fix(core): repair parser'],
  },
  { paths: ['missing'], subjects: [] },
  {
    paths: [],
    subjects: ['feat: coordinate core and CLI', 'fix: update shared utils', 'fix(core): repair parser', 'feat: add CLI'],
  },
])('reads commits matching Git pathspecs $paths', async ({ paths, subjects }) => {
  const cwd = await createRepository()
  await commitFiles(cwd, 'fix(core): repair parser', ['packages/core/index.ts'])
  await commitFiles(cwd, 'fix: update shared utils', ['shared/utils.ts'])
  await commitFiles(cwd, 'feat: coordinate core and CLI', ['packages/core/index.ts', 'packages/cli/index.ts'])

  const commits = await readGitCommits(cwd, 'v1.0.0', 'HEAD', paths)

  expect(commits.map(commit => commit.subject)).toEqual(subjects)
})

it('reads commits for paths that have been deleted', async () => {
  const cwd = await createRepository()
  await commitFiles(cwd, 'feat(core): add parser', ['packages/core/index.ts'])
  await command(cwd, 'git', 'rm', 'packages/core/index.ts')
  await command(cwd, 'git', 'commit', '-m', 'fix(core): remove parser')

  const commits = await readGitCommits(cwd, 'v1.0.0', 'HEAD', ['packages/core'])

  expect(commits.map(commit => commit.subject)).toEqual([
    'fix(core): remove parser',
    'feat(core): add parser',
  ])
})

it('resolves path filters relative to the command working directory', async () => {
  const cwd = await createRepository()
  await commitFiles(cwd, 'fix(core): repair parser', ['packages/core/index.ts'])
  await commitFiles(cwd, 'fix(cli): repair output', ['packages/cli/index.ts'])

  const commits = await readGitCommits(join(cwd, 'packages', 'core'), 'v1.0.0', 'HEAD', ['.'])

  expect(commits.map(commit => commit.subject)).toEqual(['fix(core): repair parser'])
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
