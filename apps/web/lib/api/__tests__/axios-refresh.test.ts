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

  it('clears auth when the refresh token is genuinely rejected (401)', async () => {
    const refreshRejected = new axios.AxiosError(
      'refresh rejected',
      'ERR_BAD_REQUEST',
      undefined,
      null,
      { status: 401, statusText: 'Unauthorized', headers: {}, config: {}, data: {} } as AxiosResponse,
    )
    const adapter = buildSequentialAdapter([
      // Call 1 → refresh rejected with a 401 (refresh token invalid)
      { type: 'reject', error: refreshRejected },
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

  it('retries the refresh once on the benign REFRESH_TOKEN_ROTATED race and does NOT log out', async () => {
    // A sibling tab rotated the refresh token first: the proxy answers 401 with
    // code REFRESH_TOKEN_ROTATED. The retry runs with the sibling's rotated
    // cookie and succeeds — the user must stay logged in.
    const rotatedRace = new axios.AxiosError(
      'race lost',
      'ERR_BAD_REQUEST',
      undefined,
      null,
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: {},
        data: { code: 'REFRESH_TOKEN_ROTATED' },
      } as AxiosResponse,
    )
    const adapter = buildSequentialAdapter([
      // Call 1 → refresh loses the rotation race
      { type: 'reject', error: rotatedRace },
      // Call 2 → the single retry succeeds with the rotated cookie
      { type: 'resolve', data: { accessToken: 'race-winner-token' } },
      // Call 3 → chatApi retry of the original request succeeds
      { type: 'resolve', data: { id: 'msg-2' } },
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axios.defaults.adapter = adapter as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatApi.defaults.adapter = adapter as any

    const handler = getInterceptorHandler()
    const result = (await handler(make401('/api/conversations'))) as AxiosResponse

    expect(result.data).toEqual({ id: 'msg-2' })
    const { clearAuth, setAuth } = getStoreState()
    expect(clearAuth).not.toHaveBeenCalled()
    expect(setAuth).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'race-winner-token')
  })

  it('does NOT clear auth when the refresh proxy answers 503 (transient upstream failure)', async () => {
    // The Next.js refresh route now maps upstream network/5xx errors to 503 so
    // they are never mistaken for a dead session.
    const transient = new axios.AxiosError(
      'transient',
      'ERR_BAD_RESPONSE',
      undefined,
      null,
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {},
        config: {},
        data: { error: 'transient' },
      } as AxiosResponse,
    )
    const adapter = buildSequentialAdapter([{ type: 'reject', error: transient }])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axios.defaults.adapter = adapter as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatApi.defaults.adapter = adapter as any

    const handler = getInterceptorHandler()
    await expect(handler(make401('/api/conversations'))).rejects.toThrow()

    const { clearAuth } = getStoreState()
    expect(clearAuth).not.toHaveBeenCalled()
  })

  it('does NOT clear auth on a transient network error during refresh', async () => {
    // No `response` → network error (wifi sleep / ERR_NETWORK_CHANGED). The
    // user must stay logged in so STOMP / the next request can retry.
    const networkError = new axios.AxiosError('Network Error', 'ERR_NETWORK')
    const adapter = buildSequentialAdapter([
      { type: 'reject', error: networkError },
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axios.defaults.adapter = adapter as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatApi.defaults.adapter = adapter as any

    const handler = getInterceptorHandler()
    await expect(handler(make401('/api/conversations'))).rejects.toThrow()

    const { clearAuth } = getStoreState()
    expect(clearAuth).not.toHaveBeenCalled()
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

  it('does NOT refresh on a typed 2FA verdict (wrong code while signed in)', async () => {
    let callCount = 0
    const adapter: SimpleAdapter = () => {
      callCount++
      return Promise.reject(new Error('unexpected call'))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    axios.defaults.adapter = adapter as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatApi.defaults.adapter = adapter as any

    const err = make401('/api/users/me/mfa/backup-codes')
    err.response!.data = { code: 'MFA_CODE_INVALID', params: { remaining: 3 } }
    const handler = getInterceptorHandler()
    await expect(handler(err)).rejects.toBe(err)
    expect(callCount).toBe(0)
    expect(getStoreState().clearAuth).not.toHaveBeenCalled()
  })

  it('does NOT attempt a refresh for 401 on the public 2FA endpoints', async () => {
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
    await expect(handler(make401('/auth/mfa/verify'))).rejects.toThrow()
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

  // ── Forced logout (instant block / revoked session) ──────────────────────

  describe('forced logout', () => {
    const realLocation = window.location
    let nav: { href: string }

    beforeEach(() => {
      nav = { href: '' }
      Object.defineProperty(window, 'location', { configurable: true, value: nav })
    })
    afterEach(() => {
      Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
    })

    function httpError(status: number, data: unknown, url = '/api/conversations') {
      const config = { url, headers: new axios.AxiosHeaders(), method: 'get' } as InternalAxiosRequestConfig
      return new axios.AxiosError('failed', 'ERR_BAD_REQUEST', config, null, {
        status,
        statusText: '',
        headers: {},
        config,
        data,
      } as AxiosResponse)
    }

    it('refreshes on a chat-service 401 SESSION_REVOKED and logs out once the refresh is rejected', async () => {
      const refreshRejected = httpError(401, { error: 'refresh_rejected', code: 'SESSION_REVOKED' }, '/api/auth/refresh')
      let refreshCalls = 0
      const adapter: SimpleAdapter = (config) => {
        if (config.url?.includes('/api/auth/refresh')) {
          refreshCalls++
          return Promise.reject(refreshRejected)
        }
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      axios.defaults.adapter = adapter as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chatApi.defaults.adapter = adapter as any

      const handler = getInterceptorHandler()
      const err = httpError(401, { code: 'SESSION_REVOKED' }) as AxiosError
      await expect(handler(err)).rejects.toBe(refreshRejected)

      expect(refreshCalls).toBe(1)
      expect(getStoreState().clearAuth).toHaveBeenCalledTimes(1)
      // Plain revocation → plain login screen, no reason, no raw server text.
      expect(nav.href).toBe('/login')
    })

    it('sends a blocked user to /login?reason=ACCOUNT_BLOCKED when the refresh says ACCOUNT_BLOCKED', async () => {
      // The Next.js refresh proxy maps the upstream 403 to 401 and forwards the code.
      const blocked = httpError(401, { error: 'refresh_rejected', code: 'ACCOUNT_BLOCKED' }, '/api/auth/refresh')
      const adapter = buildSequentialAdapter([
        { type: 'reject', error: blocked },
        { type: 'resolve', data: {} }, // clear-cookie
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      axios.defaults.adapter = adapter as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chatApi.defaults.adapter = adapter as any

      const handler = getInterceptorHandler()
      await expect(handler(make401('/api/conversations'))).rejects.toBe(blocked)

      expect(getStoreState().clearAuth).toHaveBeenCalledTimes(1)
      expect(nav.href).toBe('/login?reason=ACCOUNT_BLOCKED')
    })

    it('logs out immediately (no refresh) when any request answers 403 ACCOUNT_BLOCKED', async () => {
      const urls: string[] = []
      const adapter: SimpleAdapter = (config) => {
        urls.push(config.url ?? '')
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      axios.defaults.adapter = adapter as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chatApi.defaults.adapter = adapter as any

      const handler = getInterceptorHandler()
      await expect(handler(httpError(403, { code: 'ACCOUNT_BLOCKED' }))).rejects.toThrow()

      expect(urls).toEqual(['/api/auth/clear-cookie'])
      expect(getStoreState().clearAuth).toHaveBeenCalledTimes(1)
      expect(nav.href).toBe('/login?reason=ACCOUNT_BLOCKED')
    })

    it('treats 503 SESSION_CHECK_UNAVAILABLE as transient: no refresh, no logout', async () => {
      let calls = 0
      const adapter: SimpleAdapter = () => {
        calls++
        return Promise.reject(new Error('unexpected call'))
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      axios.defaults.adapter = adapter as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chatApi.defaults.adapter = adapter as any

      const handler = getInterceptorHandler()
      await expect(handler(httpError(503, { code: 'SESSION_CHECK_UNAVAILABLE' }))).rejects.toThrow()
      expect(calls).toBe(0)
      expect(getStoreState().clearAuth).not.toHaveBeenCalled()
      expect(nav.href).toBe('')
    })

    it('treats 401 TOKEN_CLAIMS_STALE like an expired token: silent refresh + retry, never logout', async () => {
      // F1: an admin changed my role. The old token is rejected with
      // TOKEN_CLAIMS_STALE; the refresh mints one with the fresh claims.
      const urls: string[] = []
      const adapter: SimpleAdapter = (config) => {
        urls.push(config.url ?? '')
        if (config.url?.includes('/api/auth/refresh')) {
          return Promise.resolve({ data: { accessToken: 'fresh-claims' }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse)
        }
        return Promise.resolve({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      axios.defaults.adapter = adapter as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chatApi.defaults.adapter = adapter as any

      const handler = getInterceptorHandler()
      const res = (await handler(httpError(401, { code: 'TOKEN_CLAIMS_STALE' }))) as AxiosResponse

      expect(res.data).toEqual({ ok: true })
      expect(urls).toEqual(['/api/auth/refresh', '/api/conversations'])
      expect(getStoreState().setAuth).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'fresh-claims')
      expect(getStoreState().clearAuth).not.toHaveBeenCalled()
      expect(nav.href).toBe('')
    })

    it('sends an SSO-enforced user to /login?reason=SSO_REQUIRED when the refresh says so', async () => {
      // Session revoked because the workspace now requires SSO (contract 13 C):
      // the refresh proxy forwards SSO_REQUIRED (also mapped from `sso_enforced`).
      const ssoRequired = httpError(401, { error: 'refresh_rejected', code: 'SSO_REQUIRED' }, '/api/auth/refresh')
      const adapter = buildSequentialAdapter([
        { type: 'reject', error: ssoRequired },
        { type: 'resolve', data: {} }, // clear-cookie
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      axios.defaults.adapter = adapter as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chatApi.defaults.adapter = adapter as any

      const handler = getInterceptorHandler()
      await expect(handler(make401('/api/conversations'))).rejects.toBe(ssoRequired)

      expect(getStoreState().clearAuth).toHaveBeenCalledTimes(1)
      expect(nav.href).toBe('/login?reason=SSO_REQUIRED')
    })

    it('maps a refresh rejected for the sso_enforced revocation reason to the same notice', async () => {
      const revoked = httpError(
        401,
        { error: 'refresh_rejected', code: 'SESSION_REVOKED', params: { reason: 'sso_enforced' } },
        '/api/auth/refresh',
      )
      const adapter = buildSequentialAdapter([
        { type: 'reject', error: revoked },
        { type: 'resolve', data: {} }, // clear-cookie
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      axios.defaults.adapter = adapter as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chatApi.defaults.adapter = adapter as any

      const handler = getInterceptorHandler()
      await expect(handler(make401('/api/conversations'))).rejects.toBe(revoked)
      expect(nav.href).toBe('/login?reason=SSO_REQUIRED')
    })

    it('does not log out on a 403 SSO_REQUIRED from a signed-in call (e.g. change-password over SSO)', async () => {
      const handler = getInterceptorHandler()
      await expect(handler(httpError(403, { code: 'SSO_REQUIRED' }))).rejects.toThrow()
      expect(getStoreState().clearAuth).not.toHaveBeenCalled()
      expect(nav.href).toBe('')
    })

    it('ignores a 403 that is not ACCOUNT_BLOCKED (plain permission error)', async () => {
      const handler = getInterceptorHandler()
      await expect(handler(httpError(403, { code: 'INSUFFICIENT_PERMISSION' }))).rejects.toThrow()
      expect(getStoreState().clearAuth).not.toHaveBeenCalled()
      expect(nav.href).toBe('')
    })
  })
})
