import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runChangelog } from '../src/run'
import { command, commit } from './git'
import {
  createReleaseRepository,
  githubReleaseFetch,
} from './release'
import type { GitHubRequest } from './release'

test('creates and pushes a release without Git identity configuration', async () => {
  const { cwd, remote } = await createReleaseRepository()
  const requests: GitHubRequest[] = []
  await command(cwd, 'git', 'config', 'user.name', '')
  await command(cwd, 'git', 'config', 'user.email', '')

  await runChangelog(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
      stdout: () => {},
      fetch: githubReleaseFetch({ requests }),
    },
  )

  expect(
    (await command(cwd, 'git', 'log', '-1', '--format=%s')).stdout.trim(),
  ).toBe('chore(release): v1.1.0')
  expect(
    (
      await command(
        cwd,
        'git',
        'log',
        '-1',
        '--format=%an%x00%ae%x00%cn%x00%ce',
      )
    ).stdout.trim().split('\0'),
  ).toEqual([
    'github-actions[bot]',
    '41898282+github-actions[bot]@users.noreply.github.com',
    'github-actions[bot]',
    '41898282+github-actions[bot]@users.noreply.github.com',
  ])
  expect(
    (
      await command(
        cwd,
        'git',
        'for-each-ref',
        '--format=%(taggername)%00%(taggeremail)',
        'refs/tags/v1.1.0',
      )
    ).stdout.trim().split('\0'),
  ).toEqual([
    'github-actions[bot]',
    '<41898282+github-actions[bot]@users.noreply.github.com>',
  ])
  const tagCommit = (
    await command(cwd, 'git', 'rev-list', '-n', '1', 'v1.1.0')
  ).stdout.trim()
  expect(tagCommit).toBe(
    (await command(cwd, 'git', 'rev-parse', 'HEAD')).stdout.trim(),
  )
  expect(
    (await command(
      remote,
      'git',
      'rev-list',
      '-n',
      '1',
      'refs/tags/v1.1.0',
    )).stdout.trim(),
  ).toBe(tagCommit)
  const publish = requests.find(request => request.method === 'POST')
  expect(publish?.body).toMatchObject({
    tag_name: 'v1.1.0',
    name: 'v1.1.0',
    prerelease: false,
  })
  expect(publish?.body?.body).toContain('### 🚀 Features')
  expect(publish?.body?.body).toContain('by @test-author')
  expect(publish?.body?.body).not.toContain('## v1.1.0')
})

test('skips provider requests without a token', async () => {
  const { cwd, remote } = await createReleaseRepository()

  await runChangelog(
    { version: '1.1.0', release: true },
    {
      cwd,
      env: {},
      stdout: () => {},
      fetch: async () => {
        throw new Error('Provider API must not be called without a token')
      },
    },
  )
  expect(
    (await command(
      remote,
      'git',
      'rev-list',
      '-n',
      '1',
      'refs/tags/v1.1.0',
    )).stdout.trim(),
  ).not.toBe('')
})

test('reuses a release commit created before --release', async () => {
  const { cwd } = await createReleaseRepository()
  await runChangelog(
    { version: '1.1.0', commit: true, token: 'secret' },
    { cwd, fetch: githubReleaseFetch() },
  )
  const releaseCommit = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()

  await runChangelog(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
      stdout: () => {},
      fetch: githubReleaseFetch(),
    },
  )

  expect(
    (await command(cwd, 'git', 'rev-parse', 'HEAD')).stdout.trim(),
  ).toBe(releaseCommit)
  expect(
    (await command(cwd, 'git', 'rev-list', '-n', '1', 'v1.1.0')).stdout.trim(),
  ).toBe(releaseCommit)
})

test('publishes an existing tag without moving it or including later commits', async () => {
  const { cwd } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  await command(cwd, 'git', 'push', 'origin', 'HEAD', 'refs/tags/v1.1.0')
  const tagCommit = (
    await command(cwd, 'git', 'rev-list', '-n', '1', 'v1.1.0')
  ).stdout.trim()
  await commit(cwd, 'docs: reformat changelog')
  const head = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()
  const requests: GitHubRequest[] = []

  await runChangelog(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
      stdout: () => {},
      fetch: githubReleaseFetch({ requests }),
    },
  )

  expect(
    (await command(cwd, 'git', 'rev-parse', 'HEAD')).stdout.trim(),
  ).toBe(head)
  expect(
    (await command(cwd, 'git', 'rev-list', '-n', '1', 'v1.1.0')).stdout.trim(),
  ).toBe(tagCommit)
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  })
  const publish = requests.find(request => request.method === 'POST')
  expect(publish?.body?.body).toContain('Add CLI')
  expect(publish?.body?.body).not.toContain('Reformat changelog')
})

test('pushes an existing local tag before publishing a release', async () => {
  const { cwd, remote } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  const tagCommit = (
    await command(cwd, 'git', 'rev-list', '-n', '1', 'v1.1.0')
  ).stdout.trim()

  await runChangelog(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
      stdout: () => {},
      fetch: githubReleaseFetch(),
    },
  )

  expect(
    (await command(
      remote,
      'git',
      'rev-list',
      '-n',
      '1',
      'refs/tags/v1.1.0',
    )).stdout.trim(),
  ).toBe(tagCommit)
})

test('fetches an existing remote tag before publishing a release', async () => {
  const { cwd } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  const tagCommit = (
    await command(cwd, 'git', 'rev-list', '-n', '1', 'v1.1.0')
  ).stdout.trim()
  await command(cwd, 'git', 'push', 'origin', 'HEAD', 'refs/tags/v1.1.0')
  await command(cwd, 'git', 'tag', '--delete', 'v1.1.0')
  const head = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()

  await runChangelog(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
      stdout: () => {},
      fetch: githubReleaseFetch(),
    },
  )

  expect(
    (await command(cwd, 'git', 'rev-list', '-n', '1', 'v1.1.0')).stdout.trim(),
  ).toBe(tagCommit)
  expect(
    (await command(cwd, 'git', 'rev-parse', 'HEAD')).stdout.trim(),
  ).toBe(head)
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  })
})

test('rejects conflicting local and remote release tags', async () => {
  const { cwd, remote } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  await command(cwd, 'git', 'push', 'origin', 'HEAD', 'refs/tags/v1.1.0')
  const remoteTag = (
    await command(remote, 'git', 'rev-list', '-n', '1', 'refs/tags/v1.1.0')
  ).stdout.trim()
  await commit(cwd, 'fix: late change')
  await command(cwd, 'git', 'tag', '--delete', 'v1.1.0')
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  const localTag = (
    await command(cwd, 'git', 'rev-list', '-n', '1', 'v1.1.0')
  ).stdout.trim()
  let requested = false

  await expect(runChangelog(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
      fetch: async () => {
        requested = true
        return Response.json({})
      },
    },
  )).rejects.toThrow(
    'Tag v1.1.0 differs between local and origin',
  )

  expect(requested).toBe(false)
  expect(
    (await command(cwd, 'git', 'rev-list', '-n', '1', 'v1.1.0')).stdout.trim(),
  ).toBe(localTag)
  expect(
    (await command(remote, 'git', 'rev-list', '-n', '1', 'refs/tags/v1.1.0'))
      .stdout.trim(),
  ).toBe(remoteTag)
})

test('releases while preserving unrelated working tree changes', async () => {
  const { cwd, remote } = await createReleaseRepository()
  await writeFile(join(cwd, 'file.txt'), 'uncommitted change')

  await runChangelog(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
      stdout: () => {},
      fetch: githubReleaseFetch(),
    },
  )

  expect(
    (await command(cwd, 'git', 'status', '--short', 'file.txt')).stdout.trim(),
  ).toBe('M file.txt')
  expect(await readFile(join(cwd, 'file.txt'), 'utf8')).toBe(
    'uncommitted change',
  )
  expect(
    (await command(
      remote,
      'git',
      'rev-list',
      '-n',
      '1',
      'refs/tags/v1.1.0',
    )).stdout.trim(),
  ).not.toBe('')
})

test('previews a release without local or remote mutations with --dry', async () => {
  const { cwd, remote } = await createReleaseRepository()
  const head = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()
  let requested = false

  await runChangelog(
    { version: '1.1.0', release: true, dry: true },
    {
      cwd,
      stdout: () => {},
      fetch: async () => {
        requested = true
        return Response.json({ items: [] })
      },
    },
  )

  expect(requested).toBe(false)
  expect(
    (await command(cwd, 'git', 'rev-parse', 'HEAD')).stdout.trim(),
  ).toBe(head)
  expect(
    (await command(cwd, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('')
  expect(
    (await command(remote, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('')
  expect(
    JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')).version,
  ).toBe('1.0.0')
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  })
})

test('does not fetch a missing local tag during a release dry run', async () => {
  const { cwd } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  await command(cwd, 'git', 'push', 'origin', 'HEAD', 'refs/tags/v1.1.0')
  await command(cwd, 'git', 'tag', '--delete', 'v1.1.0')

  await runChangelog(
    { version: '1.1.0', release: true, dry: true, token: 'secret' },
    {
      cwd,
      stdout: () => {},
      fetch: async () => {
        throw new Error('Provider API must not be called during a dry run')
      },
    },
  )

  expect(
    (await command(cwd, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('')
})

test('compares a stable release with the previous stable tag', async () => {
  const { cwd } = await createReleaseRepository()
  await command(
    cwd,
    'git',
    'tag',
    '-a',
    'v1.1.0-beta.1',
    '-m',
    'v1.1.0-beta.1',
  )
  await commit(cwd, 'fix: stabilize release')
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  await command(cwd, 'git', 'push', 'origin', 'HEAD', '--tags')
  let releaseBody = ''

  await runChangelog(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
      stdout: () => {},
      fetch: githubReleaseFetch({
        onPublish: body => releaseBody = String(body.body),
      }),
    },
  )

  expect(releaseBody).toContain('Add CLI')
  expect(releaseBody).toContain('Stabilize release')
})
