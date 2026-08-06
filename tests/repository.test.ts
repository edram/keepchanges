import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { resolveRepository } from '../src/repository'
import { command, createRepository } from './fixtures'

it.each([
  ['a string', 'git+https://github.com/example/project.git'],
  ['an object', {
    type: 'git',
    url: 'git+https://github.com/example/project.git',
  }],
])('resolves package repository metadata stored as %s', async (_, repository) => {
  const cwd = await createRepository()
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({ repository }),
  )

  await expect(resolveRepository(cwd)).resolves.toMatchObject({
    path: 'example/project',
    webUrl: 'https://github.com/example/project',
  })
})

it('resolves an explicitly configured Gitea repository', async () => {
  const cwd = await createRepository()
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({
      repository: {
        type: 'git',
        provider: 'gitea',
        url: 'https://gitea.example.com/edram/keepchanges.git',
      },
    }),
  )

  const repository = await resolveRepository(cwd)

  expect(repository).toMatchObject({
    provider: { name: 'Gitea' },
    path: 'edram/keepchanges',
    webUrl: 'https://gitea.example.com/edram/keepchanges',
  })
  expect(repository!.provider.commitUrl(repository!, '1234567')).toBe(
    'https://gitea.example.com/edram/keepchanges/commit/1234567',
  )
  expect(repository!.provider.pullRequestUrl(repository!, '#123')).toBe(
    'https://gitea.example.com/edram/keepchanges/pulls/123',
  )
  expect(repository!.provider.compareUrl(
    repository!,
    'v1.0.0',
    'v1.1.0',
  )).toBe(
    'https://gitea.example.com/edram/keepchanges/compare/v1.0.0...v1.1.0',
  )
})

it('prefers package.json over the Git origin', async () => {
  const cwd = await createRepository()
  await command(
    cwd,
    'git',
    'remote',
    'add',
    'origin',
    'git@github.com:example/origin.git',
  )
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({
      repository: 'https://github.com/example/package.git',
    }),
  )

  expect((await resolveRepository(cwd))?.path).toBe('example/package')
})

it('falls back to the Git origin', async () => {
  const cwd = await createRepository()
  await command(
    cwd,
    'git',
    'remote',
    'add',
    'origin',
    'git@github.com:example/origin.git',
  )

  await expect(resolveRepository(cwd)).resolves.toMatchObject({
    path: 'example/origin',
    webUrl: 'https://github.com/example/origin',
  })
})

it('resolves an explicit GitHub slug before project metadata', async () => {
  const cwd = await createRepository()
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({ repository: 'https://github.com/example/package.git' }),
  )

  await expect(resolveRepository(cwd, 'other/project')).resolves.toMatchObject({
    provider: { name: 'GitHub' },
    path: 'other/project',
    webUrl: 'https://github.com/other/project',
  })
})

it('resolves an explicit Gitea URL', async () => {
  const cwd = await createRepository()

  await expect(resolveRepository(
    cwd,
    'https://gitea.example.com/example/project.git',
  )).resolves.toMatchObject({
    provider: { name: 'Gitea' },
    path: 'example/project',
    webUrl: 'https://gitea.example.com/example/project',
  })
})

it('rejects an unsupported explicit repository', async () => {
  const cwd = await createRepository()

  await expect(resolveRepository(cwd, 'not-a-repository'))
    .rejects
    .toThrow('Unsupported repository: not-a-repository')
})
