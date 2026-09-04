import type { RepositoryAuthor } from './repository'
import { x } from 'tinyexec'
import { normalizeFull } from 'verkit'

export interface RawCommit {
  hash: string
  subject: string
  body: string
  author: RepositoryAuthor
}

function versionTagPattern(tagPrefix: string): string {
  const escapedPrefix = tagPrefix.replace(/[\\*?[\]]/g, '\\$&')
  return `${escapedPrefix}[0-9]*`
}

export async function git(cwd: string, ...args: string[]): Promise<string> {
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

export async function getLatestTag(
  cwd: string,
  tagPrefix?: string,
): Promise<string> {
  const args = ['describe', '--tags', '--abbrev=0']
  if (tagPrefix !== undefined)
    args.push('--match', versionTagPattern(tagPrefix))
  const result = await x(
    'git',
    args,
    { nodeOptions: { cwd } },
  )
  return result.stdout.trim()
}

export async function getTagCommit(
  cwd: string,
  tag: string,
): Promise<string | undefined> {
  return git(cwd, 'rev-list', '-n', '1', tag)
    .then(output => output.trim() || undefined)
    .catch(() => undefined)
}

export async function resolveVersionRef(
  cwd: string,
  ref: string,
  tagPrefix: string,
): Promise<string> {
  const version = normalizeFull(ref)
  if (!version)
    return ref

  const candidates = [...new Set([`${tagPrefix}${version}`, ref])]
  for (const candidate of candidates) {
    const commit = await getTagCommit(cwd, `refs/tags/${candidate}`)
    if (commit)
      return candidate
  }

  return ref
}

export async function getPreviousTag(
  cwd: string,
  tag: string,
  releaseRef: string,
  tagPrefix: string,
): Promise<string> {
  const releaseVersion = normalizeFull(tag.slice(tagPrefix.length))
  if (releaseVersion && !releaseVersion.includes('-')) {
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
      .find((candidate) => {
        if (candidate === tag || !candidate.startsWith(tagPrefix))
          return false
        const version = normalizeFull(candidate.slice(tagPrefix.length))
        return Boolean(version && !version.includes('-'))
      })
    if (previousStable)
      return previousStable
  }

  return git(
    cwd,
    'describe',
    '--tags',
    '--abbrev=0',
    '--match',
    versionTagPattern(tagPrefix),
    `${releaseRef}^`,
  ).then(output => output.trim()).catch(() => '')
}

export async function getRemoteTagCommit(
  cwd: string,
  tag: string,
): Promise<string | undefined> {
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

export async function readGitCommits(
  cwd: string,
  from: string,
  to: string,
): Promise<RawCommit[]> {
  const log = await git(
    cwd,
    'log',
    from ? `${from}..${to}` : to,
    '--format=%h%x00%an%x00%ae%x00%s%x00%b%x00',
  )
  const fields = log.split('\0')
  const commits: RawCommit[] = []

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
