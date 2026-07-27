import type {
  RepositoryAuthor,
  RepositoryCommit,
} from './provider'
import { x } from 'tinyexec'

export interface Commit extends RepositoryCommit {
  type: string
  scope: string
  description: string
  pullRequests: string[]
  isBreaking: boolean
}

export async function git(cwd: string, ...args: string[]) {
  const result = await x('git', args, {
    nodeOptions: { cwd },
  })
  if (result.exitCode !== 0) {
    throw new Error(
      result.stderr.trim() || `Git exited with status ${result.exitCode}`,
    )
  }
  return result.stdout
}

export async function getLatestTag(cwd: string) {
  const result = await x(
    'git',
    ['describe', '--tags', '--abbrev=0'],
    { nodeOptions: { cwd } },
  )
  return result.stdout.trim()
}

export async function getTagCommit(cwd: string, tag: string) {
  return git(cwd, 'rev-list', '-n', '1', tag)
    .then(output => output.trim() || undefined)
    .catch(() => undefined)
}

export async function getPreviousTag(
  cwd: string,
  tag: string,
  releaseRef: string,
) {
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

export async function getRemoteTagCommit(cwd: string, tag: string) {
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

export async function readCommits(cwd: string, from: string, to: string) {
  const log = await git(
    cwd,
    'log',
    from ? `${from}..${to}` : to,
    '--format=%h%x00%an%x00%ae%x00%s%x00%b%x00',
  )

  return parseGitLog(log)
    .map(commit => parseCommit(
      commit.hash,
      commit.subject,
      commit.body,
      commit.author,
    ))
    .filter(commit => commit !== null)
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
    if (subject) {
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
  }

  return commits
}

export function parseCommit(
  hash: string,
  subject: string,
  body: string,
  author: RepositoryAuthor,
): Commit | null {
  const match = /^(?<type>[a-z]+)(?:\((?<scope>[^()\r\n]+)\))?(?<breaking>!)?: (?<description>.+)$/i.exec(subject)
  if (!match?.groups)
    return null

  const pullRequestPattern = /\([ a-z]*(#\d+)\s*\)/gi
  const pullRequests = [
    ...new Set(
      [...match.groups.description.matchAll(pullRequestPattern)]
        .map(reference => reference[1]),
    ),
  ]
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
    description: match.groups.description.replace(pullRequestPattern, '').trim(),
    pullRequests,
    isBreaking: Boolean(match.groups.breaking)
      || /^BREAKING(?: |-)CHANGE:/im.test(body),
  }
}
