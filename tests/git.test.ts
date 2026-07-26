import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { runCli } from '../src/cli'
import { command, commit, createRepository } from './git'

test('renders the Git author for each commit', async () => {
  const cwd = await createRepository()

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    '- Add CLI &nbsp;-&nbsp; by **Test Author**',
  )
})

test('renders co-authors as commit participants', async () => {
  const cwd = await createRepository()
  await commit(
    cwd,
    'fix: support pairs',
    'Co-Authored-By: Second Author <second@example.com>',
  )

  await runCli(['1.1.0'], { cwd })

  await expect(readFile(join(cwd, 'CHANGELOG.md'), 'utf8')).resolves.toContain(
    '- Support pairs &nbsp;-&nbsp; by **Test Author** and **Second Author**',
  )
})

test('excludes bot commit participants', async () => {
  const cwd = await createRepository()
  await commit(
    cwd,
    'fix: update dependencies',
    [
      'Co-Authored-By: automation[bot] <automation@example.com>',
      'Co-Authored-By: Dependabot <dependabot@example.com>',
      'Co-Authored-By: Release (bot) <release@example.com>',
    ].join('\n'),
  )

  await runCli(['1.1.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain(
    '- Update dependencies &nbsp;-&nbsp; by **Test Author**',
  )
  expect(changelog).not.toMatch(/\[bot\]|dependabot|\(bot\)/i)
})

test('omits empty author details for bot-authored commits', async () => {
  const cwd = await createRepository()
  await command(cwd, 'git', 'config', 'user.name', 'automation[bot]')
  await command(cwd, 'git', 'config', 'user.email', 'bot@example.com')
  await commit(cwd, 'fix: automated update')

  await runCli(['1.1.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain('\n- Automated update\n')
  expect(changelog).not.toContain('by **automation[bot]**')
})

test('renders an exclamation-mark commit only under Breaking Changes', async () => {
  const cwd = await createRepository()
  await commit(cwd, 'feat!: remove the legacy API')

  await runCli(['2.0.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain([
    '### 🚨 Breaking Changes',
    '',
    '- Remove the legacy API',
  ].join('\n'))
  expect(changelog.match(/Remove the legacy API/g)).toHaveLength(1)
})

test('recognizes a BREAKING-CHANGE trailer', async () => {
  const cwd = await createRepository()
  await commit(
    cwd,
    'fix: change the configuration format',
    'BREAKING-CHANGE: configuration files must be migrated',
  )

  await runCli(['2.0.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain([
    '### 🚨 Breaking Changes',
    '',
    '- Change the configuration format',
  ].join('\n'))
})

test('recognizes a BREAKING CHANGE trailer', async () => {
  const cwd = await createRepository()
  await commit(
    cwd,
    'fix: change the plugin API',
    'BREAKING CHANGE: plugins must export a factory',
  )

  await runCli(['2.0.0'], { cwd })

  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain('- Change the plugin API')
  expect(changelog.indexOf('Change the plugin API')).toBeLessThan(
    changelog.indexOf('### 🚀 Features'),
  )
})
