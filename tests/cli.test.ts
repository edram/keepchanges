import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runCli } from '../src'
import { command, commit, createRepository } from './git'

const expectedChangelog = [
  '# Changelog',
  '',
  '## v1.1.0',
  '',
  '### 🚀 Features',
  '',
  '- Add CLI',
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
      '- Add CLI',
      '',
      '### 🐞 Bug Fixes',
      '',
      '- Handle invalid input',
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
    `- Add CLI &nbsp;-&nbsp; [<samp>(${hash.slice(0, 5)})</samp>](https://github.com/example/project/commit/${hash})`,
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
      '- Add CLI',
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
