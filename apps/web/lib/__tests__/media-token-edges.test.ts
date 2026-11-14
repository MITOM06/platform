import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const getMediaTokenApi = vi.fn()
vi.mock('@/lib/api/chat', () => ({ chatService: { getMediaToken: () => getMediaTokenApi() } }))

import { ensureMediaToken, ensureMediaTokenBounded, clearMediaToken, useMediaTokenStore } from '@/lib/media-token'
import { useAuthStore } from '@/lib/store/auth.store'

const user = { id: 'u', email: 'a@b.c', displayName: 'A' }
const H = 3600_000
const resp = (token: string, hoursLeft: number) => ({ token, expiresAt: new Date(Date.now() + hoursLeft * H).toISOString() })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  getMediaTokenApi.mockReset()
  clearMediaToken()
  useAuthStore.getState().setAuth(user, 'jwt')
})
afterEach(() => {
  useAuthStore.getState().clearAuth()
  vi.useRealTimers()
})

describe('media token edges', () => {
  it('signed out → no request', async () => {
    useAuthStore.getState().clearAuth()
    await ensureMediaToken()
    expect(getMediaTokenApi).not.toHaveBeenCalled()
  })

  it('concurrent callers share one request', async () => {
    getMediaTokenApi.mockResolvedValueOnce(resp('T1', 5))
    const a = ensureMediaToken()
    const b = ensureMediaToken()
    expect(b).toBe(a)
    await a
    expect(getMediaTokenApi).toHaveBeenCalledTimes(1)
    expect(useMediaTokenStore.getState().token).toBe('T1')
  })

  it('a malformed response is ignored and retried later', async () => {
    getMediaTokenApi.mockResolvedValueOnce({ token: '', expiresAt: 'x' }).mockResolvedValueOnce(resp('T2', 5))
    await ensureMediaToken()
    expect(useMediaTokenStore.getState().token).toBeNull()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(getMediaTokenApi).toHaveBeenCalledTimes(2)
    expect(useMediaTokenStore.getState().token).toBe('T2')
  })

  it('a response landing after sign-out is dropped and not retried', async () => {
    let resolve!: (v: unknown) => void
    getMediaTokenApi.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const p = ensureMediaToken()
    useAuthStore.getState().clearAuth()
    clearMediaToken()
    resolve(resp('LATE', 5))
    await p
    expect(useMediaTokenStore.getState().token).toBeNull()
    let reject!: (e: unknown) => void
    useAuthStore.getState().setAuth(user, 'jwt')
    getMediaTokenApi.mockReturnValueOnce(new Promise((_r, rj) => { reject = rj }))
    const p2 = ensureMediaToken()
    useAuthStore.getState().clearAuth()
    reject(new Error('401'))
    await p2
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(getMediaTokenApi).toHaveBeenCalledTimes(2)
  })

  it('ensureMediaTokenBounded gives up waiting after the limit', async () => {
    getMediaTokenApi.mockReturnValueOnce(new Promise(() => {}))
    let done = false
    void ensureMediaTokenBounded(500).then(() => { done = true })
    await vi.advanceTimersByTimeAsync(499)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
  })
})
