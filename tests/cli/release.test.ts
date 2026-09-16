import type { GitHubRequest } from '../fixtures'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import {
  command,
  commit,
  createChangesOptions,
  createReleaseRepository,
  githubReleaseFetch,
} from '../fixtures'

it('creates and pushes a release without Git identity configuration', async () => {
  const { cwd, remote } = await createReleaseRepository()
  const requests: GitHubRequest[] = []
  await command(cwd, 'git', 'config', 'user.name', '')
  await command(cwd, 'git', 'config', 'user.email', '')

  await createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      token: 'secret',
      name: 'Version 1.1.0',
      draft: true,
      prerelease: true,
    },
    {
      cwd,
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
    name: 'Version 1.1.0',
    prerelease: true,
    draft: true,
  })
  expect(publish?.body?.body).toContain('### 🚀 Features')
  expect(publish?.body?.body).toContain('by @test-author')
  expect(publish?.body?.body).not.toContain('## v1.1.0')
})

it('uploads every file from release asset directories', async () => {
  const { cwd } = await createReleaseRepository()
  await mkdir(join(cwd, 'dist', 'types'), { recursive: true })
  await writeFile(join(cwd, 'dist', 'cli.mjs'), 'cli bundle')
  await writeFile(join(cwd, 'dist', 'types', 'index.d.ts'), 'type declarations')
  const uploads: Array<{ name: string, data: string }> = []

  await createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      token: 'secret',
      assets: ['dist'],
      bump: false,
    },
    {
      cwd,
      fetch: githubReleaseFetch({ uploads }),
    },
  )

  expect(uploads).toEqual([
    { name: 'cli.mjs', data: 'cli bundle' },
    { name: 'index.d.ts', data: 'type declarations' },
  ])
  expect(
    JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')).version,
  ).toBe('1.0.0')
  expect(
    (await command(cwd, 'git', 'show', '--format=', '--name-only', 'HEAD'))
      .stdout.trim(),
  ).toBe('CHANGELOG.md')
})

it('uploads assets from folder globs and multiple folders', async () => {
  const { cwd } = await createReleaseRepository()
  await mkdir(join(cwd, 'packages', 'node', 'dist'), { recursive: true })
  await mkdir(join(cwd, 'packages', 'web', 'dist'), { recursive: true })
  await mkdir(join(cwd, 'artifacts'), { recursive: true })
  await writeFile(join(cwd, 'packages', 'node', 'dist', 'node.mjs'), 'node')
  await writeFile(join(cwd, 'packages', 'web', 'dist', 'web.mjs'), 'web')
  await writeFile(join(cwd, 'artifacts', 'checksums.txt'), 'checksums')
  const uploads: Array<{ name: string, data: string }> = []

  await createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      token: 'secret',
      assets: ['packages/*/dist', 'artifacts'],
    },
    {
      cwd,
      fetch: githubReleaseFetch({ uploads }),
    },
  )

  expect(uploads).toEqual([
    { name: 'node.mjs', data: 'node' },
    { name: 'web.mjs', data: 'web' },
    { name: 'checksums.txt', data: 'checksums' },
  ])
})

it('rejects release asset globs without matches before pushing a tag', async () => {
  const { cwd, remote } = await createReleaseRepository()

  await expect(createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      token: 'secret',
      assets: ['packages/*/dist'],
    },
    { cwd, fetch: githubReleaseFetch() },
  )).rejects.toThrow(
    'Release asset pattern did not match: packages/*/dist',
  )

  expect(
    (await command(cwd, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('')
  expect(
    (await command(remote, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('')
})

it('rejects release assets with duplicate file names', async () => {
  const { cwd } = await createReleaseRepository()
  await mkdir(join(cwd, 'dist', 'browser'), { recursive: true })
  await mkdir(join(cwd, 'dist', 'node'), { recursive: true })
  await writeFile(join(cwd, 'dist', 'browser', 'index.js'), 'browser')
  await writeFile(join(cwd, 'dist', 'node', 'index.js'), 'node')

  await expect(createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      token: 'secret',
      assets: ['dist'],
    },
    { cwd, fetch: githubReleaseFetch() },
  )).rejects.toThrow('Release assets must have unique file names: index.js')
})

it('validates release assets before creating or pushing a tag', async () => {
  const { cwd, remote } = await createReleaseRepository()
  const head = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()

  await expect(createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      token: 'secret',
      assets: ['missing.zip'],
    },
    { cwd, fetch: githubReleaseFetch() },
  )).rejects.toThrow('Release asset does not exist:')

  expect(
    (await command(cwd, 'git', 'rev-parse', 'HEAD')).stdout.trim(),
  ).toBe(head)
  expect(
    (await command(cwd, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('')
  expect(
    (await command(remote, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('')
})

it('requires a provider token before releasing assets', async () => {
  const { cwd, remote } = await createReleaseRepository()
  await writeFile(join(cwd, 'artifact.zip'), 'archive')

  await expect(createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      assets: ['artifact.zip'],
    },
    { cwd, env: {} },
  )).rejects.toThrow('A GitHub token is required to upload release assets')

  expect(
    (await command(cwd, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('')
  expect(
    (await command(remote, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('')
})

it('creates and pushes a release commit and tag without publishing', async () => {
  const { cwd, remote } = await createReleaseRepository()
  let requested = false

  await createChangesOptions(
    { version: '1.1.0', tag: true },
    {
      cwd,
      fetch: async () => {
        requested = true
        return Response.json({})
      },
    },
  )

  expect(requested).toBe(false)
  expect(
    (await command(cwd, 'git', 'log', '-1', '--format=%s')).stdout.trim(),
  ).toBe('chore(release): v1.1.0')
  expect(
    (await command(remote, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('v1.1.0')
})

it('uploads assets built after creating the release tag', async () => {
  const { cwd } = await createReleaseRepository()
  await createChangesOptions({ version: '1.1.0', tag: true }, { cwd })
  const releaseCommit = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()
  await mkdir(join(cwd, 'dist'))
  await writeFile(join(cwd, 'dist', 'keepchanges.mjs'), 'tagged build')
  const uploads: Array<{ name: string, data: string }> = []

  await createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      token: 'secret',
      assets: ['dist'],
    },
    {
      cwd,
      fetch: githubReleaseFetch({ uploads }),
    },
  )

  expect(uploads).toEqual([
    { name: 'keepchanges.mjs', data: 'tagged build' },
  ])
  expect(
    (await command(cwd, 'git', 'rev-parse', 'HEAD')).stdout.trim(),
  ).toBe(releaseCommit)
  expect(
    (await command(cwd, 'git', 'rev-list', '-n', '1', 'v1.1.0')).stdout.trim(),
  ).toBe(releaseCommit)
})

it('tags and releases prebuilt assets without version or changelog updates', async () => {
  const { cwd } = await createReleaseRepository()
  const releaseCommit = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()
  await mkdir(join(cwd, 'dist'))
  await writeFile(join(cwd, 'dist', 'application.zip'), 'prebuilt archive')
  const uploads: Array<{ name: string, data: string }> = []

  await createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      token: 'secret',
      assets: ['dist'],
      bump: false,
      changelog: false,
    },
    {
      cwd,
      fetch: githubReleaseFetch({ uploads }),
    },
  )

  expect(uploads).toEqual([
    { name: 'application.zip', data: 'prebuilt archive' },
  ])
  expect(
    (await command(cwd, 'git', 'rev-parse', 'HEAD')).stdout.trim(),
  ).toBe(releaseCommit)
  expect(
    JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')).version,
  ).toBe('1.0.0')
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  })
})

it('creates a release tag without a prefix', async () => {
  const { cwd, remote } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '--delete', 'v1.0.0')
  await command(cwd, 'git', 'tag', '1.0.0', 'HEAD~2')
  const requests: GitHubRequest[] = []

  await createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      token: 'secret',
      tagPrefix: '',
    },
    {
      cwd,
      fetch: githubReleaseFetch({ requests, tag: '1.1.0' }),
    },
  )

  expect(
    (await command(cwd, 'git', 'log', '-1', '--format=%s')).stdout.trim(),
  ).toBe('chore(release): 1.1.0')
  expect(
    (await command(remote, 'git', 'tag', '--list', '1.1.0')).stdout.trim(),
  ).toBe('1.1.0')
  expect(
    (await command(remote, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('')
  const publish = requests.find(request => request.method === 'POST')
  expect(publish?.body).toMatchObject({
    tag_name: '1.1.0',
    name: '1.1.0',
  })
  expect(publish?.body?.body).toContain(
    'https://github.com/example/project/compare/1.0.0...1.1.0',
  )
})

it('skips provider requests without a token', async () => {
  const { cwd, remote } = await createReleaseRepository()
  let output = ''

  await createChangesOptions(
    { version: '1.1.0', release: true },
    {
      cwd,
      env: {},
      stdout: value => output += value,
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
  expect(output).toContain(
    'No GitHub token found, specify it via --token or GITHUB_TOKEN env. Release skipped.',
  )
})

it('links to manually editing an existing tag without a token', async () => {
  const { cwd } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  await command(cwd, 'git', 'push', 'origin', 'HEAD', 'refs/tags/v1.1.0')
  let output = ''

  await createChangesOptions(
    { version: '1.1.0', release: true },
    {
      cwd,
      env: {},
      stdout: value => output += value,
    },
  )

  expect(output).toContain('Using the following link to edit it manually:')
  expect(output).toContain(
    'https://github.com/example/project/releases/edit/v1.1.0',
  )
})

it('prints a manual Gitea release URL without a token', async () => {
  const { cwd, remote } = await createReleaseRepository()
  let output = ''

  await createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      repository: 'https://gitea.example.com/example/project.git',
    },
    {
      cwd,
      env: {},
      stdout: value => output += value,
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
  expect(output).toContain(
    'No Gitea token found, specify it via --token or GITEA_TOKEN env. Release skipped.',
  )
  expect(output).toContain(
    'https://gitea.example.com/example/project/releases/new?tag=v1.1.0',
  )
})

it('rejects release assets for repositories that cannot upload them', async () => {
  const { cwd } = await createReleaseRepository()
  await writeFile(join(cwd, 'artifact.zip'), 'archive')

  await expect(createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      repository: 'https://gitea.example.com/example/project.git',
      assets: ['artifact.zip'],
    },
    { cwd, env: {} },
  )).rejects.toThrow('Gitea does not support release assets')
})

it('reuses a release commit created before --release', async () => {
  const { cwd } = await createReleaseRepository()
  await createChangesOptions(
    { version: '1.1.0', commit: true, token: 'secret' },
    { cwd, fetch: githubReleaseFetch() },
  )
  const releaseCommit = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()

  await createChangesOptions(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
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

it('publishes an existing tag without moving it or including later commits', async () => {
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

  await createChangesOptions(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
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

it('pushes an existing local tag before publishing a release', async () => {
  const { cwd, remote } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  const tagCommit = (
    await command(cwd, 'git', 'rev-list', '-n', '1', 'v1.1.0')
  ).stdout.trim()

  await createChangesOptions(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
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

it('fetches an existing remote tag before publishing a release', async () => {
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

  await createChangesOptions(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
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

it('rejects conflicting local and remote release tags', async () => {
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

  await expect(createChangesOptions(
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

it('releases while preserving unrelated working tree changes', async () => {
  const { cwd, remote } = await createReleaseRepository()
  await writeFile(join(cwd, 'file.txt'), 'uncommitted change')

  await createChangesOptions(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
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

it('previews a release without local or remote mutations with --dry', async () => {
  const { cwd, remote } = await createReleaseRepository()
  const head = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()
  let requested = false

  await createChangesOptions(
    { version: '1.1.0', release: true, dry: true },
    {
      cwd,
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

it('links to editing an existing tag during a release dry run', async () => {
  const { cwd } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  await command(cwd, 'git', 'push', 'origin', 'HEAD', 'refs/tags/v1.1.0')
  let output = ''

  await createChangesOptions(
    { version: '1.1.0', release: true, dry: true },
    {
      cwd,
      env: {},
      stdout: value => output += value,
    },
  )

  expect(output).toContain('Using the following link to edit it manually:')
  expect(output).toContain(
    'https://github.com/example/project/releases/edit/v1.1.0',
  )
  expect(output).not.toContain('/releases/new')
})

it('links to editing an existing Gitea tag during a release dry run', async () => {
  const { cwd } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  await command(cwd, 'git', 'push', 'origin', 'HEAD', 'refs/tags/v1.1.0')
  let output = ''

  await createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      dry: true,
      repository: 'https://gitea.example.com/example/project.git',
    },
    {
      cwd,
      env: {},
      stdout: value => output += value,
    },
  )

  expect(output).toContain(
    'https://gitea.example.com/example/project/releases/edit/v1.1.0',
  )
  expect(output).not.toContain('/releases/new')
})

it('resolves authors while previewing a release', async () => {
  const { cwd } = await createReleaseRepository()
  const requests: GitHubRequest[] = []
  let output = ''

  await createChangesOptions(
    { version: '1.1.0', release: true, dry: true, token: 'secret' },
    {
      cwd,
      stdout: value => output += value,
      fetch: githubReleaseFetch({ requests }),
    },
  )

  expect(output).toContain('by @test-author')
  expect(requests).toHaveLength(1)
  expect(requests[0]).toMatchObject({
    method: 'GET',
  })
  expect(requests[0].url).toContain('/search/users')
})

it('does not fetch a missing local tag during a release dry run', async () => {
  const { cwd } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '-a', 'v1.1.0', '-m', 'v1.1.0')
  await command(cwd, 'git', 'push', 'origin', 'HEAD', 'refs/tags/v1.1.0')
  await command(cwd, 'git', 'tag', '--delete', 'v1.1.0')

  await createChangesOptions(
    { version: '1.1.0', release: true, dry: true, token: 'secret' },
    {
      cwd,
      fetch: githubReleaseFetch(),
    },
  )

  expect(
    (await command(cwd, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('')
})

it('compares a stable release with the previous stable tag', async () => {
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

  await createChangesOptions(
    { version: '1.1.0', release: true, token: 'secret' },
    {
      cwd,
      fetch: githubReleaseFetch({
        onPublish: body => releaseBody = String(body.body),
      }),
    },
  )

  expect(releaseBody).toContain('Add CLI')
  expect(releaseBody).toContain('Stabilize release')
})

it('compares a custom-prefixed stable release with the previous stable tag', async () => {
  const { cwd } = await createReleaseRepository()
  await command(cwd, 'git', 'tag', '--delete', 'v1.0.0')
  await command(cwd, 'git', 'tag', 'package@1.0.0', 'HEAD~2')
  await command(
    cwd,
    'git',
    'tag',
    '-a',
    'package@1.1.0-beta.1',
    '-m',
    'package@1.1.0-beta.1',
  )
  await commit(cwd, 'fix: stabilize release')
  await command(
    cwd,
    'git',
    'tag',
    '-a',
    'package@1.1.0',
    '-m',
    'package@1.1.0',
  )
  await command(cwd, 'git', 'push', 'origin', 'HEAD', '--tags')
  let releaseBody = ''

  await createChangesOptions(
    {
      version: '1.1.0',
      release: true,
      token: 'secret',
      tagPrefix: 'package@',
    },
    {
      cwd,
      fetch: githubReleaseFetch({
        tag: 'package@1.1.0',
        onPublish: body => releaseBody = String(body.body),
      }),
    },
  )

  expect(releaseBody).toContain('Add CLI')
  expect(releaseBody).toContain('Stabilize release')
})
