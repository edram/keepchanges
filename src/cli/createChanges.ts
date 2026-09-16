import type { ChangelogConfigOverrides } from '../config'
import type {
  ManualReleaseAction,
  Repository,
  RepositoryRelease,
  RepositoryReleaseAsset,
} from '../repository'
import type { Options } from './options'
import type { ChangesPreview } from './output'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import ansis from 'ansis'
import { glob, isDynamicPattern } from 'tinyglobby'
import { normalizeFull } from 'verkit'
import {
  generateChangelog,
  hasRelease,
  insertRelease,
  readChangelog,
  writeChangelog,
} from '../changelog'
import { parseCommits } from '../commit'
import { defaultConfig } from '../config'
import {
  getLatestTag,
  getPreviousTag,
  getRemoteTagCommit,
  getTagCommit,
  git,
  readGitCommits,
  resolveVersionRef,
} from '../git'
import { resolveRepository } from '../repository'
import { updateVersion } from '../version'
import {
  printChangesPreview,
  printManualReleaseUrl,
  printPublishedRelease,
} from './output'

export interface CreateChangesEnvironment {
  cwd: string
  env?: NodeJS.ProcessEnv
  stdout?: (value: string) => void
  fetch?: typeof globalThis.fetch
  colors?: typeof ansis
}

export async function createChanges(
  options: Options,
  environment: CreateChangesEnvironment,
): Promise<void> {
  if ((options.commit || options.tag || options.release) && options.to !== defaultConfig.cli.to) {
    const [toCommit, headCommit] = await Promise.all([
      git(environment.cwd, 'rev-parse', options.to).then(value => value.trim()),
      git(environment.cwd, 'rev-parse', 'HEAD').then(value => value.trim()),
    ])
    if (toCommit !== headCommit)
      throw new Error('--to must resolve to HEAD when used with --commit')
  }

  const env = environment.env ?? process.env
  const stdout = environment.stdout ?? (value => process.stdout.write(value))
  const colors = environment.colors ?? ansis
  const tag = `${options.tagPrefix}${options.version}`
  const repository = await resolveRepository(
    environment.cwd,
    options.repository,
  )
  const token = repository?.provider.token(options.token, env)

  validateReleaseSupport(options, repository)
  if (options.release && !options.dry && options.assets.length && !token) {
    throw new Error(
      `A ${repository!.provider.name} token is required to upload release assets`,
    )
  }
  const releaseAssets = options.release && !options.dry && options.assets.length
    ? await readReleaseAssets(environment.cwd, options.assets)
    : []

  const createsTag = options.tag || options.release
  let taggedCommit = createsTag
    ? await getTagCommit(environment.cwd, tag)
    : undefined
  let releaseRef = taggedCommit ? tag : undefined
  const remoteTaggedCommit = createsTag
    ? await getRemoteTagCommit(environment.cwd, tag)
    : undefined

  if (
    taggedCommit
    && remoteTaggedCommit
    && taggedCommit !== remoteTaggedCommit
  ) {
    throw new Error(`Tag ${tag} differs between local and origin`)
  }

  if (remoteTaggedCommit && !taggedCommit) {
    if (options.dry) {
      taggedCommit = remoteTaggedCommit
      releaseRef = remoteTaggedCommit
    }
    else {
      await git(
        environment.cwd,
        'fetch',
        'origin',
        `refs/tags/${tag}:refs/tags/${tag}`,
      )
      taggedCommit = await getTagCommit(environment.cwd, tag)
      releaseRef = tag
    }
  }

  const to = releaseRef || options.to
  const resolvedTo = await resolveVersionRef(
    environment.cwd,
    to,
    options.tagPrefix,
  )
  const inferFromTarget = releaseRef !== undefined
    || options.to !== defaultConfig.cli.to
  const from = options.from ?? (
    inferFromTarget
      ? await getPreviousTag(
          environment.cwd,
          tag,
          resolvedTo,
          options.tagPrefix,
        )
      : await getLatestTag(environment.cwd, options.tagPrefix)
  )
  const resolvedFrom = from
    ? await resolveVersionRef(environment.cwd, from, options.tagPrefix)
    : ''
  const comparisonFrom = resolvedFrom || (
    repository
      ? await git(
          environment.cwd,
          'rev-list',
          '--max-parents=0',
          resolvedTo,
        ).then(value => value.trim())
      : ''
  )
  const commits = parseCommits(
    await readGitCommits(environment.cwd, resolvedFrom, resolvedTo),
  )

  if (token && repository) {
    await repository.provider.resolveAuthors?.(
      commits,
      repository,
      token,
      environment.fetch ?? globalThis.fetch,
    )
  }

  const style: ChangelogConfigOverrides = {
    emoji: options.emoji,
    capitalize: options.capitalize,
    group: options.group,
  }
  const { body, release } = generateChangelog({
    version: options.version,
    commits,
    repository,
    comparisonFrom,
    comparisonTo: normalizeFull(options.to) ? resolvedTo : tag,
  }, style)
  const repositoryRelease: RepositoryRelease = {
    tag,
    name: options.name ?? tag,
    body,
    prerelease: options.prerelease ?? options.version.includes('-'),
    draft: options.draft,
  }
  const preview: ChangesPreview = {
    from: resolvedFrom || comparisonFrom,
    tag,
    commitCount: commits.length,
    body,
  }

  if (options.dry) {
    printChangesPreview(preview, stdout, colors)
    if (options.release) {
      stdout(`${colors.yellow('Dry run. Release skipped.')}\n\n`)
      printManualReleaseUrl(
        repository!,
        repositoryRelease,
        stdout,
        colors,
        taggedCommit ? 'edit' : 'create',
      )
    }
    return
  }

  if (createsTag && taggedCommit) {
    if (!remoteTaggedCommit) {
      await git(
        environment.cwd,
        'push',
        'origin',
        `refs/tags/${tag}`,
      )
    }
    if (!options.release)
      return
    await publishRelease(
      repository!,
      repositoryRelease,
      token,
      preview,
      environment,
      releaseAssets,
      'edit',
    )
    return
  }

  let outputPath: string | undefined
  let releaseExists = false
  if (options.changelog) {
    outputPath = resolve(environment.cwd, options.output)
    const currentChangelog = await readChangelog(outputPath)
    releaseExists = hasRelease(currentChangelog, options.version)
    await writeChangelog(outputPath, insertRelease(currentChangelog, release))
  }
  const versionPath = options.bump
    ? await updateVersion(environment.cwd, options.version)
    : undefined

  if (options.commit || createsTag) {
    await commitReleaseFiles(
      options,
      environment.cwd,
      outputPath,
      versionPath,
      releaseExists,
      tag,
    )
  }

  if (createsTag) {
    const gitIdentity = resolveGitIdentity(options.author)
    await git(
      environment.cwd,
      ...gitIdentity,
      'tag',
      '-a',
      tag,
      '-m',
      tag,
    )
    await git(
      environment.cwd,
      'push',
      'origin',
      'HEAD',
      `refs/tags/${tag}`,
    )
    if (options.release) {
      await publishRelease(
        repository!,
        repositoryRelease,
        token,
        preview,
        environment,
        releaseAssets,
      )
    }
  }
}

function validateReleaseSupport(
  options: Options,
  repository: Repository | undefined,
): void {
  if (!options.release)
    return
  if (!repository)
    throw new Error('A supported repository is required to release')
  if (!repository.provider.publishRelease && !repository.provider.manualReleaseUrl)
    throw new Error(`${repository.provider.name} does not support releases`)
  if (options.assets.length && !repository.provider.supportsReleaseAssets)
    throw new Error(`${repository.provider.name} does not support release assets`)
}

async function commitReleaseFiles(
  options: Options,
  cwd: string,
  outputPath: string | undefined,
  versionPath: string | undefined,
  releaseExists: boolean,
  tag: string,
): Promise<void> {
  const releasePaths = [outputPath, versionPath].filter(
    path => path !== undefined,
  )
  if (!releasePaths.length)
    return
  const changes = await git(
    cwd,
    'status',
    '--porcelain',
    '--',
    ...releasePaths,
  )
  if (!changes.trim())
    return

  await git(cwd, 'add', '--', ...releasePaths)
  const versionChanges = versionPath
    ? await git(
        cwd,
        'status',
        '--porcelain',
        '--',
        versionPath,
      )
    : ''
  const commitMessage = versionPath && !versionChanges.trim()
    ? `docs(changelog): ${releaseExists ? 'update' : 'add'} ${tag} release notes`
    : `chore(release): ${tag}`
  await git(
    cwd,
    ...resolveGitIdentity(options.author),
    'commit',
    '-m',
    commitMessage,
    ...(options.author ? ['--author', options.author] : []),
    '--only',
    '--',
    ...releasePaths,
  )
}

async function publishRelease(
  repository: Repository,
  release: RepositoryRelease,
  token: string | undefined,
  preview: ChangesPreview,
  environment: CreateChangesEnvironment,
  assets: RepositoryReleaseAsset[],
  manualAction: ManualReleaseAction = 'create',
): Promise<void> {
  const stdout = environment.stdout ?? (value => process.stdout.write(value))
  const colors = environment.colors ?? ansis
  printChangesPreview(preview, stdout, colors)

  if (!token || !repository.provider.publishRelease) {
    if (!repository.provider.manualReleaseUrl)
      throw new Error('A repository token is required to release')
    stdout(
      `${colors.red(`No ${repository.provider.name} token found, specify it via --token or ${repository.provider.tokenEnv} env. Release skipped.`)}\n\n`,
    )
    printManualReleaseUrl(
      repository,
      release,
      stdout,
      colors,
      manualAction,
    )
    return
  }

  const result = await repository.provider.publishRelease(
    repository,
    {
      ...release,
      assets,
    },
    token,
    environment.fetch ?? globalThis.fetch,
  )
  printPublishedRelease(
    repository.provider.name,
    result,
    stdout,
    colors,
  )
}

async function readReleaseAssets(
  cwd: string,
  paths: string[],
): Promise<Array<{ name: string, data: Uint8Array }>> {
  const files = new Set<string>()

  async function collect(path: string): Promise<void> {
    const metadata = await lstat(path).catch(() => undefined)
    if (!metadata)
      throw new Error(`Release asset does not exist: ${path}`)
    if (metadata.isFile()) {
      files.add(path)
      return
    }
    if (!metadata.isDirectory())
      throw new Error(`Release asset must be a file or directory: ${path}`)

    const entries = await readdir(path, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name)))
      await collect(resolve(path, entry.name))
  }

  for (const path of paths) {
    if (!isDynamicPattern(path)) {
      await collect(resolve(cwd, path))
      continue
    }

    const matches = await glob(path, {
      absolute: true,
      cwd,
      dot: true,
      expandDirectories: false,
      followSymbolicLinks: false,
      onlyFiles: false,
    })
    if (!matches.length)
      throw new Error(`Release asset pattern did not match: ${path}`)
    for (const match of matches.sort((left, right) => left.localeCompare(right)))
      await collect(match)
  }

  const names = new Set<string>()
  return Promise.all([...files].map(async (path) => {
    const name = basename(path)
    if (names.has(name))
      throw new Error(`Release assets must have unique file names: ${name}`)
    names.add(name)
    return { name, data: await readFile(path) }
  }))
}

function resolveGitIdentity(author: string): string[] {
  const match = /^([^<>\r\n]+)<([^<>\r\n]+)>$/.exec(author)
  if (!match)
    throw new Error('Author must use the "Name <email>" format')

  return [
    '-c',
    `user.name=${match[1].trim()}`,
    '-c',
    `user.email=${match[2].trim()}`,
  ]
}
