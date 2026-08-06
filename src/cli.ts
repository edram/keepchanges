#!/usr/bin/env node

import type { Options } from './cli/options'
import process from 'node:process'
import { cac } from 'cac'
import { version } from '../package.json'
import { createChanges } from './cli/createChanges'
import { resolveOptions } from './cli/options'

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
  .option('--name <name>', 'Repository release name')
  .option('-d, --draft', 'Create a draft repository release')
  .option('--prerelease', 'Mark the repository release as prerelease')
  .option('--emoji', 'Use emojis in changelog section titles')
  .option('--capitalize', 'Capitalize changelog entries')
  .option('--group', 'Group repeated commit scopes')

cli
  .command('[version]')
  .usage('<version> [options]')
  .action(async (
    versionArgument,
    options: Partial<Omit<Options, 'version'>>,
  ) => {
    await createChanges(
      resolveOptions(versionArgument, options),
      { cwd: process.cwd() },
    )
  })

cli.help()
cli.version(version)
cli.parse()
