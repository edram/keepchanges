import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, onTestFinished, test } from 'vitest'
import { npmVersionProvider } from '../src/versions/npm'

async function createDirectory() {
  const cwd = await mkdtemp(join(tmpdir(), 'changelog-version-'))
  onTestFinished(() => rm(cwd, { recursive: true, force: true }))
  return cwd
}

test('updates the npm package version while preserving its formatting', async () => {
  const cwd = await createDirectory()
  const path = join(cwd, 'package.json')
  await writeFile(
    path,
    '{\n    "name": "test-package",\n    "version": "1.0.0"\n}\n',
  )

  await expect(npmVersionProvider.update(cwd, '1.1.0')).resolves.toBe(path)
  await expect(readFile(path, 'utf8')).resolves.toBe(
    '{\n    "name": "test-package",\n    "version": "1.1.0"\n}\n',
  )
})

test('leaves an existing package version unchanged', async () => {
  const cwd = await createDirectory()
  const path = join(cwd, 'package.json')
  const contents = '{"name":"test-package","version":"1.1.0"}'
  await writeFile(path, contents)

  await expect(npmVersionProvider.update(cwd, '1.1.0')).resolves.toBe(path)
  await expect(readFile(path, 'utf8')).resolves.toBe(contents)
})

test('ignores directories without an npm package', async () => {
  const cwd = await createDirectory()

  await expect(npmVersionProvider.update(cwd, '1.1.0'))
    .resolves.toBeUndefined()
})
