import type { Output } from 'tinyexec'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { x } from 'tinyexec'
import { onTestFinished } from 'vitest'

export async function createRepository(prefix = 'changelog-'): Promise<string> {
  let cwd: string | undefined
  onTestFinished(async () => {
    if (cwd)
      await rm(cwd, { recursive: true, force: true })
  })

  cwd = await mkdtemp(join(tmpdir(), prefix))
  await command(cwd, 'git', 'init')
  await command(cwd, 'git', 'config', 'user.name', 'Test Author')
  await command(cwd, 'git', 'config', 'user.email', 'author@example.com')
  await commit(cwd, 'chore: initial')
  await command(cwd, 'git', 'tag', 'v1.0.0')
  await commit(cwd, 'feat: add CLI')

  return cwd
}

export async function createBareRepository(
  prefix = 'changelog-remote-',
): Promise<string> {
  let cwd: string | undefined
  onTestFinished(async () => {
    if (cwd)
      await rm(cwd, { recursive: true, force: true })
  })

  cwd = await mkdtemp(join(tmpdir(), prefix))
  await command(cwd, 'git', 'init', '--bare')
  return cwd
}

export async function addPackage(
  cwd: string,
  repository?: string,
): Promise<void> {
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

export async function commit(
  cwd: string,
  message: string,
  body?: string,
): Promise<void> {
  await writeFile(join(cwd, 'file.txt'), message)
  await command(cwd, 'git', 'add', 'file.txt')
  await command(cwd, 'git', 'commit', '-m', message, ...(body ? ['-m', body] : []))
}

export async function command(
  cwd: string,
  executable: string,
  ...args: string[]
): Promise<Output> {
  return x(executable, args, {
    nodeOptions: { cwd },
    throwOnError: true,
  })
}
