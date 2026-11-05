import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const getMediaTokenApi = vi.fn()
vi.mock('@/lib/api/chat', () => ({ chatService: { getMediaToken: () => getMediaTokenApi() } }))

import { clearMediaToken, ensureMediaToken, useMediaTokenStore } from '@/lib/media-token'
import { useAuthStore } from '@/lib/store/auth.store'
import { useMediaRemountKey, useMediaTokenResume } from '@/lib/hooks/use-media-token-session'

const user = { id: 'u', email: 'a@b.c', displayName: 'A' }
const resp = (token: string, hoursLeft: number) => ({
  token,
  expiresAt: new Date(Date.now() + hoursLeft * 3600_000).toISOString(),
})

beforeEach(() => {
  getMediaTokenApi.mockReset()
  clearMediaToken()
  useAuthStore.getState().setAuth(user, 'jwt')
})
afterEach(() => useAuthStore.getState().clearAuth())

describe('useMediaRemountKey', () => {
  it('late_token_arrival_bumps_key_once_and_refresh_does_not', async () => {
    const { result } = renderHook(() => useMediaRemountKey())
    const first = result.current
    getMediaTokenApi.mockResolvedValueOnce(resp('T1', 0.5))
    await act(() => ensureMediaToken())
    expect(result.current).toBe(first + 1)
    // refresh (stale -> new value): no remount
    getMediaTokenApi.mockResolvedValueOnce(resp('T2', 5))
    await act(() => ensureMediaToken())
    expect(useMediaTokenStore.getState().token).toBe('T2')
    expect(result.current).toBe(first + 1)
  })

  it('paused_key_is_frozen_until_unpaused', async () => {
    const hook = renderHook((p: { paused: boolean }) => useMediaRemountKey(p.paused), {
      initialProps: { paused: true },
    })
    const first = hook.result.current
    getMediaTokenApi.mockResolvedValueOnce(resp('T1', 5))
    await act(() => ensureMediaToken())
    expect(hook.result.current).toBe(first)
    hook.rerender({ paused: false })
    expect(hook.result.current).toBe(first + 1)
  })
})

describe('useMediaTokenResume', () => {
  it('re_ensures_on_focus_while_signed_in_and_stops_after_logout', async () => {
    getMediaTokenApi.mockResolvedValue(resp('T1', 0.5))
    renderHook(() => useMediaTokenResume())
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(getMediaTokenApi).toHaveBeenCalledTimes(1)

    act(() => useAuthStore.getState().clearAuth())
    getMediaTokenApi.mockClear()
    window.dispatchEvent(new Event('focus'))
    expect(getMediaTokenApi).not.toHaveBeenCalled()
  })
})
