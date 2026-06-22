/**
 * Regression: when NEXT_PUBLIC_CONNECTOR_URL is unset (connector-service not
 * deployed), connectorApi has no baseURL, so `/catalog` resolves against the
 * web origin and returns the app's HTML shell — a *string*, not an array. The
 * `r.data ?? []` guard only catches null/undefined, so the string slipped
 * through and `catalog.map(...)` in WorkspaceSettings threw
 * "map is not a function", white-screening the admin page.
 *
 * List methods must return an array for ANY non-array body.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { connectorApi } from '@/lib/api/axios'
import { connectorService } from '@/lib/api/connector'

vi.mock('@/lib/store/auth.store', () => ({
  useAuthStore: { getState: () => ({ accessToken: null }) },
}))

function stubResponse(data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as InternalAxiosRequestConfig,
  }
}

describe('connectorService list methods coerce non-array responses to []', () => {
  const originalAdapter = connectorApi.defaults.adapter
  let body: unknown

  beforeEach(() => {
    connectorApi.defaults.adapter = async () => stubResponse(body)
  })
  afterEach(() => {
    connectorApi.defaults.adapter = originalAdapter
  })

  it('getCatalog returns [] when the body is an HTML string (misconfigured baseURL)', async () => {
    body = '<!doctype html><html><body>app shell</body></html>'
    await expect(connectorService.getCatalog()).resolves.toEqual([])
  })

  it('getCatalog returns [] when the body is an error object', async () => {
    body = { statusCode: 404, message: 'Not Found' }
    await expect(connectorService.getCatalog()).resolves.toEqual([])
  })

  it('getCatalog passes a valid array through unchanged', async () => {
    body = [{ id: 'gmail', name: 'Gmail' }]
    await expect(connectorService.getCatalog()).resolves.toEqual([
      { id: 'gmail', name: 'Gmail' },
    ])
  })

  it('getConnections and getSkills also coerce non-arrays to []', async () => {
    body = '<html>'
    await expect(connectorService.getConnections()).resolves.toEqual([])
    await expect(connectorService.getSkills()).resolves.toEqual([])
  })

  it('getDirectory coerces a non-array body to []', async () => {
    body = '<html>'
    await expect(connectorService.getDirectory()).resolves.toEqual([])
  })

  it('getDirectory passes a valid array through unchanged', async () => {
    body = [{ id: 'd1', slug: 'notion', name: 'Notion' }]
    await expect(connectorService.getDirectory()).resolves.toEqual([
      { id: 'd1', slug: 'notion', name: 'Notion' },
    ])
  })
})

describe('directory connect endpoints hit the expected URLs', () => {
  const originalAdapter = connectorApi.defaults.adapter
  let lastUrl: string | undefined
  let lastMethod: string | undefined

  beforeEach(() => {
    connectorApi.defaults.adapter = async (config) => {
      lastUrl = config.url
      lastMethod = config.method
      return stubResponse(
        config.url?.includes('/start')
          ? { mode: 'oauth', authorizeUrl: 'https://auth/x' }
          : { connected: true },
      )
    }
  })
  afterEach(() => {
    connectorApi.defaults.adapter = originalAdapter
  })

  it('startDirectoryOAuth GETs /oauth/directory/:slug/start', async () => {
    const res = await connectorService.startDirectoryOAuth('notion')
    expect(lastMethod).toBe('get')
    expect(lastUrl).toBe('/oauth/directory/notion/start')
    expect(res).toEqual({ mode: 'oauth', authorizeUrl: 'https://auth/x' })
  })

  it('connectDirectoryKey POSTs to /oauth/directory/:slug/connect-key', async () => {
    const res = await connectorService.connectDirectoryKey('acme', 'sk-1')
    expect(lastMethod).toBe('post')
    expect(lastUrl).toBe('/oauth/directory/acme/connect-key')
    expect(res).toEqual({ connected: true })
  })

  it('deleteDirectoryEntry DELETEs /directory/:id', async () => {
    await connectorService.deleteDirectoryEntry('d1')
    expect(lastMethod).toBe('delete')
    expect(lastUrl).toBe('/directory/d1')
  })
})
