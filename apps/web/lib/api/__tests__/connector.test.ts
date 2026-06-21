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
})
