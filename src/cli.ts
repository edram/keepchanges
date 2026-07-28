#!/usr/bin/env node

import type { CliEnvironment } from './run'
import { realpathSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { cac } from 'cac'
import { version } from '../package.json'
import { runChangelog } from './run'

export type { CliEnvironment } from './run'

export async function runCli(
  args: string[],
  environment: CliEnvironment,
): Promise<void> {
  const cli = cac('changelog')
    .version(version)
    .option('--output <path>', 'Changelog file path')
    .option('--dry', 'Print the changelog without writing it')
    .option('--commit', 'Commit the changelog')
    .option('--release', 'Publish a repository release')
    .option('--author <author>', 'Commit author in "Name <email>" format')
    .option('--token <token>', 'Repository token for resolving authors')
    .help()

  cli
    .command('[version]')
    .usage('<version> [options]')
    .action(async (versionArgument, options) => {
      if (!versionArgument)
        throw new Error('A release version is required')

      await runChangelog({
        version: versionArgument.replace(/^v/, ''),
        output: options.output,
        dry: options.dry,
        commit: options.commit,
        release: options.release,
        author: options.author,
        token: options.token,
      }, environment)
    })

  cli.parse(['node', 'changelog', ...args], { run: false })
  await cli.runMatchedCommand()
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
