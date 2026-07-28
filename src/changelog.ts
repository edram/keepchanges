import type { Commit } from './git'
import type { Repository } from './provider'
import { readFile, writeFile } from 'node:fs/promises'
import { normalizeFull } from 'verkit'

export function createChangelog(
  version: string,
  commits: Commit[],
  repository: Repository | undefined,
  comparisonFrom: string,
): { body: string, release: string } {
  const body = [
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
    ...renderSection(
      commits.filter(commit => !commit.isBreaking && commit.type === 'perf'),
      '🏎 Performance',
      repository,
    ),
    ...(repository && comparisonFrom
      ? [
          '',
          `##### &nbsp;&nbsp;&nbsp;&nbsp;[View changes on ${repository.provider.name}](${repository.provider.compareUrl(repository, comparisonFrom, `v${version}`)})`,
        ]
      : []),
  ].join('\n').trim()

  return {
    body,
    release: [`## v${version}`, '', body, ''].join('\n'),
  }
}

export async function readChangelog(path: string): Promise<string> {
  return readFile(path, 'utf8').catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT')
        return '# Changelog\n'
      throw error
    },
  )
}

export function writeChangelog(path: string, changelog: string): Promise<void> {
  return writeFile(path, changelog)
}

export function hasRelease(changelog: string, version: string): boolean {
  const releaseVersion = normalizeFull(version)
  return releaseHeadings(changelog)
    .some(heading => heading.version === releaseVersion)
}

export function insertRelease(changelog: string, release: string): string {
  const releaseVersion = releaseHeadings(release)[0]?.version
  const headings = releaseHeadings(changelog)
  const existingReleaseIndex = headings.findIndex(
    heading => heading.version === releaseVersion,
  )

  if (existingReleaseIndex !== -1) {
    const start = headings[existingReleaseIndex].index
    const end = headings[existingReleaseIndex + 1]?.index ?? changelog.length
    changelog = changelog.slice(0, start) + changelog.slice(end)
  }

  const firstRelease = releaseHeadings(changelog)[0]
  if (!firstRelease)
    return `${changelog.trimEnd()}\n\n${release.trim()}\n`

  const preamble = changelog.slice(0, firstRelease.index).trimEnd()
  const history = changelog.slice(firstRelease.index).trim()
  return `${preamble}\n\n${release.trim()}\n\n${history}\n`
}

function releaseHeadings(changelog: string): Array<{ index: number, version: string }> {
  return [...changelog.matchAll(/^##[^\S\r\n]+(\S+)/gm)]
    .flatMap((heading) => {
      const version = normalizeFull(heading[1])
      return version ? [{ index: heading.index, version }] : []
    })
}

function renderSection(
  commits: Commit[],
  title: string,
  repository: Repository | undefined,
): string[] {
  const renderedCommits = commits
    .map((commit) => {
      const reference = repository
        ? `[<samp>(${commit.hash.slice(0, 5)})</samp>](${repository.provider.commitUrl(repository, commit.hash)})`
        : ''
      const authorNames = commit.authors.map(author => author.login
        ? `@${author.login}`
        : `**${escapeHtml(author.name)}**`)
      const authors = authorNames.length > 1
        ? `${authorNames.slice(0, -1).join(', ')} and ${authorNames.at(-1)}`
        : authorNames[0] || ''
      const pullRequests = commit.pullRequests.map(pullRequest =>
        repository
          ? `[${pullRequest}](${repository.provider.pullRequestUrl(repository, pullRequest)})`
          : pullRequest,
      ).join(', ')
      const details = [
        authors ? `by ${authors}` : '',
        pullRequests ? `in ${pullRequests}` : '',
        reference,
      ]
        .filter(Boolean)
        .join(' ')
      const suffix = details ? ` &nbsp;-&nbsp; ${details}` : ''
      return {
        scope: commit.scope,
        line: `${escapeHtml(capitalize(commit.description))}${suffix}`,
      }
    })

  if (!renderedCommits.length)
    return []

  const commitsByScope = new Map<string, string[]>()
  for (const { scope, line } of renderedCommits) {
    const lines = commitsByScope.get(scope) || []
    lines.push(line)
    commitsByScope.set(scope, lines)
  }
  const groupByScope = [...commitsByScope]
    .some(([scope, lines]) => Boolean(scope) && lines.length > 1)
  const lines = groupByScope
    ? [...commitsByScope.keys()].sort().flatMap((scope) => {
        const scopedLines = (commitsByScope.get(scope) || [])
          .reverse()
          .map(line => `${scope ? '  ' : ''}- ${line}`)
        return scope
          ? [`- **${escapeHtml(scope)}**:`, ...scopedLines]
          : scopedLines
      })
    : renderedCommits.reverse().map(({ scope, line }) => {
        const prefix = scope ? `**${escapeHtml(scope)}**: ` : ''
        return `- ${prefix}${line}`
      })

  return [
    '',
    `### ${title}`,
    '',
    ...lines,
  ]
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function escapeHtml(value: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
  }
  return value.replace(/[&<>"']/g, character => htmlEntities[character])
}
