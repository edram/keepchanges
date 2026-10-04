import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'
import { expect, it } from 'vitest'
import { commitFiles, createRepository } from './fixtures'

const cliPath = fileURLToPath(new URL('../dist/cli.mjs', import.meta.url))

function runCli(...args: string[]) {
  return x(process.execPath, [cliPath, ...args], {
    throwOnError: false,
  })
}

it('documents how to disable the tag prefix in CLI help', async () => {
  const result = await runCli('--help')

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toMatch(/^\s+--no-tag-prefix\s+/m)
})

it('requires a tag prefix value', async () => {
  const result = await runCli('--tag-prefix')

  expect(result.exitCode).toBe(1)
  expect(result.stderr).toContain(
    'option `--tag-prefix <prefix>` value is missing',
  )
})

it('requires a release version argument', async () => {
  const result = await runCli()

  expect(result.exitCode).toBe(1)
  expect(result.stderr).toContain(
    'missing required args for command `<version>`',
  )
})

it('reports command failures without a stack trace', async () => {
  const result = await runCli('invalid-version')

  expect(result.exitCode).toBe(1)
  expect(result.stderr).toBe('Invalid release version: invalid-version\n')
})

it('accepts tag creation without release metadata', async () => {
  const result = await runCli('1.0.3', '--tag', '--dry')

  expect(result.exitCode).toBe(0)
  expect(result.stderr).toBe('')
})

it.each([
  { paths: ['packages/core'], corePath: 'packages/core', count: 1 },
  { paths: ['packages/core', 'shared files'], corePath: 'packages/core', count: 2 },
  { paths: ['2026'], corePath: '2026', count: 1 },
  { paths: ['001'], corePath: '001', count: 1 },
])('filters the CLI preview by $paths', async ({ paths, corePath, count }) => {
  const cwd = await createRepository()
  await commitFiles(cwd, 'fix(core): repair parser', [`${corePath}/index.ts`])
  await commitFiles(cwd, 'fix: update shared utils', ['shared files/utils.ts'])

  const result = await x(process.execPath, [
    cliPath,
    '1.1.0',
    ...paths.flatMap(path => ['--commit-filter-by-paths', path]),
    '--dry',
  ], { nodeOptions: { cwd }, throwOnError: false })

  expect(result.stderr).toBe('')
  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain(`(${count} commits)`)
  expect(result.stdout).toContain('Repair parser')
  expect(result.stdout).not.toContain('Add CLI')
  expect(result.stdout.includes('Update shared utils')).toBe(count === 2)
})

it.each([
  { args: ['--commit-filter-by-paths'] },
  { args: ['--commit-filter-by-paths', 'packages/core', '--commit-filter-by-paths'] },
  { args: ['--no-commit-filter-by-paths'] },
  { args: ['--no-commit-filter-by-paths', '--commit-filter-by-paths', '001'] },
  { args: ['--commit-filter-by-paths', ''] },
])('rejects invalid commit path filters $args', async ({ args }) => {
  const cwd = await createRepository()
  const result = await x(process.execPath, [cliPath, '1.1.0', ...args, '--dry'], {
    nodeOptions: { cwd },
    throwOnError: false,
  })

  expect(result.exitCode).toBe(1)
  expect(result.stderr).toContain(
    '--commit-filter-by-paths requires a non-empty path',
  )
})
