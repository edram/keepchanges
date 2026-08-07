import type ansis from 'ansis'
import type {
  ManualReleaseAction,
  Repository,
  RepositoryRelease,
  RepositoryReleaseResult,
} from '../repository'
import { version } from '../../package.json'

export interface ChangesPreview {
  from: string
  tag: string
  commitCount: number
  body: string
}

export function printChangesPreview(
  preview: ChangesPreview,
  stdout: (value: string) => void,
  colors: typeof ansis,
): void {
  stdout([
    colors.dim(`keep${colors.bold('changes')} v${version}`),
    `${colors.cyan(preview.from)}${colors.dim(' -> ')}${colors.blue(preview.tag)}${colors.dim(` (${preview.commitCount} commits)`)}`,
    colors.dim('--------------'),
    '',
    preview.body.replaceAll('&nbsp;', ''),
    '',
    colors.dim('--------------'),
    '',
  ].join('\n'))
}

export function printManualReleaseUrl(
  repository: Repository,
  release: RepositoryRelease,
  stdout: (value: string) => void,
  colors: typeof ansis,
  action: ManualReleaseAction = 'create',
): void {
  const url = repository.provider.manualReleaseUrl?.(
    repository,
    release,
    action,
  )
  if (url) {
    stdout(
      `${colors.yellow(`Using the following link to ${action} it manually:`)}\n${colors.yellow(url)}\n`,
    )
  }
}

export function printPublishedRelease(
  provider: string,
  result: RepositoryReleaseResult,
  stdout: (value: string) => void,
  colors: typeof ansis,
): void {
  const action = result.action.charAt(0).toUpperCase() + result.action.slice(1)
  stdout(
    `${colors.green(`${action} ${provider} release: ${result.url}`)}\n`,
  )
}
