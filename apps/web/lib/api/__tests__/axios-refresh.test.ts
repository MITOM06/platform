/**
 * Tests for the 401-refresh interceptor in lib/api/axios.ts.
 *
 * The interceptor calls bare `axios.post('/api/auth/refresh')` (no baseURL) and
 * `apiInstance(config)` for the retry.  Both resolve to XHR in jsdom which
 * yields a 404.  We patch the adapters on BOTH the bare axios default AND the
 * chatApi instance so every HTTP call goes through our in-memory stubs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import type { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { useAuthStore } from '@/lib/store/auth.store'
import { chatApi } from '@/lib/api/axios'

type SimpleAdapter = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>

// ── Mock Zustand auth store ────────────────────────────────────────────────

vi.mock('@/lib/store/auth.store', () => {
  const clearAuth = vi.fn()
  const setAuth = vi.fn()
  const state = {
    accessToken: 'initial-token' as string | null,
    user: { id: 'u1', email: 'a@b.com', displayName: 'Alice', avatarUrl: undefined },
    clearAuth,
    setAuth,
  }
  return {
    useAuthStore: {
      getState: () => state,
      _state: state,
    },
  }
})

// ── Helpers ────────────────────────────────────────────────────────────────

type FakeState = {
  accessToken: string | null
  user: { id: string; email: string; displayName: string; avatarUrl: undefined }
  clearAuth: ReturnType<typeof vi.fn>
  setAuth: ReturnType<typeof vi.fn>
}

function getStoreState(): FakeState {
  return (useAuthStore as unknown as { _state: FakeState })._state
}

function setToken(token: string | null) {
  getStoreState().accessToken = token
}

/** Build a minimal 401 AxiosError pointing at the given URL. */
function make401(url = '/api/conversations'): AxiosError & { config: InternalAxiosRequestConfig & { _retry?: boolean } } {
  const config = {
    url,
    headers: new axios.AxiosHeaders(),
    method: 'get',
  } as InternalAxiosRequestConfig & { _retry?: boolean }

  const err = new axios.AxiosError(
    'Request failed with status code 401',
    'ERR_BAD_RESPONSE',
    config,
    null,
    {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
      data: {},
    } as AxiosResponse,
  )
  return err as typeof err & { config: typeof config }
}

type AdapterStub =
  | { type: 'resolve'; data: unknown; status?: number }
  | { type: 'reject'; error: unknown }

/**
 * Build an adapter that pops stubs in order.  Shared across global axios AND
 * chatApi so both paths are covered.
 */
function buildSequentialAdapter(stubs: AdapterStub[]): SimpleAdapter {
  let idx = 0
  return (config) =>
    new Promise((resolve, reject) => {
      const stub = stubs[idx++]
      if (!stub) {
        reject(new Error(`No more adapter stubs (call #${idx})`))
        return
      }
      if (stub.type === 'resolve') {
        resolve({
          data: stub.data,
          status: stub.status ?? 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse)
      } else {
        reject(stub.error)
      }
    })
}

// ── Setup / Teardown ───────────────────────────────────────────────────────

let savedGlobalAdapter: unknown
let savedChatApiAdapter: unknown

beforeEach(() => {
  savedGlobalAdapter = axios.defaults.adapter
  savedChatApiAdapter = chatApi.defaults.adapter
  vi.clearAllMocks()
  setToken('initial-token')
})

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  axios.defaults.adapter = savedGlobalAdapter as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chatApi.defaults.adapter = savedChatApiAdapter as any
  vi.restoreAllMocks()
})

// ── Extract the error interceptor from chatApi ─────────────────────────────

function getInterceptorHandler(): (err: unknown) => Promise<unknown> {
  const handlers = (chatApi.interceptors.response as unknown as {
    handlers: Array<{ fulfilled?: unknown; rejected?: (e: unknown) => Promise<unknown> } | null>
  }).handlers.filter(Boolean)

  // The last registered handler is the 401-refresh one (authApi adds one too
  // but we're testing chatApi's copy).
  const last = handlers.at(-1)
  if (!last?.rejected) throw new Error('No rejected handler found on chatApi')
  return last.rejected
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('axios 401-refresh interceptor', () => {
  it('sends a refresh request on 401 and retries the original with the new token', async () => {
    const newToken = 'refreshed-token'

    // Shared adapter for BOTH global axios and chatApi.
    const adapter = buildSequentialAdapter([
      // Call 1 → bare axios.post('/api/auth/refresh') succeeds
      { type: 'resolve', data: { accessToken: newToken } },
      // Call 2 → chatApi retry of the original request succeeds
      { type: 'resolve', data: { id: 'msg-1' } },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axios.defaults.adapter = adapter as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatApi.defaults.adapter = adapter as any

    const handler = getInterceptorHandler()
    const result = (await handler(make401('/api/conversations'))) as AxiosResponse

    expect(result.data).toEqual({ id: 'msg-1' })

    const { setAuth } = getStoreState()
    expect(setAuth).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), newToken)
  })

  it('clears auth when the refresh endpoint returns an error', async () => {
    const adapter = buildSequentialAdapter([
      // Call 1 → refresh fails
      { type: 'reject', error: new axios.AxiosError('refresh failed', '500') },
      // Call 2 → clear-cookie call (fire-and-forget, caught internally)
      { type: 'resolve', data: {} },
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axios.defaults.adapter = adapter as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatApi.defaults.adapter = adapter as any

    const handler = getInterceptorHandler()
    await expect(handler(make401('/api/conversations'))).rejects.toThrow()

    const { clearAuth } = getStoreState()
    expect(clearAuth).toHaveBeenCalledTimes(1)
  })

  it('does NOT attempt a refresh for 401 on the /auth/login endpoint', async () => {
    let callCount = 0
    const adapter: SimpleAdapter = () => {
      callCount++
      return Promise.reject(new Error('unexpected call'))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axios.defaults.adapter = adapter as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatApi.defaults.adapter = adapter as any

    const handler = getInterceptorHandler()
    await expect(handler(make401('/auth/login'))).rejects.toThrow()
    expect(callCount).toBe(0)
  })

  it('does NOT attempt a refresh when there is no access token', async () => {
    setToken(null)

    let callCount = 0
    const adapter: SimpleAdapter = () => {
      callCount++
      return Promise.reject(new Error('unexpected call'))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axios.defaults.adapter = adapter as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatApi.defaults.adapter = adapter as any

    const handler = getInterceptorHandler()
    await expect(handler(make401('/api/conversations'))).rejects.toThrow()
    expect(callCount).toBe(0)
  })

  it('does NOT retry a request that already has the _retry flag set', async () => {
    let callCount = 0
    const adapter: SimpleAdapter = () => {
      callCount++
      return Promise.reject(new Error('unexpected call'))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axios.defaults.adapter = adapter as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatApi.defaults.adapter = adapter as any

    const handler = getInterceptorHandler()
    const err = make401('/api/conversations')
    err.config._retry = true

    await expect(handler(err)).rejects.toThrow()
    expect(callCount).toBe(0)
  })

  it('queues a second concurrent 401 and issues only ONE refresh call', async () => {
    const newToken = 'queued-refresh-token'
    let refreshCallCount = 0

    // We need fine-grained control: the refresh call resolves after both 401s
    // have been triggered, so the second one hits the isRefreshing=true branch.
    let resolveRefresh!: (value: AxiosResponse) => void
    const refreshPromise = new Promise<AxiosResponse>((res) => { resolveRefresh = res })

    const adapter: SimpleAdapter = (config) => {
      if (config.url?.includes('/api/auth/refresh')) {
        refreshCallCount++
        return refreshPromise
      }
      // Retry calls from both queued requests succeed immediately.
      return Promise.resolve({
        data: { retried: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axios.defaults.adapter = adapter as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatApi.defaults.adapter = adapter as any

    const handler = getInterceptorHandler()

    // Fire two 401s without awaiting — first sets isRefreshing=true, second
    // enters the failedQueue branch.
    const p1 = handler(make401('/api/conversations'))
    const p2 = handler(make401('/api/messages'))

    // Now resolve the single refresh call.
    resolveRefresh({
      data: { accessToken: newToken },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    } as AxiosResponse)

    const [r1, r2] = await Promise.all([p1, p2]) as [AxiosResponse, AxiosResponse]

    expect(refreshCallCount).toBe(1)
    expect((r1 as AxiosResponse).data).toEqual({ retried: true })
    expect((r2 as AxiosResponse).data).toEqual({ retried: true })
  })
})
