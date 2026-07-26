import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runCli } from '../src/cli'
import { createRepository } from './git'

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
