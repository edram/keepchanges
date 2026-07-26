import { mkdir, readFile, symlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { command, createRepository } from './git'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

test('the packaged changelog command can generate a dry-run preview', async () => {
  const packageJson = JSON.parse(
    await readFile(join(packageRoot, 'package.json'), 'utf8'),
  )
  expect(packageJson.bin).toEqual({
    changelog: './dist/cli.mjs',
  })

  const cwd = await createRepository('gitchangelog-bin-')
  const binDirectory = join(cwd, 'node_modules', '.bin')
  const executable = join(binDirectory, 'changelog')
  await mkdir(binDirectory, { recursive: true })
  await symlink(resolve(packageRoot, packageJson.bin.changelog), executable)

  const result = await command(
    cwd,
    executable,
    '1.1.0',
    '--dry',
  )

  expect(result.stdout).toContain('## v1.1.0')
  expect(result.stdout).toContain('- Add CLI')
  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  })
})
