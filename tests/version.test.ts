import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { npmVersionProvider } from '../src/versions/npm'
import { createTemporaryDirectory } from './fixtures'

it('updates the npm package version while preserving its formatting', async () => {
  const cwd = await createTemporaryDirectory('changelog-version-')
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

it('ignores directories without an npm package', async () => {
  const cwd = await createTemporaryDirectory('changelog-version-')

  await expect(npmVersionProvider.update(cwd, '1.1.0'))
    .resolves
    .toBeUndefined()
})
