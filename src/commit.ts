import type { RawCommit } from './git'
import type { RepositoryCommit } from './repository'

export interface Commit extends RepositoryCommit {
  type: string
  scope: string
  description: string
  pullRequests: string[]
  isBreaking: boolean
}

export function parseCommits(commits: RawCommit[]): Commit[] {
  return commits.map(parseCommit).filter(commit => commit !== null)
}

export function parseCommit(commit: RawCommit): Commit | null {
  const match = /^(?<type>[a-z]+)(?:\((?<scope>[^()\r\n]+)\))?(?<breaking>!)?: (?<description>.+)$/i.exec(commit.subject)
  if (!match?.groups)
    return null

  const pullRequestPattern = /\([ a-z]*(#\d+)\s*\)/gi
  const pullRequests = [
    ...new Set(
      [...match.groups.description.matchAll(pullRequestPattern)]
        .map(reference => reference[1]),
    ),
  ]
  const authors = [commit.author]
  for (const coAuthor of commit.body.matchAll(
    /^Co-Authored-By:([^<\r\n]+)<([^>\r\n]+)>[^\S\r\n]*$/gim,
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
    hash: commit.hash,
    authors: authors.filter(
      author => !/\[bot\]|dependabot|\(bot\)/i.test(author.name),
    ),
    type: match.groups.type.toLowerCase(),
    scope: match.groups.scope || '',
    description: match.groups.description.replace(pullRequestPattern, '').trim(),
    pullRequests,
    isBreaking: Boolean(match.groups.breaking)
      || /^BREAKING(?: |-)CHANGE:/im.test(commit.body),
  }
}
