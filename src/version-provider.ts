export interface VersionProvider {
  update: (cwd: string, version: string) => Promise<string | undefined>
}
