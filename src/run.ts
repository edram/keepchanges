import type { RepositoryRelease } from './provider'
import { resolve } from 'node:path'
import process from 'node:process'
import ansis from 'ansis'
import { version as packageVersion } from '../package.json'
import {
  createChangelog,
  hasRelease,
  insertRelease,
  readChangelog,
  writeChangelog,
} from './changelog'
import {
  getLatestTag,
  getPreviousTag,
  getRemoteTagCommit,
  getTagCommit,
  git,
  readCommits,
} from './git'
import { resolveRepository } from './repository'
import { updateVersion } from './version'

const defaultAuthor
  = 'github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>'

export interface CliEnvironment {
  cwd: string
  env?: NodeJS.ProcessEnv
  stdout?: (value: string) => void
  fetch?: typeof globalThis.fetch
  colors?: typeof ansis
}

export interface ChangelogOptions {
  version: string
  output?: string
  dry?: boolean
  commit?: boolean
  release?: boolean
  author?: string
  token?: string
}

export async function runChangelog(
  options: ChangelogOptions,
  environment: CliEnvironment,
) {
  const { version } = options
  const tag = `v${version}`
  const gitIdentity = options.commit || options.release
    ? resolveGitIdentity(options.author)
    : []
  const env = environment.env ?? process.env
  const stdout = environment.stdout ?? (value => process.stdout.write(value))
  const colors = environment.colors ?? ansis
  const latestTag = await getLatestTag(environment.cwd)
  const repository = await resolveRepository(environment.cwd)
  const token = repository?.provider.token(options.token, env)

  if (options.release) {
    if (!repository)
      throw new Error('A supported repository is required to release')
    if (
      !repository.provider.publishRelease
      && !repository.provider.manualReleaseUrl
    ) {
      throw new Error(`${repository.provider.name} does not support releases`)
    }
  }

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

  const from = taggedCommit
    ? await getPreviousTag(environment.cwd, tag, releaseRef!)
    : latestTag
  const to = releaseRef || 'HEAD'
  const comparisonFrom = from || (
    repository
      ? (await git(
          environment.cwd,
          'rev-list',
          '--max-parents=0',
          to,
        )).trim()
      : ''
  )
  const commits = await readCommits(environment.cwd, from, to)

  if (
    token
    && repository
    && !(options.release && options.dry)
  ) {
    await repository.provider.resolveAuthors?.(
      commits,
      repository,
      token,
      environment.fetch ?? globalThis.fetch,
    )
  }

  const { body: releaseBody, release } = createChangelog(
    version,
    commits,
    repository,
    comparisonFrom,
  )
  const repositoryRelease: RepositoryRelease = {
    tag,
    name: tag,
    body: releaseBody,
    prerelease: version.includes('-'),
  }
  const printReleasePreview = () => {
    stdout([
      colors.dim(`git${colors.bold('changelog')} v${packageVersion}`),
      `${colors.cyan(from || comparisonFrom)}${colors.dim(' -> ')}${colors.blue(tag)}${colors.dim(` (${commits.length} commits)`)}`,
      colors.dim('--------------'),
      '',
      releaseBody.replaceAll('&nbsp;', ''),
      '',
      colors.dim('--------------'),
      '',
    ].join('\n'))
  }
  const printManualReleaseUrl = () => {
    const url = repository!.provider.manualReleaseUrl?.(
      repository!,
      repositoryRelease,
    )
    if (url) {
      stdout(
        `${colors.yellow('Using the following link to create it manually:')}\n${colors.yellow(url)}\n`,
      )
    }
    return url
  }
  const publishRepositoryRelease = async () => {
    printReleasePreview()
    if (!token || !repository!.provider.publishRelease) {
      if (!repository!.provider.manualReleaseUrl)
        throw new Error('A repository token is required to release')
      stdout(
        `${colors.red(`No ${repository!.provider.name} token found, specify it via GITHUB_TOKEN env. Release skipped.`)}\n\n`,
      )
      printManualReleaseUrl()
      return
    }
    const result = await repository!.provider.publishRelease!(
      repository!,
      repositoryRelease,
      token,
      environment.fetch ?? globalThis.fetch,
    )
    stdout(
      `${colors.green(`${capitalize(result.action)} ${repository!.provider.name} release: ${result.url}`)}\n`,
    )
  }
  const outputPath = resolve(
    environment.cwd,
    options.output || 'CHANGELOG.md',
  )
  const currentChangelog = await readChangelog(outputPath)
  const releaseExists = hasRelease(currentChangelog, version)
  const changelog = insertRelease(currentChangelog, release)

  if (options.dry) {
    if (options.release) {
      printReleasePreview()
      stdout(`${colors.yellow('Dry run. Release skipped.')}\n\n`)
      printManualReleaseUrl()
    }
    else {
      stdout(changelog)
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
    await publishRepositoryRelease()
    return
  }

  await writeChangelog(outputPath, changelog)
  const versionPath = await updateVersion(environment.cwd, version)
  if (options.commit || options.release) {
    const releasePaths = [outputPath, versionPath].filter(
      path => path !== undefined,
    )
    const changes = await git(
      environment.cwd,
      'status',
      '--porcelain',
      '--',
      ...releasePaths,
    )
    if (changes.trim()) {
      await git(environment.cwd, 'add', '--', ...releasePaths)
      const versionChanges = versionPath
        ? await git(
            environment.cwd,
            'status',
            '--porcelain',
            '--',
            versionPath,
          )
        : ''
      const commitMessage = versionPath && !versionChanges.trim()
        ? `docs(changelog): ${releaseExists ? 'update' : 'add'} v${version} release notes`
        : `chore(release): v${version}`
      await git(
        environment.cwd,
        ...gitIdentity,
        'commit',
        '-m',
        commitMessage,
        ...(options.author ? ['--author', options.author] : []),
        '--only',
        '--',
        ...releasePaths,
      )
    }
  }
  if (options.release) {
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
    await publishRepositoryRelease()
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function resolveGitIdentity(author = defaultAuthor) {
  const match = /^(.+?)\s*<([^<>]+)>$/.exec(author)
  if (!match)
    throw new Error('Author must use the "Name <email>" format')

  return [
    '-c',
    `user.name=${match[1].trim()}`,
    '-c',
    `user.email=${match[2].trim()}`,
  ]
}
