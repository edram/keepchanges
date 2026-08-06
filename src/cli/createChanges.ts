import type { ChangelogConfigOverrides } from '../config'
import type { Repository, RepositoryRelease } from '../repository'
import type { Options } from './options'
import type { ChangesPreview } from './output'
import { resolve } from 'node:path'
import process from 'node:process'
import ansis from 'ansis'
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
  if (options.commit && options.to !== defaultConfig.cli.to) {
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
  const tag = `v${options.version}`
  const repository = await resolveRepository(
    environment.cwd,
    options.repository,
  )
  const token = repository?.provider.token(options.token, env)

  validateReleaseSupport(options, repository)

  let taggedCommit = options.release
    ? await getTagCommit(environment.cwd, tag)
    : undefined
  let releaseRef = taggedCommit ? tag : undefined
  const remoteTaggedCommit = options.release
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

  const from = options.from ?? (
    taggedCommit
      ? await getPreviousTag(environment.cwd, tag, releaseRef!)
      : await getLatestTag(environment.cwd)
  )
  const to = releaseRef || options.to
  const comparisonFrom = from || (
    repository
      ? await git(
          environment.cwd,
          'rev-list',
          '--max-parents=0',
          to,
        ).then(value => value.trim())
      : ''
  )
  const commits = parseCommits(
    await readGitCommits(environment.cwd, from, to),
  )

  if (token && repository && !(options.release && options.dry)) {
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
  }, style)
  const repositoryRelease: RepositoryRelease = {
    tag,
    name: options.name ?? tag,
    body,
    prerelease: options.prerelease ?? options.version.includes('-'),
    draft: options.draft,
  }
  const preview: ChangesPreview = {
    from: from || comparisonFrom,
    tag,
    commitCount: commits.length,
    body,
  }

  if (options.dry) {
    printChangesPreview(preview, stdout, colors)
    if (options.release) {
      stdout(`${colors.yellow('Dry run. Release skipped.')}\n\n`)
      printManualReleaseUrl(repository!, repositoryRelease, stdout, colors)
    }
    return
  }

  if (options.release && taggedCommit) {
    if (!remoteTaggedCommit) {
      await git(
        environment.cwd,
        'push',
        'origin',
        `refs/tags/${tag}`,
      )
    }
    await publishRelease(
      repository!,
      repositoryRelease,
      token,
      preview,
      environment,
    )
    return
  }

  const outputPath = resolve(environment.cwd, options.output)
  const currentChangelog = await readChangelog(outputPath)
  const releaseExists = hasRelease(currentChangelog, options.version)
  await writeChangelog(outputPath, insertRelease(currentChangelog, release))
  const versionPath = await updateVersion(environment.cwd, options.version)

  if (options.commit || options.release) {
    await commitReleaseFiles(
      options,
      environment.cwd,
      outputPath,
      versionPath,
      releaseExists,
    )
  }

  if (options.release) {
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
    await publishRelease(
      repository!,
      repositoryRelease,
      token,
      preview,
      environment,
    )
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
}

async function commitReleaseFiles(
  options: Options,
  cwd: string,
  outputPath: string,
  versionPath: string | undefined,
  releaseExists: boolean,
): Promise<void> {
  const releasePaths = [outputPath, versionPath].filter(
    path => path !== undefined,
  )
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
    ? `docs(changelog): ${releaseExists ? 'update' : 'add'} v${options.version} release notes`
    : `chore(release): v${options.version}`
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
): Promise<void> {
  const stdout = environment.stdout ?? (value => process.stdout.write(value))
  const colors = environment.colors ?? ansis
  printChangesPreview(preview, stdout, colors)

  if (!token || !repository.provider.publishRelease) {
    if (!repository.provider.manualReleaseUrl)
      throw new Error('A repository token is required to release')
    stdout(
      `${colors.red(`No ${repository.provider.name} token found, specify it via --token or environment variable. Release skipped.`)}\n\n`,
    )
    printManualReleaseUrl(repository, release, stdout, colors)
    return
  }

  const result = await repository.provider.publishRelease(
    repository,
    release,
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
