import type {
  Repository,
  RepositoryAuthor,
  RepositoryCommit,
} from './provider'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { cac } from 'cac'
import { x } from 'tinyexec'
import { version as packageVersion } from '../package.json'
import { resolveRepository } from './repository'
import { updateVersion } from './version'

interface Commit extends RepositoryCommit {
  type: string
  scope: string
  description: string
  isBreaking: boolean
}

export interface CliEnvironment {
  cwd: string
  env?: NodeJS.ProcessEnv
  stdout?: (value: string) => void
  fetch?: typeof globalThis.fetch
}

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
  const version = versionArgument.replace(/^v/, '')
  const tag = `v${version}`
  const env = environment.env ?? process.env
  const stdout = environment.stdout ?? (value => process.stdout.write(value))

  const latestTag = await x(
    'git',
    ['describe', '--tags', '--abbrev=0'],
    { nodeOptions: { cwd: environment.cwd } },
  )
  const repository = await resolveRepository(environment.cwd)
  const token = repository?.provider.token(parsed.options.token, env)
  if (parsed.options.release) {
    if (!repository)
      throw new Error('A supported repository is required to release')
    if (
      !repository.provider.publishRelease
      && !repository.provider.manualReleaseUrl
    ) {
      throw new Error(`${repository.provider.name} does not support releases`)
    }
  }
  let taggedCommit = parsed.options.release
    ? await getTagCommit(environment.cwd, tag)
    : undefined
  let releaseRef = taggedCommit ? tag : undefined
  if (
    parsed.options.release
    && !taggedCommit
    && (await git(environment.cwd, 'status', '--porcelain')).trim()
  ) {
    throw new Error(`Working tree must be clean to create tag ${tag}`)
  }
  const remoteTaggedCommit = parsed.options.release
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
    if (parsed.options.dry) {
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
    : latestTag.stdout.trim()
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
  const log = await git(
    environment.cwd,
    'log',
    from ? `${from}..${to}` : to,
    '--format=%h%x00%an%x00%ae%x00%s%x00%b%x00',
  )

  const commits = parseGitLog(log)
    .map(commit => parseCommit(
      commit.hash,
      commit.subject,
      commit.body,
      commit.author,
    ))
    .filter(commit => commit !== null)

  if (
    token
    && repository
    && !(parsed.options.release && parsed.options.dry)
  ) {
    await repository.provider.resolveAuthors?.(
      commits,
      repository,
      token,
      environment.fetch ?? globalThis.fetch,
    )
  }

  const releaseBody = [
    ...renderSection(
      commits.filter(commit => commit.isBreaking),
      '🚨 Breaking Changes',
      repository,
    ),
    ...renderSection(
      commits.filter(commit => !commit.isBreaking && commit.type === 'feat'),
      '🚀 Features',
      repository,
    ),
    ...renderSection(
      commits.filter(commit => !commit.isBreaking && commit.type === 'fix'),
      '🐞 Bug Fixes',
      repository,
    ),
    ...(repository && comparisonFrom
      ? [
          '',
          `##### &nbsp;&nbsp;&nbsp;&nbsp;[View changes on ${repository.provider.name}](${repository.provider.compareUrl(repository, comparisonFrom, `v${version}`)})`,
        ]
      : []),
  ].join('\n').trim()
  const release = [`## v${version}`, '', releaseBody, ''].join('\n')
  const repositoryRelease = {
    tag,
    name: tag,
    body: releaseBody,
    prerelease: version.includes('-'),
  }
  const publishRepositoryRelease = async () => {
    stdout([
      `gitchangelog v${packageVersion}`,
      `${from || comparisonFrom} -> ${tag} (${commits.length} commits)`,
      '--------------',
      '',
      releaseBody.replaceAll('&nbsp;', ''),
      '',
      '--------------',
      '',
    ].join('\n'))
    if (!token || !repository!.provider.publishRelease) {
      const url = repository!.provider.manualReleaseUrl?.(
        repository!,
        repositoryRelease,
      )
      if (!url)
        throw new Error('A repository token is required to release')
      stdout(
        `No ${repository!.provider.name} token found, specify it via GITHUB_TOKEN env. Release skipped.\n\n`,
      )
      stdout(`Using the following link to create it manually:\n${url}\n`)
      return
    }
    const result = await repository!.provider.publishRelease!(
      repository!,
      repositoryRelease,
      token,
      environment.fetch ?? globalThis.fetch,
    )
    stdout(
      `${capitalize(result.action)} ${repository!.provider.name} release: ${result.url}\n`,
    )
  }
  const outputPath = resolve(
    environment.cwd,
    parsed.options.output || 'CHANGELOG.md',
  )
  const currentChangelog = await readFile(outputPath, 'utf8').catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT')
        return '# Changelog\n'
      throw error
    },
  )
  const changelog = insertRelease(currentChangelog, release)

  if (parsed.options.dry) {
    stdout(changelog)
    return
  }

  if (parsed.options.release && taggedCommit) {
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

  await writeFile(outputPath, changelog)
  const versionPath = await updateVersion(environment.cwd, version)
  if (parsed.options.commit || parsed.options.release) {
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
      const author = parsed.options.author
      await git(
        environment.cwd,
        'commit',
        '-m',
        `chore(release): v${version}`,
        ...(author ? ['--author', author] : []),
        '--only',
        '--',
        ...releasePaths,
      )
    }
  }
  if (parsed.options.release) {
    await git(environment.cwd, 'tag', '-a', tag, '-m', tag)
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

async function getTagCommit(cwd: string, tag: string) {
  return git(cwd, 'rev-list', '-n', '1', tag)
    .then(output => output.trim() || undefined)
    .catch(() => undefined)
}

async function getPreviousTag(cwd: string, tag: string, releaseRef: string) {
  if (!tag.includes('-')) {
    const tags = await git(
      cwd,
      'tag',
      '--merged',
      releaseRef,
      '--sort=-version:refname',
    )
    const previousStable = tags
      .trim()
      .split('\n')
      .find(candidate =>
        candidate !== tag && /^v?\d+\.\d+\.\d+$/.test(candidate),
      )
    if (previousStable)
      return previousStable
  }

  return git(cwd, 'describe', '--tags', '--abbrev=0', `${releaseRef}^`)
    .then(output => output.trim())
    .catch(() => '')
}

async function getRemoteTagCommit(cwd: string, tag: string) {
  const output = await git(
    cwd,
    'ls-remote',
    '--tags',
    'origin',
    `refs/tags/${tag}`,
    `refs/tags/${tag}^{}`,
  )
  const refs = output.trim().split('\n').filter(Boolean)
  const peeled = refs.find(line => line.endsWith('^{}'))
  return (peeled || refs[0])?.split(/\s+/)[0]
}

async function git(cwd: string, ...args: string[]) {
  const result = await x('git', args, {
    nodeOptions: { cwd },
    throwOnError: true,
  })
  return result.stdout
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function escapeHtml(value: string) {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
  }
  return value.replace(/[&<>"']/g, character => htmlEntities[character])
}

function parseGitLog(log: string) {
  const fields = log.split('\0')
  const commits: Array<{
    hash: string
    subject: string
    body: string
    author: RepositoryAuthor
  }> = []

  for (let index = 0; index + 4 < fields.length; index += 5) {
    const subject = fields[index + 3].trim()
    if (subject)
      commits.push({
        hash: fields[index].trim(),
        subject,
        body: fields[index + 4],
        author: {
          name: fields[index + 1].trim(),
          email: fields[index + 2].trim(),
        },
      })
  }

  return commits
}

function parseCommit(
  hash: string,
  subject: string,
  body: string,
  author: RepositoryAuthor,
): Commit | null {
  const match = /^(?<type>[a-z]+)(?:\((?<scope>[^()\r\n]+)\))?(?<breaking>!)?: (?<description>.+)$/i.exec(subject)
  if (!match?.groups)
    return null

  const authors = [author]
  for (const coAuthor of body.matchAll(
    /^Co-Authored-By:\s*(.+?)\s*<([^>]+)>$/gim,
  )) {
    const email = coAuthor[2].trim()
    if (!authors.some(author => author.email === email)) {
      authors.push({
        name: coAuthor[1].trim(),
        email,
      })
    }
  }

  return {
    hash,
    authors: authors.filter(
      author => !/\[bot\]|dependabot|\(bot\)/i.test(author.name),
    ),
    type: match.groups.type.toLowerCase(),
    scope: match.groups.scope || '',
    description: match.groups.description,
    isBreaking: Boolean(match.groups.breaking)
      || /^BREAKING(?: |-)CHANGE:/im.test(body),
  }
}

function renderSection(
  commits: Commit[],
  title: string,
  repository: Repository | undefined,
) {
  const lines = commits
    .map((commit) => {
      const scope = commit.scope ? `**${escapeHtml(commit.scope)}**: ` : ''
      const reference = repository
        ? `[<samp>(${commit.hash.slice(0, 5)})</samp>](${repository.provider.commitUrl(repository, commit.hash)})`
        : ''
      const authorNames = commit.authors.map(author => author.login
        ? `@${author.login}`
        : `**${escapeHtml(author.name)}**`)
      const authors = authorNames.length > 1
        ? `${authorNames.slice(0, -1).join(', ')} and ${authorNames.at(-1)}`
        : authorNames[0] || ''
      const details = [authors ? `by ${authors}` : '', reference]
        .filter(Boolean)
        .join(' ')
      const suffix = details ? ` &nbsp;-&nbsp; ${details}` : ''
      return `${scope}${escapeHtml(capitalize(commit.description))}${suffix}`
    })
    .reverse()

  if (!lines.length)
    return []

  return [
    '',
    `### ${title}`,
    '',
    ...lines.map(line => `- ${line}`),
  ]
}

function insertRelease(changelog: string, release: string) {
  const releaseVersion = /^##\s+v?(\d+\.\d+\.\d+)/.exec(release)?.[1]
  const headings = [...changelog.matchAll(/^##\s+v?(\d+\.\d+\.\d+).*$/gm)]
  const existingReleaseIndex = headings.findIndex(
    heading => heading[1] === releaseVersion,
  )

  if (existingReleaseIndex !== -1) {
    const start = headings[existingReleaseIndex].index
    const end = headings[existingReleaseIndex + 1]?.index ?? changelog.length
    changelog = changelog.slice(0, start) + changelog.slice(end)
  }

  const firstRelease = /^##\s+v?\d+\.\d+\.\d+.*$/m.exec(changelog)
  if (!firstRelease)
    return `${changelog.trimEnd()}\n\n${release.trim()}\n`

  const preamble = changelog.slice(0, firstRelease.index).trimEnd()
  const history = changelog.slice(firstRelease.index).trim()
  return `${preamble}\n\n${release.trim()}\n\n${history}\n`
}
