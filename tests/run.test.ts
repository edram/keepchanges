import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runCli } from '../src/cli'
import { addPackage, command, createRepository } from './git'

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
