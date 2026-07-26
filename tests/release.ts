import {
  addPackage,
  command,
  createBareRepository,
  createRepository,
} from './git'

export interface GitHubRequest {
  url: string
  method: string
  body?: Record<string, unknown>
}

export async function createReleaseRepository() {
  const cwd = await createRepository()
  const remote = await createBareRepository()
  await command(cwd, 'git', 'remote', 'add', 'origin', remote)
  await addPackage(cwd, 'https://github.com/example/project.git')
  return { cwd, remote }
}

export function githubReleaseFetch(options: {
  existing?: boolean
  requests?: GitHubRequest[]
  onPublish?: (body: Record<string, unknown>) => void
} = {}): typeof globalThis.fetch {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || 'GET'
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body)
      : undefined
    options.requests?.push({ url, method, body })
    if (url.includes('/search/users'))
      return Response.json({ items: [{ login: 'test-author' }] })
    if (url.endsWith('/releases/tags/v1.1.0')) {
      if (options.existing) {
        return Response.json({
          id: 42,
          html_url: 'https://github.com/example/project/releases/tag/v1.1.0',
        })
      }
      return new Response(null, { status: 404 })
    }
    if (
      (url.endsWith('/releases') && method === 'POST')
      || (url.endsWith('/releases/42') && method === 'PATCH')
    ) {
      options.onPublish?.(body)
      return Response.json({
        html_url: 'https://github.com/example/project/releases/tag/v1.1.0',
      })
    }
    throw new Error(`Unexpected request: ${method} ${url}`)
  }
}
