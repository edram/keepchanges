#!/usr/bin/env node

import type { UnresolvedOptions } from './cli/options'
import process from 'node:process'
import { cac } from 'cac'
import { version } from '../package.json'
import { createChanges } from './cli/createChanges'
import { resolveOptions } from './cli/options'
import { defaultConfig } from './config'

const cli = cac('keepchanges')
  .option('--from <ref>', 'Start Git reference')
  .option('--to <ref>', 'End Git reference')
  .option('--repository <source>', 'Repository slug or URL')
  .option('--output <path>', 'Changelog file path')
  .option('--dry', 'Preview without modifying files or remotes')
  .option('--commit', 'Commit the changelog and version update')
  .option('--release', 'Publish a repository release')
  .option('--author <author>', 'Commit author in "Name <email>" format')
  .option('-t, --token <token>', 'Repository token')
  .option('--no-tag-prefix', 'Create version tags without a prefix')
  .option(
    '--tag-prefix <prefix>',
    'Prefix used for version tags',
    { default: defaultConfig.cli.tagPrefix },
  )
  .option('--name <name>', 'Repository release name')
  .option('-d, --draft', 'Create a draft repository release')
  .option('--prerelease', 'Mark the repository release as prerelease')
  .option('--emoji', 'Use emojis in changelog section titles')
  .option('--capitalize', 'Capitalize changelog entries')
  .option('--group', 'Group repeated commit scopes')

cli
  .command('<version>')
  .usage('<version> [options]')
  .action(async (
    versionArgument,
    options: UnresolvedOptions,
  ) => {
    await createChanges(
      resolveOptions(versionArgument, options),
      { cwd: process.cwd() },
    )
  })

cli.help()
cli.version(version)

try {
  cli.parse(process.argv, { run: false })
  await cli.runMatchedCommand()
}
catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
