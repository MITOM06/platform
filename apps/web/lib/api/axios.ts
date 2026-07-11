import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/lib/store/auth.store'

export const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL || '/api/auth',
  headers: { 'Content-Type': 'application/json' },
})

export const chatApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_CHAT_URL || '/api/chat',
  headers: { 'Content-Type': 'application/json' },
})

export const connectorApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_CONNECTOR_URL || '/api/connector',
  headers: { 'Content-Type': 'application/json' },
})

// ai-service (port 3002) — admin usage/quality dashboard lives here. The personal
// token-usage page still goes through chatApi; this instance targets ai-service's
// own admin endpoints (e.g. GET /usage/dashboard).
export const aiApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AI_URL || '/api/ai',
  headers: { 'Content-Type': 'application/json' },
})

// ─── request interceptors — inject access token ──────────────────────────────

const injectToken = (config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}

// Read the UI locale from the `locale` cookie (set by the language switcher,
// also consumed by next-intl in i18n/request.ts). Default to English. The
// auth-service uses this header to localize OTP/password-reset emails.
const readLocaleCookie = (): string => {
  if (typeof document === 'undefined') return 'en'
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : 'en'
}

// auth-service only: attach the UI locale so server-sent OTP emails match the
// language the user is browsing in.
const injectLocale = (config: InternalAxiosRequestConfig) => {
  config.headers['Accept-Language'] = readLocaleCookie()
  return config
}

authApi.interceptors.request.use(injectToken)
authApi.interceptors.request.use(injectLocale)
chatApi.interceptors.request.use(injectToken)
connectorApi.interceptors.request.use(injectToken)
aiApi.interceptors.request.use(injectToken)

// A refresh failed for a *real* auth reason only when the server actually
// rejected it (401/403). A network error (no response) — e.g. wifi sleep,
// ERR_NETWORK_CHANGED, ERR_NAME_NOT_RESOLVED on idle resume — is transient and
// must NOT log the user out. Keep the session so the call/reconnect can retry.
export function isAuthFailure(err: unknown): boolean {
  return (
    axios.isAxiosError(err) &&
    (err.response?.status === 401 || err.response?.status === 403)
  )
}

// The backend answered 401 REFRESH_TOKEN_ROTATED: a benign race where another
// concurrent refresh (usually a sibling tab) rotated the token first. The
// winner's Set-Cookie already updated the shared cookie jar, so a single retry
// with the fresh cookie succeeds. NOT a dead session — never log out on this.
function isRotatedRace(err: unknown): boolean {
  return (
    axios.isAxiosError(err) &&
    err.response?.status === 401 &&
    (err.response.data as { code?: string } | undefined)?.code ===
      'REFRESH_TOKEN_ROTATED'
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Serialize refreshes ACROSS TABS with the Web Locks API. Refresh tokens rotate
// with reuse detection, so two tabs refreshing concurrently spend the same
// token twice; the loser 401s (or worse, trips reuse detection). Holding a
// browser-wide lock makes the second tab wait, and its refresh then runs with
// the winner's rotated cookie — a normal rotation. Falls back to no locking
// where the API is unavailable (old browsers, jsdom tests).
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('pon-auth-refresh', fn) as Promise<T>
  }
  return fn()
}

/**
 * Single shared way to refresh the access token via the Next.js cookie proxy.
 * Throws on failure; callers decide logout via isAuthFailure(err). Retries the
 * benign REFRESH_TOKEN_ROTATED race once with the sibling tab's rotated cookie.
 */
export async function refreshAccessToken(): Promise<string> {
  return withRefreshLock(async () => {
    try {
      const { data } = await axios.post<{ accessToken: string }>('/api/auth/refresh')
      return data.accessToken
    } catch (err) {
      if (!isRotatedRace(err)) throw err
      await sleep(300)
      const { data } = await axios.post<{ accessToken: string }>('/api/auth/refresh')
      return data.accessToken
    }
  })
}

// ─── response interceptor — handle 401 / token refresh ────────────────────────

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

const create401ResponseInterceptor = (apiInstance: typeof chatApi) => {
  return async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/refresh') ||
      original.url?.includes('/api/auth/refresh') ||
      // Skip auth endpoints (login/register/verify) — a 401 there is a real
      // credential error, not an expired session. Refreshing would loop.
      original.url?.includes('/auth/login') ||
      original.url?.includes('/auth/register') ||
      original.url?.includes('/auth/verify') ||
      // Public/anonymous call that 401s before any session exists (initial
      // load, logged-out browsing) → don't attempt a refresh that can't succeed.
      !useAuthStore.getState().accessToken
    ) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return apiInstance(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const accessToken = await refreshAccessToken()

      const { user } = useAuthStore.getState()
      if (user) useAuthStore.getState().setAuth(user, accessToken)

      processQueue(null, accessToken)
      original.headers.Authorization = `Bearer ${accessToken}`
      return apiInstance(original)
    } catch (err) {
      processQueue(err, null)
      // Only force logout when the refresh was genuinely rejected. On a transient
      // network error keep the session — the original request will fail this time
      // but the user stays logged in and can retry once the network recovers.
      if (isAuthFailure(err)) {
        useAuthStore.getState().clearAuth()
        if (typeof window !== 'undefined') {
          await axios.post('/api/auth/clear-cookie').catch(() => {})
          window.location.href = '/login'
        }
      }
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
}

chatApi.interceptors.response.use((res) => res, create401ResponseInterceptor(chatApi))
authApi.interceptors.response.use((res) => res, create401ResponseInterceptor(authApi))
connectorApi.interceptors.response.use((res) => res, create401ResponseInterceptor(connectorApi))
aiApi.interceptors.response.use((res) => res, create401ResponseInterceptor(aiApi))
