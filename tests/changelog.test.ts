import type { Commit } from '../src/commit'
import type { ChangelogConfigOverrides } from '../src/config'
import type { Repository } from '../src/repository'
import { describe, expect, it } from 'vitest'
import {
  generateChangelog,
  hasRelease,
  insertRelease,
} from '../src/changelog'
import { githubRepository } from '../src/repositories/github'

function commit(overrides: Partial<Commit> = {}): Commit {
  return {
    hash: '1234567',
    authors: [{ name: 'Test Author', email: 'author@example.com' }],
    type: 'feat',
    scope: '',
    description: 'add CLI',
    pullRequests: [],
    isBreaking: false,
    ...overrides,
  }
}

function changelog(
  version: string,
  commits: Commit[],
  repository?: Repository,
  comparisonFrom = '',
  config: ChangelogConfigOverrides = {},
) {
  return generateChangelog({
    version,
    commits,
    repository,
    comparisonFrom,
  }, config)
}

describe('generateChangelog', () => {
  it('groups conventional commits by release section', () => {
    const { release } = changelog(
      '2.0.0',
      [
        commit(),
        commit({
          hash: '2345678',
          type: 'fix',
          description: 'handle invalid input',
        }),
        commit({
          hash: '3456789',
          description: 'remove the legacy API',
          isBreaking: true,
        }),
        commit({
          hash: '4567890',
          type: 'perf',
          description: 'speed up changelog generation',
        }),
      ],
      undefined,
      '',
    )

    expect(release).toBe([
      '## v2.0.0',
      '',
      '### 🚨 Breaking Changes',
      '',
      '- Remove the legacy API &nbsp;-&nbsp; by **Test Author**',
      '',
      '### 🚀 Features',
      '',
      '- Add CLI &nbsp;-&nbsp; by **Test Author**',
      '',
      '### 🐞 Bug Fixes',
      '',
      '- Handle invalid input &nbsp;-&nbsp; by **Test Author**',
      '',
      '### 🏎 Performance',
      '',
      '- Speed up changelog generation &nbsp;-&nbsp; by **Test Author**',
      '',
    ].join('\n'))
  })

  it('renders scopes, participants, and HTML safely', () => {
    const { body } = changelog(
      '1.1.0',
      [
        commit({
          scope: 'ui<button>',
          description: 'support generic<T> & "quoted" \'single\' APIs',
          authors: [
            { name: 'Test & Author', email: 'author@example.com' },
            {
              name: 'Ignored Name',
              email: 'second@example.com',
              login: 'second-author',
            },
          ],
        }),
      ],
      undefined,
      '',
    )

    expect(body).toContain(
      '- **ui&lt;button&gt;**: Support generic&lt;T&gt; &amp; &quot;quoted&quot; &#39;single&#39; APIs &nbsp;-&nbsp; by **Test &amp; Author** and @second-author',
    )
  })

  it('groups commits by scope when a scope contains multiple entries', () => {
    const { body } = changelog(
      '1.1.0',
      [
        commit({ scope: 'gitea', description: 'third' }),
        commit({ scope: 'cli', description: 'configure output' }),
        commit({ description: 'second' }),
        commit({ scope: 'gitea', description: 'publish releases' }),
        commit({ description: 'first' }),
      ],
      undefined,
      '',
    )

    expect(body).toBe([
      '### 🚀 Features',
      '',
      '- First &nbsp;-&nbsp; by **Test Author**',
      '- Second &nbsp;-&nbsp; by **Test Author**',
      '- **cli**:',
      '  - Configure output &nbsp;-&nbsp; by **Test Author**',
      '- **gitea**:',
      '  - Publish releases &nbsp;-&nbsp; by **Test Author**',
      '  - Third &nbsp;-&nbsp; by **Test Author**',
    ].join('\n'))
  })

  it('links commits and the comparison when a repository is available', () => {
    const repository = githubRepository.parse(
      'git@github.com:example/project.git',
    )!
    const { body } = changelog(
      '1.1.0',
      [commit({ pullRequests: ['#123'] })],
      repository,
      'v1.0.0',
    )

    expect(body).toContain(
      'by **Test Author** in [#123](https://github.com/example/project/pull/123) [<samp>(12345)</samp>]',
    )
    expect(body).toContain(
      '[<samp>(12345)</samp>](https://github.com/example/project/commit/1234567)',
    )
    expect(body).toContain(
      '[View changes on GitHub](https://github.com/example/project/compare/v1.0.0...v1.1.0)',
    )
  })

  it('renders a fallback when there are no significant changes', () => {
    const { body } = changelog(
      '1.1.0',
      [commit({ type: 'chore' })],
      undefined,
      '',
    )

    expect(body).toBe('*No significant changes*')
  })

  it('applies changelog style overrides', () => {
    const { body } = changelog(
      '1.1.0',
      [
        commit({ scope: 'cli', description: 'second' }),
        commit({ scope: 'cli', description: 'first' }),
      ],
      undefined,
      '',
      {
        emoji: false,
        capitalize: false,
        group: false,
      },
    )

    expect(body).toBe([
      '### Features',
      '',
      '- **cli**: first &nbsp;-&nbsp; by **Test Author**',
      '- **cli**: second &nbsp;-&nbsp; by **Test Author**',
    ].join('\n'))
  })

  it('supports custom sections', () => {
    const { body } = changelog(
      '1.1.0',
      [commit({ type: 'docs' })],
      undefined,
      '',
      {
        types: {
          docs: { emoji: '📚', title: 'Documentation' },
        },
      },
    )

    expect(body).toContain('### 📚 Documentation')
  })

  it('supports custom fallback and comparison messages', () => {
    const repository = githubRepository.parse(
      'https://github.com/example/project',
    )!
    const { body } = changelog(
      '1.1.0',
      [commit({ type: 'chore' })],
      repository,
      'v1.0.0',
      {
        messages: {
          noSignificantChanges: 'Nothing noteworthy',
          viewChanges: 'Compare on {provider}',
        },
      },
    )

    expect(body).toContain('*Nothing noteworthy*')
    expect(body).toContain('[Compare on GitHub]')
  })
})

describe('insertRelease', () => {
  const release = '## v1.1.0\n\n- Current release\n'

  it('appends the first release after the changelog preamble', () => {
    expect(insertRelease('# Changelog\n', release)).toBe(
      '# Changelog\n\n## v1.1.0\n\n- Current release\n',
    )
  })

  it('inserts a release before existing history', () => {
    const changelog = [
      '# Changelog',
      '',
      'Project release history.',
      '',
      '## v1.0.0',
      '',
      '- Initial release',
      '',
    ].join('\n')

    expect(insertRelease(changelog, release)).toBe([
      '# Changelog',
      '',
      'Project release history.',
      '',
      '## v1.1.0',
      '',
      '- Current release',
      '',
      '## v1.0.0',
      '',
      '- Initial release',
      '',
    ].join('\n'))
  })

  it('replaces the same normalized release version', () => {
    const changelog = [
      '# Changelog',
      '',
      '## 1.1.0',
      '',
      '- Stale release',
      '',
      '## v1.0.0',
      '',
      '- Initial release',
      '',
    ].join('\n')

    const result = insertRelease(changelog, release)

    expect(result.match(/^## v?1\.1\.0$/gm)).toHaveLength(1)
    expect(result).not.toContain('Stale release')
    expect(result).toContain('## v1.0.0')
  })

  it('keeps prerelease and stable versions distinct', () => {
    const changelog = '# Changelog\n\n## v1.1.0-beta.1\n\n- Beta release\n'

    const result = insertRelease(changelog, release)

    expect(result).toContain('## v1.1.0\n')
    expect(result).toContain('## v1.1.0-beta.1\n')
  })
})

it('recognizes release headings with or without a v prefix', () => {
  expect(hasRelease('# Changelog\n\n## 1.1.0\n', 'v1.1.0')).toBe(true)
  expect(hasRelease('# Changelog\n\n## v1.1.0-beta.1\n', '1.1.0')).toBe(false)
})
