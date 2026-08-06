import { describe, expect, it } from 'vitest'
import { resolveOptions } from '../../src/cli/options'
import { defaultConfig } from '../../src/config'

it('normalizes CLI arguments into command options', () => {
  expect(resolveOptions('v1.1.0', {
    from: 'v1.0.0',
    to: 'feature',
    repository: 'example/project',
    output: 'notes.md',
    dry: true,
    commit: true,
    author: 'Release Author <release@example.com>',
    token: 'secret',
    emoji: false,
    capitalize: false,
    group: false,
  })).toEqual({
    version: '1.1.0',
    from: 'v1.0.0',
    to: 'feature',
    repository: 'example/project',
    output: 'notes.md',
    dry: true,
    commit: true,
    release: false,
    author: 'Release Author <release@example.com>',
    token: 'secret',
    name: undefined,
    draft: false,
    prerelease: undefined,
    emoji: false,
    capitalize: false,
    group: false,
  })
})

it('uses centralized CLI and changelog defaults', () => {
  expect(resolveOptions('1.1.0', {})).toEqual({
    version: '1.1.0',
    from: undefined,
    to: defaultConfig.cli.to,
    repository: undefined,
    output: defaultConfig.cli.output,
    dry: defaultConfig.cli.dry,
    commit: defaultConfig.cli.commit,
    release: defaultConfig.cli.release,
    author: defaultConfig.cli.author,
    token: undefined,
    name: undefined,
    draft: defaultConfig.cli.draft,
    prerelease: undefined,
    emoji: defaultConfig.changelog.emoji,
    capitalize: defaultConfig.changelog.capitalize,
    group: defaultConfig.changelog.group,
  })
})

describe('cli validation', () => {
  it('requires a valid release version', () => {
    expect(() => resolveOptions(undefined, {}))
      .toThrow('A release version is required')
    expect(() => resolveOptions('next', {}))
      .toThrow('Invalid release version: next')
  })

  it('rejects an explicit end reference for releases', () => {
    expect(() => resolveOptions('1.1.0', {
      release: true,
      to: 'HEAD',
    })).toThrow('--to cannot be used with --release')
  })

  it('requires commit behavior for a custom author', () => {
    expect(() => resolveOptions('1.1.0', {
      author: 'Release Author <release@example.com>',
    })).toThrow('--author requires --commit or --release')
  })

  it.each([
    { name: 'Release 1.1.0' },
    { draft: true },
    { prerelease: true },
  ])('requires --release for release metadata', (options) => {
    expect(() => resolveOptions('1.1.0', options))
      .toThrow('--name, --draft, and --prerelease require --release')
  })
})
