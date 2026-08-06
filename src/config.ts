export interface ChangelogSectionConfig {
  emoji: string
  title: string
}

export interface ChangelogMessages {
  noSignificantChanges: string
  viewChanges: string
}

export interface ChangelogConfig {
  emoji: boolean
  capitalize: boolean
  group: boolean
  breakingChanges: ChangelogSectionConfig
  types: Record<string, ChangelogSectionConfig>
  messages: ChangelogMessages
}

export interface ChangelogConfigOverrides {
  emoji?: boolean
  capitalize?: boolean
  group?: boolean
  breakingChanges?: Partial<ChangelogSectionConfig>
  types?: Record<string, ChangelogSectionConfig>
  messages?: Partial<ChangelogMessages>
}

export interface KeepChangesConfig {
  cli: {
    output: string
    to: string
    dry: boolean
    commit: boolean
    release: boolean
    author: string
    draft: boolean
  }
  changelog: ChangelogConfig
}

export const defaultConfig = {
  cli: {
    output: 'CHANGELOG.md',
    to: 'HEAD',
    dry: false,
    commit: false,
    release: false,
    author: 'github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>',
    draft: false,
  },
  changelog: {
    emoji: true,
    capitalize: true,
    group: true,
    breakingChanges: {
      emoji: '🚨',
      title: 'Breaking Changes',
    },
    types: {
      feat: { emoji: '🚀', title: 'Features' },
      fix: { emoji: '🐞', title: 'Bug Fixes' },
      perf: { emoji: '🏎', title: 'Performance' },
    },
    messages: {
      noSignificantChanges: 'No significant changes',
      viewChanges: 'View changes on {provider}',
    },
  },
} satisfies KeepChangesConfig

export function resolveChangelogConfig(
  overrides: ChangelogConfigOverrides = {},
): ChangelogConfig {
  return {
    ...defaultConfig.changelog,
    ...overrides,
    breakingChanges: {
      ...defaultConfig.changelog.breakingChanges,
      ...overrides.breakingChanges,
    },
    types: overrides.types ?? defaultConfig.changelog.types,
    messages: {
      ...defaultConfig.changelog.messages,
      ...overrides.messages,
    },
  }
}
