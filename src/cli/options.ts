import { normalizeFull } from 'verkit'
import { defaultConfig } from '../config'

export interface Options {
  version: string
  from?: string
  to: string
  repository?: string
  output: string
  dry: boolean
  commit: boolean
  release: boolean
  author: string
  token?: string
  name?: string
  draft: boolean
  prerelease?: boolean
  emoji: boolean
  capitalize: boolean
  group: boolean
}

export function resolveOptions(
  versionArgument: string | undefined,
  options: Partial<Omit<Options, 'version'>>,
): Options {
  if (!versionArgument)
    throw new Error('A release version is required')

  const version = normalizeFull(versionArgument)
  if (!version)
    throw new Error(`Invalid release version: ${versionArgument}`)

  const commit = options.commit ?? defaultConfig.cli.commit
  const release = options.release ?? defaultConfig.cli.release
  if (options.to !== undefined && release)
    throw new Error('--to cannot be used with --release')
  if (options.author !== undefined && !commit && !release)
    throw new Error('--author requires --commit or --release')
  if (
    !release
    && (
      options.name !== undefined
      || options.draft !== undefined
      || options.prerelease !== undefined
    )
  ) {
    throw new Error('--name, --draft, and --prerelease require --release')
  }

  return {
    version,
    from: options.from,
    to: options.to ?? defaultConfig.cli.to,
    repository: options.repository,
    output: options.output ?? defaultConfig.cli.output,
    dry: options.dry ?? defaultConfig.cli.dry,
    commit,
    release,
    author: options.author ?? defaultConfig.cli.author,
    token: options.token,
    name: options.name,
    draft: options.draft ?? defaultConfig.cli.draft,
    prerelease: options.prerelease,
    emoji: options.emoji ?? defaultConfig.changelog.emoji,
    capitalize: options.capitalize ?? defaultConfig.changelog.capitalize,
    group: options.group ?? defaultConfig.changelog.group,
  }
}
