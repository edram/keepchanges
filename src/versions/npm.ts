import type { VersionProvider } from '../version'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const npmVersionProvider: VersionProvider = {
  async update(cwd, version) {
    const path = resolve(cwd, 'package.json')
    const contents = await readFile(path, 'utf8').catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT')
          return
        throw error
      },
    )
    if (contents === undefined)
      return

    const packageJson = JSON.parse(contents)
    if (packageJson.version === version)
      return path

    packageJson.version = version

    const indent = /\n([ \t]+)"/.exec(contents)?.[1] ?? '  '
    const newline = contents.endsWith('\n') ? '\n' : ''
    await writeFile(
      path,
      `${JSON.stringify(packageJson, null, indent)}${newline}`,
    )
    return path
  },
}
