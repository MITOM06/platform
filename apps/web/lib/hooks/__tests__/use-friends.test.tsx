import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { makeQueryWrapper } from '@/test/query-wrapper'

const h = vi.hoisted(() => ({
  svc: { listFriends: vi.fn(), listRequests: vi.fn(), sendRequest: vi.fn(), acceptRequest: vi.fn(), removeFriend: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@/lib/api/friends', () => ({ friendsService: h.svc }))

import { friendErrorKey, useFriends, useFriendRequests, useFriendActions } from '@/lib/hooks/use-friends'

const httpErr = (status: number, code?: string) => {
  const e = new AxiosError('x')
  e.response = { status, data: code ? { code } : {} } as AxiosResponse
  return e
}

beforeEach(() => {
  for (const f of Object.values(h.svc)) f.mockReset().mockResolvedValue({ success: true })
  h.toast.success.mockReset(); h.toast.error.mockReset()
})

describe('friendErrorKey', () => {
  it('maps blocked / rate-limit / network / fallback', () => {
    expect(friendErrorKey(httpErr(403, 'USER_BLOCKED'), 'fb')).toBe('errUserBlocked')
    expect(friendErrorKey(httpErr(429), 'fb')).toBe('errRateLimited')
    expect(friendErrorKey(new AxiosError('offline'), 'fb')).toBe('errNetwork')
    expect(friendErrorKey(httpErr(500), 'fb')).toBe('fb')
    expect(friendErrorKey(new Error('x'), 'fb')).toBe('fb')
  })
})

describe('friend queries', () => {
  it('load friends and requests', async () => {
    h.svc.listFriends.mockResolvedValue([{ id: 'a' }])
    h.svc.listRequests.mockResolvedValue([{ id: 'b' }])
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => ({ f: useFriends(), r: useFriendRequests() }), { wrapper })
    await waitFor(() => expect(result.current.f.data).toEqual([{ id: 'a' }]))
    await waitFor(() => expect(result.current.r.data).toEqual([{ id: 'b' }]))
  })
})

describe('useFriendActions', () => {
  const cases = [
    ['sendRequest', 'sendRequest', 'sendRequestSuccess', 'sendRequestError'],
    ['acceptRequest', 'acceptRequest', 'acceptRequestSuccess', 'acceptRequestError'],
    ['removeFriend', 'removeFriend', 'removeFriendSuccess', 'removeFriendError'],
  ] as const

  it.each(cases)('%s success toasts and invalidates friends, requests, relationships', async (m, svc, ok) => {
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useFriendActions(), { wrapper })
    await act(async () => { await result.current[m].mutateAsync('u1') })
    expect(h.svc[svc]).toHaveBeenCalledWith('u1')
    expect(h.toast.success).toHaveBeenCalledWith(ok)
    expect(inv.mock.calls.map((c) => c[0])).toEqual([
      { queryKey: ['friends'] }, { queryKey: ['friend-requests'] }, { queryKey: ['relationship'] },
    ])
  })

  it.each(cases)('%s failure shows the mapped key', async (m, svc, _ok, fail) => {
    h.svc[svc].mockRejectedValueOnce(httpErr(500)).mockRejectedValueOnce(httpErr(403, 'USER_BLOCKED'))
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useFriendActions(), { wrapper })
    await act(async () => { await result.current[m].mutateAsync('u1').catch(() => {}) })
    expect(h.toast.error).toHaveBeenLastCalledWith(fail)
    await act(async () => { await result.current[m].mutateAsync('u1').catch(() => {}) })
    expect(h.toast.error).toHaveBeenLastCalledWith('errUserBlocked')
    expect(h.toast.success).not.toHaveBeenCalled()
  })
})
