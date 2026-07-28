import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { resolveRepository } from '../src/repository'
import { command, createRepository } from './git'

it('resolves a string repository from package.json', async () => {
  const cwd = await createRepository()
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({
      repository: 'git+https://github.com/example/package.git',
    }),
  )

  await expect(resolveRepository(cwd)).resolves.toMatchObject({
    path: 'example/package',
    webUrl: 'https://github.com/example/package',
  })
})

it('resolves an object repository from package.json', async () => {
  const cwd = await createRepository()
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({
      repository: {
        type: 'git',
        url: 'git+https://github.com/example/project.git',
      },
    }),
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
        url: 'http://10.102.248.21/edram/keepchanges.git',
      },
    }),
  )

  const repository = await resolveRepository(cwd)

  expect(repository).toMatchObject({
    provider: { name: 'Gitea' },
    path: 'edram/keepchanges',
    webUrl: 'http://10.102.248.21/edram/keepchanges',
  })
  expect(repository!.provider.commitUrl(repository!, '1234567')).toBe(
    'http://10.102.248.21/edram/keepchanges/commit/1234567',
  )
  expect(repository!.provider.pullRequestUrl(repository!, '#123')).toBe(
    'http://10.102.248.21/edram/keepchanges/pulls/123',
  )
  expect(repository!.provider.compareUrl(
    repository!,
    'v1.0.0',
    'v1.1.0',
  )).toBe(
    'http://10.102.248.21/edram/keepchanges/compare/v1.0.0...v1.1.0',
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
