import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runCli } from '../src/cli'
import { command, commit, createRepository } from './git'

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

test('escapes HTML characters in commit scopes and descriptions', async () => {
  const cwd = await createRepository()
  await commit(cwd, 'feat(ui<button>): support generic<T> & "quoted" \'single\' APIs')

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    '- **ui&lt;button&gt;**: Support generic&lt;T&gt; &amp; &quot;quoted&quot; &#39;single&#39; APIs',
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

test('keeps prerelease and stable release headings distinct', async () => {
  const cwd = await createRepository()
  await writeFile(
    join(cwd, 'CHANGELOG.md'),
    [
      '# Changelog',
      '',
      '## v1.1.0-beta.1',
      '',
      '- Beta release',
      '',
    ].join('\n'),
  )

  await runCli(['1.1.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain('## v1.1.0\n')
  expect(changelog).toContain('## v1.1.0-beta.1\n')
  expect(changelog).toContain('- Beta release')
})
