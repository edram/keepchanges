import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { resolveRepository } from '../src/repository'
import { command, createRepository } from './git'

test('resolves a string repository from package.json', async () => {
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

test('resolves an object repository from package.json', async () => {
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

test('prefers package.json over the Git origin', async () => {
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

test('falls back to the Git origin', async () => {
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
