import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { cac } from 'cac'
import { x } from 'tinyexec'

export interface CliEnvironment {
  cwd: string
  stdout?: (value: string) => void
}

export async function runCli(args: string[], environment: CliEnvironment) {
  const cli = cac('changelog')
    .option('--output <path>', 'Changelog file path')
    .option('--dry', 'Print the changelog without writing it')

  const parsed = cli.parse(['node', 'changelog', ...args], { run: false })
  const versionArgument = parsed.args[0]
  if (!versionArgument)
    throw new Error('A release version is required')
  const version = versionArgument.replace(/^v/, '')

  const latestTag = await x(
    'git',
    ['describe', '--tags', '--abbrev=0'],
    { nodeOptions: { cwd: environment.cwd } },
  )
  let repositorySource = await readFile(
    resolve(environment.cwd, 'package.json'),
    'utf8',
  ).then((contents) => {
    const repository = (
      JSON.parse(contents) as {
        repository?: string | { url?: string }
      }
    ).repository
    return typeof repository === 'string' ? repository : repository?.url || ''
  }).catch(() => '')

  if (!repositorySource) {
    repositorySource = (
      await x(
        'git',
        ['remote', 'get-url', 'origin'],
        { nodeOptions: { cwd: environment.cwd } },
      )
    ).stdout.trim()
  }
  const repository = parseRepositoryUrl(repositorySource)
  const from = latestTag.stdout.trim()
  const comparisonFrom = from || (
    repository
      ? (await git(
          environment.cwd,
          'rev-list',
          '--max-parents=0',
          'HEAD',
        )).trim()
      : ''
  )
  const log = await git(
    environment.cwd,
    'log',
    from ? `${from}..HEAD` : 'HEAD',
    '--format=%h%x00%s%x00%b%x00',
  )

  const commits = parseGitLog(log)
    .map(commit => parseCommit(commit.hash, commit.subject, commit.body))
    .filter(commit => commit !== null)

  const release = [
    `## v${version}`,
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
          `##### &nbsp;&nbsp;&nbsp;&nbsp;[View changes on GitHub](${repository}/compare/${comparisonFrom}...v${version})`,
        ]
      : []),
    '',
  ].join('\n')
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
    const stdout = environment.stdout ?? (value => process.stdout.write(value))
    stdout(changelog)
    return
  }

  await writeFile(outputPath, changelog)
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

function parseRepositoryUrl(remote: string) {
  const match = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(remote)
  return match ? `https://github.com/${match[1]}` : ''
}

function parseGitLog(log: string) {
  const fields = log.split('\0')
  const commits: Array<{ hash: string, subject: string, body: string }> = []

  for (let index = 0; index + 2 < fields.length; index += 3) {
    const subject = fields[index + 1].trim()
    if (subject)
      commits.push({
        hash: fields[index].trim(),
        subject,
        body: fields[index + 2],
      })
  }

  return commits
}

function parseCommit(hash: string, subject: string, body: string) {
  const match = /^(?<type>[a-z]+)(?:\((?<scope>[^()\r\n]+)\))?(?<breaking>!)?: (?<description>.+)$/i.exec(subject)
  if (!match?.groups)
    return null

  return {
    hash,
    type: match.groups.type.toLowerCase(),
    scope: match.groups.scope || '',
    description: match.groups.description,
    isBreaking: Boolean(match.groups.breaking)
      || /^BREAKING(?: |-)CHANGE:/im.test(body),
  }
}

function renderSection(
  commits: Array<{
    type: string
    scope: string
    description: string
    hash: string
    isBreaking: boolean
  }>,
  title: string,
  repository: string,
) {
  const lines = commits
    .map((commit) => {
      const scope = commit.scope ? `**${escapeHtml(commit.scope)}**: ` : ''
      const reference = repository
        ? ` &nbsp;-&nbsp; [<samp>(${commit.hash.slice(0, 5)})</samp>](${repository}/commit/${commit.hash})`
        : ''
      return `${scope}${escapeHtml(capitalize(commit.description))}${reference}`
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
