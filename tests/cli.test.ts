import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runCli } from '../src'
import {
  command,
  commit,
  createBareRepository,
  createRepository,
} from './git'

const expectedChangelog = [
  '# Changelog',
  '',
  '## v1.1.0',
  '',
  '### 🚀 Features',
  '',
  '- Add CLI &nbsp;-&nbsp; by **Test Author**',
  '',
].join('\n')

test('writes changes since the latest tag to CHANGELOG.md', async () => {
  const cwd = await createRepository()

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toBe(expectedChangelog)
})

test('writes the first release when the repository has no tags', async () => {
  const cwd = await createRepository()
  await command(cwd, 'git', 'tag', '--delete', 'v1.0.0')

  await runCli(['0.0.1'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain('## v0.0.1')
  expect(changelog).toContain('- Add CLI')
})

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

test('accepts a release version with a v prefix', async () => {
  const cwd = await createRepository()

  await runCli(['v1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toBe(expectedChangelog)
})

test('requires a release version without writing a changelog', async () => {
  const cwd = await createRepository()

  await expect(runCli([], { cwd })).rejects.toThrow(
    'A release version is required',
  )
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  })
})

test('writes to the path provided with --output', async () => {
  const cwd = await createRepository()

  await runCli(
    ['1.1.0', '--output', 'notes.md'],
    { cwd },
  )

  await expect(readFile(join(cwd, 'notes.md'), 'utf8')).resolves.toBe(expectedChangelog)
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  })
})

test('prints the changelog without writing a file with --dry', async () => {
  const cwd = await createRepository()
  let output = ''

  await runCli(
    ['1.1.0', '--dry'],
    {
      cwd,
      stdout: value => output += value,
    },
  )

  expect(output).toBe(expectedChangelog)
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  })
})

test('commits the changelog with --commit', async () => {
  const cwd = await createRepository()

  await runCli(['1.1.0', '--commit'], { cwd })

  const subject = (
    await command(cwd, 'git', 'log', '-1', '--format=%s')
  ).stdout.trim()
  expect(subject).toBe('chore(release): v1.1.0')
  expect(
    (await command(cwd, 'git', 'show', 'HEAD:CHANGELOG.md')).stdout,
  ).toBe(expectedChangelog)
})

test('updates and commits an npm package version with --commit', async () => {
  const cwd = await createRepository()
  await addPackage(cwd)

  await runCli(['1.1.0', '--commit'], { cwd })

  const packageJson = JSON.parse(
    await readFile(join(cwd, 'package.json'), 'utf8'),
  )
  expect(packageJson.version).toBe('1.1.0')
  const committedFiles = (
    await command(cwd, 'git', 'show', '--format=', '--name-only', 'HEAD')
  ).stdout.trim().split('\n').sort()
  expect(committedFiles).toEqual(['CHANGELOG.md', 'package.json'])
})

test('updates an npm package version without --commit', async () => {
  const cwd = await createRepository()
  await addPackage(cwd)
  const head = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()

  await runCli(['1.1.0'], { cwd })

  const packageJson = JSON.parse(
    await readFile(join(cwd, 'package.json'), 'utf8'),
  )
  expect(packageJson.version).toBe('1.1.0')
  expect(
    (await command(cwd, 'git', 'rev-parse', 'HEAD')).stdout.trim(),
  ).toBe(head)
})

test('commits with the author provided by --author', async () => {
  const cwd = await createRepository()

  await runCli(
    ['1.1.0', '--commit', '--author', 'Release Author <release@example.com>'],
    { cwd },
  )

  const identity = (
    await command(
      cwd,
      'git',
      'log',
      '-1',
      '--format=%an%x00%ae%x00%cn%x00%ce',
    )
  ).stdout.trim().split('\0')
  expect(identity).toEqual([
    'Release Author',
    'release@example.com',
    'Test Author',
    'author@example.com',
  ])
})

test('commits only the changelog and preserves other staged changes', async () => {
  const cwd = await createRepository()
  await writeFile(join(cwd, 'staged.txt'), 'keep staged')
  await command(cwd, 'git', 'add', 'staged.txt')

  await runCli(['1.1.0', '--commit'], { cwd })

  const committedFiles = (
    await command(cwd, 'git', 'show', '--format=', '--name-only', 'HEAD')
  ).stdout.trim().split('\n')
  expect(committedFiles).toEqual(['CHANGELOG.md'])
  expect(
    (await command(cwd, 'git', 'diff', '--cached', '--name-only')).stdout.trim(),
  ).toBe('staged.txt')
})

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

test('rejects a dirty working tree before accessing origin', async () => {
  const { cwd } = await createReleaseRepository()
  await command(
    cwd,
    'git',
    'remote',
    'set-url',
    'origin',
    join(cwd, 'missing.git'),
  )
  await writeFile(join(cwd, 'file.txt'), 'uncommitted change')
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
    'Working tree must be clean to create tag v1.1.0',
  )

  expect(requested).toBe(false)
  expect(
    (await command(cwd, 'git', 'tag', '--list', 'v1.1.0')).stdout.trim(),
  ).toBe('')
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  })
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
  expect(output).toContain('## v1.1.0')
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

test('groups fix commits under Bug Fixes', async () => {
  const cwd = await createRepository()
  await commit(cwd, 'fix: handle invalid input')

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toBe(
    [
      '# Changelog',
      '',
      '## v1.1.0',
      '',
      '### 🚀 Features',
      '',
      '- Add CLI &nbsp;-&nbsp; by **Test Author**',
      '',
      '### 🐞 Bug Fixes',
      '',
      '- Handle invalid input &nbsp;-&nbsp; by **Test Author**',
      '',
    ].join('\n'),
  )
})

test('renders a conventional commit scope', async () => {
  const cwd = await createRepository()
  await commit(cwd, 'fix(parser): handle separators')

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    '- **parser**: Handle separators',
  )
})

test('renders the Git author for each commit', async () => {
  const cwd = await createRepository()

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    '- Add CLI &nbsp;-&nbsp; by **Test Author**',
  )
})

test('renders co-authors as commit participants', async () => {
  const cwd = await createRepository()
  await commit(
    cwd,
    'fix: support pairs',
    'Co-Authored-By: Second Author <second@example.com>',
  )

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    '- Support pairs &nbsp;-&nbsp; by **Test Author** and **Second Author**',
  )
})

test('excludes bot commit participants', async () => {
  const cwd = await createRepository()
  await commit(
    cwd,
    'fix: update dependencies',
    [
      'Co-Authored-By: automation[bot] <automation@example.com>',
      'Co-Authored-By: Dependabot <dependabot@example.com>',
      'Co-Authored-By: Release (bot) <release@example.com>',
    ].join('\n'),
  )

  await runCli(['1.1.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain(
    '- Update dependencies &nbsp;-&nbsp; by **Test Author**',
  )
  expect(changelog).not.toMatch(/\[bot\]|dependabot|\(bot\)/i)
})

test('omits empty author details for bot-authored commits', async () => {
  const cwd = await createRepository()
  await command(cwd, 'git', 'config', 'user.name', 'automation[bot]')
  await command(cwd, 'git', 'config', 'user.email', 'bot@example.com')
  await commit(cwd, 'fix: automated update')

  await runCli(['1.1.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain('\n- Automated update\n')
  expect(changelog).not.toContain('by **automation[bot]**')
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

test('escapes HTML characters in commit scopes and descriptions', async () => {
  const cwd = await createRepository()
  await commit(cwd, 'feat(ui<button>): support generic<T> & "quoted" \'single\' APIs')

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    '- **ui&lt;button&gt;**: Support generic&lt;T&gt; &amp; &quot;quoted&quot; &#39;single&#39; APIs',
  )
})

test('renders an exclamation-mark commit only under Breaking Changes', async () => {
  const cwd = await createRepository()
  await commit(cwd, 'feat!: remove the legacy API')

  await runCli(['2.0.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain([
    '### 🚨 Breaking Changes',
    '',
    '- Remove the legacy API',
  ].join('\n'))
  expect(changelog.match(/Remove the legacy API/g)).toHaveLength(1)
})

test('recognizes a BREAKING-CHANGE trailer', async () => {
  const cwd = await createRepository()
  await commit(
    cwd,
    'fix: change the configuration format',
    'BREAKING-CHANGE: configuration files must be migrated',
  )

  await runCli(['2.0.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain([
    '### 🚨 Breaking Changes',
    '',
    '- Change the configuration format',
  ].join('\n'))
})

test('recognizes a BREAKING CHANGE trailer', async () => {
  const cwd = await createRepository()
  await commit(
    cwd,
    'fix: change the plugin API',
    'BREAKING CHANGE: plugins must export a factory',
  )

  await runCli(['2.0.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain('- Change the plugin API')
  expect(changelog.indexOf('Change the plugin API')).toBeLessThan(
    changelog.indexOf('### 🚀 Features'),
  )
})

test('inserts a release before existing changelog history', async () => {
  const cwd = await createRepository()
  const existingChangelog = [
    '# Changelog',
    '',
    'Project release history.',
    '',
    '## v1.0.0',
    '',
    '- Initial release',
    '',
  ].join('\n')
  await writeFile(join(cwd, 'CHANGELOG.md'), existingChangelog)

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toBe(
    [
      '# Changelog',
      '',
      'Project release history.',
      '',
      '## v1.1.0',
      '',
      '### 🚀 Features',
      '',
      '- Add CLI &nbsp;-&nbsp; by **Test Author**',
      '',
      '## v1.0.0',
      '',
      '- Initial release',
      '',
    ].join('\n'),
  )
})

test('replaces an existing release with the same version', async () => {
  const cwd = await createRepository()
  await writeFile(
    join(cwd, 'CHANGELOG.md'),
    [
      '# Changelog',
      '',
      '## v1.1.0',
      '',
      '- Stale content',
      '',
      '## v1.0.0',
      '',
      '- Initial release',
      '',
    ].join('\n'),
  )

  await runCli(['1.1.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog.match(/^## v1\.1\.0$/gm)).toHaveLength(1)
  expect(changelog).not.toContain('Stale content')
  expect(changelog).toContain('## v1.0.0')
})

test('replaces the same release when its existing heading has no v prefix', async () => {
  const cwd = await createRepository()
  await writeFile(
    join(cwd, 'CHANGELOG.md'),
    [
      '# Changelog',
      '',
      '## 1.1.0',
      '',
      '- Stale content',
      '',
      '## v1.0.0',
      '',
      '- Initial release',
      '',
    ].join('\n'),
  )

  await runCli(['1.1.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog.match(/^## v?1\.1\.0$/gm)).toHaveLength(1)
  expect(changelog).toContain('## v1.1.0')
  expect(changelog).not.toContain('Stale content')
})

async function addPackage(cwd: string, repository?: string) {
  await writeFile(
    join(cwd, 'package.json'),
    `${JSON.stringify({
      name: 'test-package',
      version: '1.0.0',
      ...(repository ? { repository } : {}),
    }, null, 2)}\n`,
  )
  await command(cwd, 'git', 'add', 'package.json')
  await command(cwd, 'git', 'commit', '-m', 'chore: add package')
}

async function createReleaseRepository() {
  const cwd = await createRepository()
  const remote = await createBareRepository()
  await command(cwd, 'git', 'remote', 'add', 'origin', remote)
  await addPackage(cwd, 'https://github.com/example/project.git')
  return { cwd, remote }
}

interface GitHubRequest {
  url: string
  method: string
  body?: Record<string, unknown>
}

function githubReleaseFetch(options: {
  existing?: boolean
  requests?: GitHubRequest[]
  onPublish?: (body: Record<string, unknown>) => void
} = {}) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || 'GET'
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body)
      : undefined
    options.requests?.push({ url, method, body })
    if (url.includes('/search/users'))
      return Response.json({ items: [{ login: 'test-author' }] })
    if (url.endsWith('/releases/tags/v1.1.0')) {
      if (options.existing) {
        return Response.json({
          id: 42,
          html_url: 'https://github.com/example/project/releases/tag/v1.1.0',
        })
      }
      return new Response(null, { status: 404 })
    }
    if (
      (url.endsWith('/releases') && method === 'POST')
      || (url.endsWith('/releases/42') && method === 'PATCH')
    ) {
      options.onPublish?.(body)
      return Response.json({
        html_url: 'https://github.com/example/project/releases/tag/v1.1.0',
      })
    }
    throw new Error(`Unexpected request: ${method} ${url}`)
  }
}
