import type { RepositoryAuthor } from '../src/provider'
import { describe, expect, test } from 'vitest'
import { git, parseCommit, readCommits } from '../src/git'
import { command, createRepository } from './git'

const author: RepositoryAuthor = {
  name: 'Test Author',
  email: 'author@example.com',
}

describe('parseCommit', () => {
  test('parses a conventional commit', () => {
    expect(parseCommit(
      '1234567',
      'feat(parser): handle separators',
      '',
      author,
    )).toEqual({
      hash: '1234567',
      authors: [author],
      type: 'feat',
      scope: 'parser',
      description: 'handle separators',
      pullRequests: [],
      isBreaking: false,
    })
  })

  test('extracts pull requests from squash commit subjects', () => {
    expect(parseCommit(
      '1234567',
      'feat: add CLI (#123)',
      '',
      author,
    )).toMatchObject({
      description: 'add CLI',
      pullRequests: ['#123'],
    })
  })

  test('ignores a non-conventional commit', () => {
    expect(parseCommit('1234567', 'Update readme', '', author)).toBeNull()
  })

  test.each([
    ['feat!: remove the legacy API', ''],
    [
      'fix: change the configuration format',
      'BREAKING-CHANGE: configuration files must be migrated',
    ],
    [
      'fix: change the plugin API',
      'BREAKING CHANGE: plugins must export a factory',
    ],
  ])('recognizes a breaking change in %s', (subject, body) => {
    expect(parseCommit('1234567', subject, body, author)?.isBreaking).toBe(true)
  })

  test('collects unique co-authors', () => {
    const result = parseCommit(
      '1234567',
      'fix: support pairs',
      [
        'Co-Authored-By: Second Author <second@example.com>',
        'Co-Authored-By: Duplicate <author@example.com>',
      ].join('\n'),
      author,
    )

    expect(result?.authors).toEqual([
      author,
      { name: 'Second Author', email: 'second@example.com' },
    ])
  })

  test('excludes bot participants', () => {
    const result = parseCommit(
      '1234567',
      'fix: update dependencies',
      [
        'Co-Authored-By: automation[bot] <automation@example.com>',
        'Co-Authored-By: Dependabot <dependabot@example.com>',
        'Co-Authored-By: Release (bot) <release@example.com>',
      ].join('\n'),
      author,
    )

    expect(result?.authors).toEqual([author])
  })
})

test('reads conventional commits from a Git range', async () => {
  const cwd = await createRepository()

  const commits = await readCommits(cwd, 'v1.0.0', 'HEAD')

  expect(commits).toEqual([
    {
      hash: expect.stringMatching(/^[0-9a-f]{7}$/),
      authors: [author],
      type: 'feat',
      scope: '',
      description: 'add CLI',
      pullRequests: [],
      isBreaking: false,
    },
  ])
})

test('reports Git stderr when a command fails', async () => {
  const cwd = await createRepository()
  await command(cwd, 'git', 'config', 'user.name', '')
  await command(cwd, 'git', 'config', 'user.email', '')

  await expect(
    git(cwd, 'commit', '--allow-empty', '-m', 'test'),
  ).rejects.toThrow(/Author identity unknown|empty ident name/)
})
