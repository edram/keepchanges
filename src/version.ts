import type { VersionProvider } from './version-provider'
import { npmVersionProvider } from './versions/npm'

const providers: VersionProvider[] = [npmVersionProvider]

export async function updateVersion(cwd: string, version: string) {
  for (const provider of providers) {
    const path = await provider.update(cwd, version)
    if (path)
      return path
  }
}
