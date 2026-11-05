import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const getMediaTokenApi = vi.fn()
vi.mock('@/lib/api/chat', () => ({ chatService: { getMediaToken: () => getMediaTokenApi() } }))

import { ensureMediaToken, getMediaToken, clearMediaToken } from '@/lib/media-token'
import { useAuthStore } from '@/lib/store/auth.store'

const user = { id: 'u', email: 'a@b.c', displayName: 'A' }
const H = 3600_000

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

const resp = (token: string, hoursLeft: number) => ({
  token,
  expiresAt: new Date(Date.now() + hoursLeft * H).toISOString(),
})

describe('media token', () => {
  it('refreshes_when_less_than_1h_left', async () => {
    getMediaTokenApi.mockResolvedValueOnce(resp('T1', 5))
    await ensureMediaToken()
    expect(getMediaToken()).toBe('T1')
    // still > 1h left: no new call
    await ensureMediaToken()
    expect(getMediaTokenApi).toHaveBeenCalledTimes(1)
    // scheduled refresh fires when < 1h remains (after 4h)
    getMediaTokenApi.mockResolvedValueOnce(resp('T2', 6))
    await vi.advanceTimersByTimeAsync(4 * H + 1000)
    expect(getMediaTokenApi).toHaveBeenCalledTimes(2)
    expect(getMediaToken()).toBe('T2')
  })

  it('logout_clears_token', async () => {
    getMediaTokenApi.mockResolvedValueOnce(resp('T1', 5))
    await ensureMediaToken()
    expect(getMediaToken()).toBe('T1')
    useAuthStore.getState().clearAuth()
    expect(getMediaToken()).toBeNull()
  })

  it('keeps_retrying_in_background_after_failure_without_throwing', async () => {
    getMediaTokenApi.mockRejectedValueOnce(new Error('boom'))
    await expect(ensureMediaToken()).resolves.toBeUndefined()
    expect(getMediaToken()).toBeNull()
    getMediaTokenApi.mockResolvedValueOnce(resp('T1', 5))
    await vi.advanceTimersByTimeAsync(16_000)
    expect(getMediaToken()).toBe('T1')
  })
})
