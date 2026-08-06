import type { Output } from 'tinyexec'
import type { CreateChangesEnvironment } from '../src/cli/createChanges'
import type { Options } from '../src/cli/options'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Ansis } from 'ansis'
import { x } from 'tinyexec'
import { onTestFinished } from 'vitest'
import { createChanges } from '../src/cli/createChanges'
import { resolveOptions } from '../src/cli/options'

export type TestOptions = Partial<Omit<Options, 'version'>> & {
  version: string
}

export interface GitHubRequest {
  url: string
  method: string
  body?: Record<string, unknown>
}

export async function createTemporaryDirectory(prefix = 'keepchanges-'): Promise<string> {
  let cwd: string | undefined
  onTestFinished(async () => {
    if (cwd)
      await rm(cwd, { recursive: true, force: true })
  })
  cwd = await mkdtemp(join(tmpdir(), prefix))
  return cwd
}

export async function createRepository(prefix = 'changelog-'): Promise<string> {
  const cwd = await createTemporaryDirectory(prefix)
  await command(cwd, 'git', 'init')
  await command(cwd, 'git', 'config', 'user.name', 'Test Author')
  await command(cwd, 'git', 'config', 'user.email', 'author@example.com')
  await commit(cwd, 'chore: initial')
  await command(cwd, 'git', 'tag', 'v1.0.0')
  await commit(cwd, 'feat: add CLI')
  return cwd
}

export async function createBareRepository(prefix = 'changelog-remote-'): Promise<string> {
  const cwd = await createTemporaryDirectory(prefix)
  await command(cwd, 'git', 'init', '--bare')
  return cwd
}

export async function createReleaseRepository(): Promise<{ cwd: string, remote: string }> {
  const cwd = await createRepository()
  const remote = await createBareRepository()
  await command(cwd, 'git', 'remote', 'add', 'origin', remote)
  await addPackage(cwd, 'https://github.com/example/project.git')
  return { cwd, remote }
}

export async function addPackage(cwd: string, repository?: string): Promise<void> {
  await writeFile(join(cwd, 'package.json'), `${JSON.stringify({
    name: 'test-package',
    version: '1.0.0',
    ...(repository ? { repository } : {}),
  }, null, 2)}\n`)
  await command(cwd, 'git', 'add', 'package.json')
  await command(cwd, 'git', 'commit', '-m', 'chore: add package')
}

export async function commit(cwd: string, message: string, body?: string): Promise<void> {
  await writeFile(join(cwd, 'file.txt'), message)
  await command(cwd, 'git', 'add', 'file.txt')
  await command(cwd, 'git', 'commit', '-m', message, ...(body ? ['-m', body] : []))
}

export async function command(cwd: string, executable: string, ...args: string[]): Promise<Output> {
  return x(executable, args, {
    nodeOptions: { cwd },
    throwOnError: true,
  })
}

export function createChangesOptions(options: TestOptions, environment: CreateChangesEnvironment): Promise<void> {
  const { version, ...cliOptions } = options
  return createChanges(resolveOptions(version, cliOptions), {
    stdout: () => {},
    colors: new Ansis(0),
    ...environment,
  })
}

export function githubReleaseFetch(options: {
  requests?: GitHubRequest[]
  onPublish?: (body: Record<string, unknown>) => void
} = {}): typeof globalThis.fetch {
  return async (input, init) => {
    const url = String(input)
    const method = init?.method || 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    options.requests?.push({ url, method, body })
    if (url.includes('/search/users'))
      return Response.json({ items: [{ login: 'test-author' }] })
    if (url.endsWith('/releases/tags/v1.1.0'))
      return new Response(null, { status: 404 })
    if ((url.endsWith('/releases') && method === 'POST') || (url.endsWith('/releases/42') && method === 'PATCH')) {
      options.onPublish?.(body)
      return Response.json({ html_url: 'https://github.com/example/project/releases/tag/v1.1.0' })
    }
    throw new Error(`Unexpected request: ${method} ${url}`)
  }
}
