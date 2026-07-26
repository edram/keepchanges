import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runCli } from '../src/cli'
import { command, commit } from './git'
import {
  createReleaseRepository,
  githubReleaseFetch,
} from './release'
import type { GitHubRequest } from './release'

test('creates and pushes a tag before publishing a GitHub release', async () => {
  const { cwd, remote } = await createReleaseRepository()
  const requests: GitHubRequest[] = []

  await runCli(
    ['1.1.0', '--release', '--token', 'secret'],
    {
      cwd,
      stdout: () => {},
      fetch: githubReleaseFetch({ requests }),
    },
  )

  expect(
    (await command(cwd, 'git', 'log', '-1', '--format=%s')).stdout.trim(),
  ).toBe('chore(release): v1.1.0')
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
  expect(publish?.body?.body).not.toContain('## v1.1.0')
})

test('provides a prefilled manual release link without a token', async () => {
  const { cwd, remote } = await createReleaseRepository()
  let output = ''

  await runCli(
    ['1.1.0', '--release'],
    {
      cwd,
      env: {},
      stdout: value => output += value,
      fetch: async () => {
        throw new Error('Provider API must not be called without a token')
      },
    },
  )

  expect(output).toMatch(/^gitchangelog v\d+\.\d+\.\d+\n/)
  expect(output).toContain('v1.0.0 -> v1.1.0 (2 commits)\n')
  expect(output).toContain('--------------\n\n### 🚀 Features\n')
  expect(output).toContain(
    '- Add CLI - by **Test Author** [<samp>',
  )
  expect(output).toContain('\n##### [View changes on GitHub]')
  expect(output).toContain(
    [
      '--------------',
      'No GitHub token found, specify it via GITHUB_TOKEN env. Release skipped.',
      '',
      'Using the following link to create it manually:',
    ].join('\n'),
  )
  expect(output).not.toContain('&nbsp;')
  const url = new URL(output.trim().split('\n').at(-1)!)
  expect(`${url.origin}${url.pathname}`).toBe(
    'https://github.com/example/project/releases/new',
  )
  expect(url.searchParams.get('title')).toBe('v1.1.0')
  expect(url.searchParams.get('tag')).toBe('v1.1.0')
  expect(url.searchParams.get('prerelease')).toBe('false')
  expect(url.searchParams.get('body')).toContain('### 🚀 Features')
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
  await runCli(
    ['1.1.0', '--commit', '--token', 'secret'],
    { cwd, fetch: githubReleaseFetch() },
  )
  const releaseCommit = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()

  await runCli(
    ['1.1.0', '--release', '--token', 'secret'],
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

  await runCli(
    ['1.1.0', '--release', '--token', 'secret'],
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

test('updates an existing GitHub release for the same tag', async () => {
  const { cwd } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  await command(cwd, 'git', 'push', 'origin', 'HEAD', 'refs/tags/v1.1.0')
  const requests: Array<{ url: string, method: string }> = []
  let output = ''

  await runCli(
    ['1.1.0', '--release', '--token', 'secret'],
    {
      cwd,
      stdout: value => output += value,
      fetch: githubReleaseFetch({ existing: true, requests }),
    },
  )

  expect(output).toContain('gitchangelog v')
  expect(output).toContain(
    'Updated GitHub release: https://github.com/example/project/releases/tag/v1.1.0\n',
  )
  expect(requests).toContainEqual(expect.objectContaining({
    url: 'https://api.github.com/repos/example/project/releases/42',
    method: 'PATCH',
  }))
  expect(requests.some(request => request.method === 'POST')).toBe(false)
})

test('pushes an existing local tag before publishing a release', async () => {
  const { cwd, remote } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  const tagCommit = (
    await command(cwd, 'git', 'rev-list', '-n', '1', 'v1.1.0')
  ).stdout.trim()

  await runCli(
    ['1.1.0', '--release', '--token', 'secret'],
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

  await runCli(
    ['1.1.0', '--release', '--token', 'secret'],
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

  await expect(runCli(
    ['1.1.0', '--release', '--token', 'secret'],
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

  await runCli(
    ['1.1.0', '--release', '--token', 'secret'],
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
  let output = ''
  let requested = false

  await runCli(
    ['1.1.0', '--release', '--dry'],
    {
      cwd,
      stdout: value => output += value,
      fetch: async () => {
        requested = true
        return Response.json({ items: [] })
      },
    },
  )

  expect(requested).toBe(false)
  expect(output).toMatch(/^gitchangelog v\d+\.\d+\.\d+\n/)
  expect(output).toContain('v1.0.0 -> v1.1.0 (2 commits)\n')
  expect(output).toContain('### 🚀 Features')
  expect(output).not.toContain('## v1.1.0')
  expect(output).toContain(
    '--------------\nDry run. Release skipped.\n\nUsing the following link to create it manually:\n',
  )
  const url = new URL(output.trim().split('\n').at(-1)!)
  expect(url.searchParams.get('tag')).toBe('v1.1.0')
  expect(url.searchParams.get('body')).toContain('### 🚀 Features')
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

  await runCli(
    ['1.1.0', '--release', '--dry', '--token', 'secret'],
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

  await runCli(
    ['1.1.0', '--release', '--token', 'secret'],
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
