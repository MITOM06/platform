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

// ─── request interceptors — inject access token ──────────────────────────────

const injectToken = (config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}

authApi.interceptors.request.use(injectToken)
chatApi.interceptors.request.use(injectToken)
connectorApi.interceptors.request.use(injectToken)

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
      const { data } = await axios.post<{ accessToken: string }>('/api/auth/refresh')
      const { accessToken } = data

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
