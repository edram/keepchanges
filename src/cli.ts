#!/usr/bin/env node

import type { CliEnvironment } from './run'
import { realpathSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { cac } from 'cac'
import { runChangelog } from './run'

export type { CliEnvironment } from './run'

export async function runCli(args: string[], environment: CliEnvironment) {
  const cli = cac('changelog')
    .option('--output <path>', 'Changelog file path')
    .option('--dry', 'Print the changelog without writing it')
    .option('--commit', 'Commit the changelog')
    .option('--release', 'Publish a repository release')
    .option('--author <author>', 'Commit author in "Name <email>" format')
    .option('--token <token>', 'Repository token for resolving authors')

  const parsed = cli.parse(['node', 'changelog', ...args], { run: false })
  const versionArgument = parsed.args[0]
  if (!versionArgument)
    throw new Error('A release version is required')

  await runChangelog({
    version: versionArgument.replace(/^v/, ''),
    output: parsed.options.output,
    dry: parsed.options.dry,
    commit: parsed.options.commit,
    release: parsed.options.release,
    author: parsed.options.author,
    token: parsed.options.token,
  }, environment)
}

if (
  process.argv[1]
  && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])
) {
  runCli(process.argv.slice(2), { cwd: process.cwd() }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
