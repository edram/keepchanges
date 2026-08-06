import type { RawCommit } from '../src/git'
import { describe, expect, it } from 'vitest'
import { parseCommit, parseCommits } from '../src/commit'

function rawCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: '1234567',
    subject: 'feat(parser): handle separators',
    body: '',
    author: {
      name: 'Test Author',
      email: 'author@example.com',
    },
    ...overrides,
  }
}

describe('parseCommit', () => {
  it('parses a conventional commit', () => {
    expect(parseCommit(rawCommit())).toEqual({
      hash: '1234567',
      authors: [{ name: 'Test Author', email: 'author@example.com' }],
      type: 'feat',
      scope: 'parser',
      description: 'handle separators',
      pullRequests: [],
      isBreaking: false,
    })
  })

  it('extracts pull requests from squash commit subjects', () => {
    expect(parseCommit(rawCommit({ subject: 'feat: add CLI (#123)' })))
      .toMatchObject({
        description: 'add CLI',
        pullRequests: ['#123'],
      })
  })

  it('ignores non-conventional commits', () => {
    const conventional = rawCommit()
    const other = rawCommit({ subject: 'Update readme' })

    expect(parseCommit(other)).toBeNull()
    expect(parseCommits([conventional, other])).toHaveLength(1)
  })

  it.each([
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
    expect(parseCommit(rawCommit({ subject, body }))?.isBreaking).toBe(true)
  })

  it('collects unique co-authors', () => {
    const result = parseCommit(rawCommit({
      body: [
        'Co-Authored-By: Second Author <second@example.com>',
        'Co-Authored-By: Duplicate <author@example.com>',
      ].join('\n'),
    }))

    expect(result?.authors).toEqual([
      { name: 'Test Author', email: 'author@example.com' },
      { name: 'Second Author', email: 'second@example.com' },
    ])
  })

  it('excludes bot participants', () => {
    const result = parseCommit(rawCommit({
      body: [
        'Co-Authored-By: automation[bot] <automation@example.com>',
        'Co-Authored-By: Dependabot <dependabot@example.com>',
        'Co-Authored-By: Release (bot) <release@example.com>',
      ].join('\n'),
    }))

    expect(result?.authors).toEqual([
      { name: 'Test Author', email: 'author@example.com' },
    ])
  })
})
