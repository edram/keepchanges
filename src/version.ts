import { npmVersionProvider } from './versions/npm'

export interface VersionProvider {
  update: (cwd: string, version: string) => Promise<string | undefined>
}

const providers: VersionProvider[] = [npmVersionProvider]

export async function updateVersion(
  cwd: string,
  version: string,
): Promise<string | undefined> {
  for (const provider of providers) {
    const path = await provider.update(cwd, version)
    if (path)
      return path
  }
}
