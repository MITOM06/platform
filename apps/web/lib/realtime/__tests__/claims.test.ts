/**
 * F1 — CLAIMS_CHANGED: refresh the token, refetch capability-scoped queries and
 * reconnect STOMP. Never a logout unless the refresh itself is rejected.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

const refresh = vi.fn<() => Promise<string>>()
const authFailure = vi.fn<(err: unknown) => boolean>()
const reconnect = vi.fn()
const forceLogout = vi.fn()

vi.mock('@/lib/api/axios', () => ({
  refreshAccessToken: () => refresh(),
  isAuthFailure: (err: unknown) => authFailure(err),
}))
vi.mock('@/lib/stomp/client', () => ({ stompService: { reconnect: () => reconnect() } }))
vi.mock('@/lib/auth/force-logout', () => ({ forceLogout: (err: unknown) => forceLogout(err) }))

import { isClaimScopedQuery, refreshClaims } from '@/lib/realtime/claims'
import { useAuthStore } from '@/lib/store/auth.store'

describe('refreshClaims', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', displayName: 'A' }, accessToken: 'old' })
  })

  it('refreshes, invalidates capability queries and reconnects the socket', async () => {
    refresh.mockResolvedValue('fresh')
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')

    await refreshClaims(qc)

    expect(useAuthStore.getState().accessToken).toBe('fresh')
    expect(invalidate).toHaveBeenCalledWith({ predicate: isClaimScopedQuery })
    expect(reconnect).toHaveBeenCalledTimes(1)
    expect(forceLogout).not.toHaveBeenCalled()
  })

  it('shares one refresh between duplicate events', async () => {
    refresh.mockResolvedValue('fresh')
    const qc = new QueryClient()
    await Promise.all([refreshClaims(qc), refreshClaims(qc)])
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps the session on a transient failure; logs out only on a rejected refresh', async () => {
    const qc = new QueryClient()
    refresh.mockRejectedValueOnce(new Error('offline'))
    authFailure.mockReturnValueOnce(false)
    await refreshClaims(qc)
    expect(forceLogout).not.toHaveBeenCalled()
    expect(reconnect).not.toHaveBeenCalled()

    const rejected = new Error('401')
    refresh.mockRejectedValueOnce(rejected)
    authFailure.mockReturnValueOnce(true)
    await refreshClaims(qc)
    expect(forceLogout).toHaveBeenCalledWith(rejected)
  })

  it('scopes invalidation to capability-dependent queries', () => {
    expect(isClaimScopedQuery({ queryKey: ['me-capabilities', 'u1'] })).toBe(true)
    expect(isClaimScopedQuery({ queryKey: ['admin-members'] })).toBe(true)
    expect(isClaimScopedQuery({ queryKey: ['connections', 'u1'] })).toBe(true)
    expect(isClaimScopedQuery({ queryKey: ['messages', 'c1'] })).toBe(false)
    expect(isClaimScopedQuery({ queryKey: ['conversations'] })).toBe(false)
  })
})
