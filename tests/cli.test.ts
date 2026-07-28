import { beforeEach, expect, it, vi } from 'vitest'
import { runCli } from '../src/cli'

const { runChangelog } = vi.hoisted(() => ({
  runChangelog: vi.fn(),
}))

vi.mock('../src/run', () => ({ runChangelog }))

beforeEach(() => {
  runChangelog.mockReset()
  runChangelog.mockResolvedValue(undefined)
})

it('maps CLI arguments to changelog options', async () => {
  await runCli(
    [
      'v1.1.0',
      '--output',
      'notes.md',
      '--dry',
      '--commit',
      '--release',
      '--author',
      'Release Author <release@example.com>',
      '--token',
      'secret',
    ],
    { cwd: '/project' },
  )

  expect(runChangelog).toHaveBeenCalledOnce()
  expect(runChangelog).toHaveBeenCalledWith(
    {
      version: '1.1.0',
      output: 'notes.md',
      dry: true,
      commit: true,
      release: true,
      author: 'Release Author <release@example.com>',
      token: 'secret',
    },
    { cwd: '/project' },
  )
})

it('requires a release version before executing', async () => {
  await expect(
    runCli([], { cwd: '/project' }),
  ).rejects.toThrow('A release version is required')
  expect(runChangelog).not.toHaveBeenCalled()
})
