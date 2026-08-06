import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { version } from '../../package.json'
import {
  addPackage,
  command,
  createChangesOptions,
  createRepository,
} from '../fixtures'

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

it('creates the first changelog from the initial commit', async () => {
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

  await createChangesOptions({ version: '0.0.1' }, { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain('## v0.0.1')
  expect(changelog).toContain('- Add CLI')
  expect(changelog).toContain(
    `https://github.com/example/project/compare/${firstCommit}...v0.0.1`,
  )
})

it('commits the changelog with --commit', async () => {
  const cwd = await createRepository()

  await createChangesOptions({ version: '1.1.0', commit: true }, { cwd })

  const subject = (
    await command(cwd, 'git', 'log', '-1', '--format=%s')
  ).stdout.trim()
  expect(subject).toBe('chore(release): v1.1.0')
  expect(
    (await command(cwd, 'git', 'show', 'HEAD:CHANGELOG.md')).stdout,
  ).toBe(expectedChangelog)
})

it('updates and commits an npm package version with --commit', async () => {
  const cwd = await createRepository()
  await addPackage(cwd)

  await createChangesOptions({ version: '1.1.0', commit: true }, { cwd })

  const packageJson = JSON.parse(
    await readFile(join(cwd, 'package.json'), 'utf8'),
  )
  expect(packageJson.version).toBe('1.1.0')
  const committedFiles = (
    await command(cwd, 'git', 'show', '--format=', '--name-only', 'HEAD')
  ).stdout.trim().split('\n').sort()
  expect(committedFiles).toEqual(['CHANGELOG.md', 'package.json'])
})

it('commits only release notes when the package version is already committed', async () => {
  const cwd = await createRepository()
  const packageJson = '{"name":"test-package","version":"1.1.0"}\n'
  await writeFile(join(cwd, 'package.json'), packageJson)
  await command(cwd, 'git', 'add', 'package.json')
  await command(cwd, 'git', 'commit', '-m', 'release: v1.1.0')

  await createChangesOptions({ version: '1.1.0', commit: true }, { cwd })

  expect(
    (await command(cwd, 'git', 'log', '-1', '--format=%s')).stdout.trim(),
  ).toBe('docs(changelog): add v1.1.0 release notes')
  expect(
    (await command(cwd, 'git', 'show', '--format=', '--name-only', 'HEAD'))
      .stdout.trim(),
  ).toBe('CHANGELOG.md')
  await expect(readFile(join(cwd, 'package.json'), 'utf8')).resolves.toBe(
    packageJson,
  )
})

it('describes an existing release notes update in the commit message', async () => {
  const cwd = await createRepository()
  await writeFile(
    join(cwd, 'package.json'),
    '{"name":"test-package","version":"1.1.0"}\n',
  )
  await writeFile(
    join(cwd, 'CHANGELOG.md'),
    '# Changelog\n\n## v1.1.0\n\n- Stale release notes\n',
  )
  await command(cwd, 'git', 'add', 'package.json', 'CHANGELOG.md')
  await command(cwd, 'git', 'commit', '-m', 'publish version 1.1.0')

  await createChangesOptions({ version: '1.1.0', commit: true }, { cwd })

  expect(
    (await command(cwd, 'git', 'log', '-1', '--format=%s')).stdout.trim(),
  ).toBe('docs(changelog): update v1.1.0 release notes')
})

it('updates files without committing and honors a custom output path', async () => {
  const cwd = await createRepository()
  await addPackage(cwd)
  const head = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()

  await createChangesOptions(
    { version: '1.1.0', output: 'notes.md' },
    { cwd },
  )

  await expect(readFile(join(cwd, 'notes.md'), 'utf8'))
    .resolves
    .toBe(expectedChangelog)
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8'))
    .rejects
    .toMatchObject({ code: 'ENOENT' })
  expect(
    JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')).version,
  ).toBe('1.1.0')
  expect(
    (await command(cwd, 'git', 'rev-parse', 'HEAD')).stdout.trim(),
  ).toBe(head)
})

it('prints a dry run without modifying files', async () => {
  const cwd = await createRepository()
  const existingChangelog = '# Changelog\n\n## v1.0.0\n\n- Initial release\n'
  await writeFile(join(cwd, 'CHANGELOG.md'), existingChangelog)
  let output = ''

  await createChangesOptions(
    { version: '1.1.0', dry: true },
    { cwd, stdout: value => output += value },
  )

  expect(output).toBe([
    `keepchanges v${version}`,
    'v1.0.0 -> v1.1.0 (1 commits)',
    '--------------',
    '',
    expectedChangelog
      .replace('# Changelog\n\n## v1.1.0\n\n', '')
      .replaceAll('&nbsp;', ''),
    '--------------',
    '',
  ].join('\n'))
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8'))
    .resolves
    .toBe(existingChangelog)
})

it('uses explicit ranges, repository metadata, and style options', async () => {
  const cwd = await createRepository()
  const to = (
    await command(cwd, 'git', 'rev-parse', 'HEAD')
  ).stdout.trim()
  await command(cwd, 'git', 'commit', '--allow-empty', '-m', 'fix: later change')
  let output = ''

  await createChangesOptions(
    {
      version: '1.1.0',
      from: 'v1.0.0',
      to,
      repository: 'example/project',
      dry: true,
      emoji: false,
      capitalize: false,
    },
    { cwd, stdout: value => output += value },
  )

  expect(output).toContain('v1.0.0 -> v1.1.0 (1 commits)')
  expect(output).toContain('### Features')
  expect(output).toContain('- add CLI - by **Test Author**')
  expect(output).not.toContain('🐞 Bug Fixes')
  expect(output).toContain(
    'https://github.com/example/project/compare/v1.0.0...v1.1.0',
  )
})

it('rejects a commit generated from a ref other than HEAD', async () => {
  const cwd = await createRepository()

  await expect(createChangesOptions(
    { version: '1.1.0', to: 'v1.0.0', commit: true },
    { cwd },
  )).rejects.toThrow('--to must resolve to HEAD when used with --commit')
})

it('commits with the author provided by --author', async () => {
  const cwd = await createRepository()

  await createChangesOptions(
    {
      version: '1.1.0',
      commit: true,
      author: 'Release Author <release@example.com>',
    },
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
    'Release Author',
    'release@example.com',
  ])
})

it('commits only the changelog and preserves other staged changes', async () => {
  const cwd = await createRepository()
  await writeFile(join(cwd, 'staged.txt'), 'keep staged')
  await command(cwd, 'git', 'add', 'staged.txt')

  await createChangesOptions({ version: '1.1.0', commit: true }, { cwd })

  const committedFiles = (
    await command(cwd, 'git', 'show', '--format=', '--name-only', 'HEAD')
  ).stdout.trim().split('\n')
  expect(committedFiles).toEqual(['CHANGELOG.md'])
  expect(
    (await command(cwd, 'git', 'diff', '--cached', '--name-only')).stdout.trim(),
  ).toBe('staged.txt')
})
