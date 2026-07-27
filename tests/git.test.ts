import type { RepositoryAuthor } from '../src/provider'
import { describe, expect, test } from 'vitest'
import { parseCommit, readCommits } from '../src/git'
import { createRepository } from './git'

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
      isBreaking: false,
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
      isBreaking: false,
    },
  ])
})
