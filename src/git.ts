import type { RepositoryAuthor } from './repository'
import { x } from 'tinyexec'

export interface RawCommit {
  hash: string
  subject: string
  body: string
  author: RepositoryAuthor
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

export async function getLatestTag(cwd: string): Promise<string> {
  const result = await x(
    'git',
    ['describe', '--tags', '--abbrev=0'],
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

export async function getPreviousTag(
  cwd: string,
  tag: string,
  releaseRef: string,
): Promise<string> {
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
