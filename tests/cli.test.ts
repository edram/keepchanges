import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'
import { expect, it } from 'vitest'

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
