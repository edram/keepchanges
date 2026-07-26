import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runCli } from '../src/cli'
import { command, commit, createRepository } from './git'

test('links first-release changes from the initial commit', async () => {
  const cwd = await createRepository()
  await command(cwd, 'git', 'tag', '--delete', 'v1.0.0')
  await command(
    cwd,
    'git',
    'remote',
    'add',
    'origin',
    'git@github.com:example/project.git',
  )
  const firstCommit = (
    await command(cwd, 'git', 'rev-list', '--max-parents=0', 'HEAD')
  ).stdout.trim()

  await runCli(['0.0.1'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    `##### &nbsp;&nbsp;&nbsp;&nbsp;[View changes on GitHub](https://github.com/example/project/compare/${firstCommit}...v0.0.1)`,
  )
})

test('resolves GitHub author logins with --token', async () => {
  const cwd = await createRepository()
  await command(
    cwd,
    'git',
    'remote',
    'add',
    'origin',
    'git@github.com:example/project.git',
  )
  let requestUrl = ''

  await runCli(
    ['1.1.0', '--token', 'secret'],
    {
      cwd,
      fetch: async (input, init) => {
        requestUrl = String(input)
        expect(init?.headers).toMatchObject({
          authorization: 'token secret',
        })
        return new Response(JSON.stringify({
          items: [{ login: 'test-author' }],
        }))
      },
    },
  )

  expect(requestUrl).toContain('/search/users?q=')
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    '- Add CLI &nbsp;-&nbsp; by @test-author',
  )
})

test('resolves GitHub author logins with an environment token', async () => {
  for (const tokenName of ['GITHUB_TOKEN', 'GH_TOKEN']) {
    const cwd = await createRepository()
    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify({
        repository: 'https://github.com/example/project',
      }),
    )

    await runCli(
      ['1.1.0'],
      {
        cwd,
        env: { [tokenName]: 'secret' },
        fetch: async () => new Response(JSON.stringify({
          items: [{ login: 'environment-author' }],
        })),
      },
    )

    await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
      '- Add CLI &nbsp;-&nbsp; by @environment-author',
    )
  }
})

test('resolves the primary author login from the GitHub commit', async () => {
  const cwd = await createRepository()
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({
      repository: 'https://github.com/example/project',
    }),
  )
  const requests: string[] = []

  await runCli(
    ['1.1.0', '--token', 'secret'],
    {
      cwd,
      fetch: async (input) => {
        const url = String(input)
        requests.push(url)
        return new Response(JSON.stringify(
          url.includes('/commits/')
            ? { author: { login: 'commit-author' } }
            : { items: [] },
        ))
      },
    },
  )

  expect(requests.some(url => url.includes('/commits/'))).toBe(true)
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    '- Add CLI &nbsp;-&nbsp; by @commit-author',
  )
})

test('uses a resolved login for every commit by the same author', async () => {
  const cwd = await createRepository()
  await command(cwd, 'git', 'tag', '--delete', 'v1.0.0')
  await commit(cwd, 'fix: handle repeated authors')
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({
      repository: 'https://github.com/example/project',
    }),
  )

  await runCli(
    ['1.1.0', '--token', 'secret'],
    {
      cwd,
      fetch: async () => new Response(JSON.stringify({
        items: [{ login: 'test-author' }],
      })),
    },
  )

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog.match(/by @test-author/g)).toHaveLength(2)
  expect(changelog).not.toContain('**Test Author**')
})

test('links commits using an SSH origin repository', async () => {
  const cwd = await createRepository()
  await command(
    cwd,
    'git',
    'remote',
    'add',
    'origin',
    'git@github.com:example/project.git',
  )
  const hash = (
    await command(cwd, 'git', 'rev-parse', '--short', 'HEAD')
  ).stdout.trim()

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    `- Add CLI &nbsp;-&nbsp; by **Test Author** [<samp>(${hash.slice(0, 5)})</samp>](https://github.com/example/project/commit/${hash})`,
  )
})

test('prefers the package repository over the Git origin', async () => {
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
      repository: 'git+https://github.com/example/package.git',
    }),
  )
  const hash = (
    await command(cwd, 'git', 'rev-parse', '--short', 'HEAD')
  ).stdout.trim()

  await runCli(['1.1.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain(
    `https://github.com/example/package/commit/${hash}`,
  )
  expect(changelog).not.toContain('https://github.com/example/origin')
})

test('reads an object-form package repository', async () => {
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
  const hash = (
    await command(cwd, 'git', 'rev-parse', '--short', 'HEAD')
  ).stdout.trim()

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    `https://github.com/example/project/commit/${hash}`,
  )
})

test('links changes from the latest tag to the release tag', async () => {
  const cwd = await createRepository()
  await command(
    cwd,
    'git',
    'remote',
    'add',
    'origin',
    'https://github.com/example/project.git',
  )

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    '##### &nbsp;&nbsp;&nbsp;&nbsp;[View changes on GitHub](https://github.com/example/project/compare/v1.0.0...v1.1.0)',
  )
})
