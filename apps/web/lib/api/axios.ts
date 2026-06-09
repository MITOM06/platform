import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/lib/store/auth.store'

export const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
  headers: { 'Content-Type': 'application/json' },
})

export const chatApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_CHAT_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ─── helpers ──────────────────────────────────────────────────────────────────

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? null
  return null
}

const setCookie = (name: string, value: string, maxAge = 900) => {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`
}

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; max-age=0`
}

// ─── request interceptor — inject access token ────────────────────────────────

chatApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

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

chatApi.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return chatApi(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const sid = getCookie('sid')
      const refreshToken = getCookie('refreshToken')
      if (!sid || !refreshToken) throw new Error('no_refresh')

      const { data } = await authApi.post<{ accessToken: string }>('/auth/refresh', {
        sid,
        refreshToken,
      })

      const { accessToken } = data
      const { user } = useAuthStore.getState()
      if (user) useAuthStore.getState().setAuth(user, accessToken)
      setCookie('accessToken', accessToken)

      processQueue(null, accessToken)
      original.headers.Authorization = `Bearer ${accessToken}`
      return chatApi(original)
    } catch (err) {
      processQueue(err, null)
      useAuthStore.getState().clearAuth()
      deleteCookie('accessToken')
      deleteCookie('refreshToken')
      deleteCookie('sid')
      if (typeof window !== 'undefined') window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  },
)
