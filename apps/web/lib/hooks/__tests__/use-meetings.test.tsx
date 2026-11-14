import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { makeQueryWrapper } from '@/test/query-wrapper'

const h = vi.hoisted(() => ({
  api: {
    list: vi.fn(), get: vi.fn(), byCode: vi.fn(), hands: vi.fn(), lobby: vi.fn(), messages: vi.fn(),
    getNote: vi.fn(), create: vi.fn(), update: vi.fn(), cancel: vi.fn(), end: vi.fn(),
  },
  getMyDepartments: vi.fn(),
  canManage: false,
  allDepts: [] as { _id: string; name?: string }[],
  ended: vi.fn(),
}))
vi.mock('@/lib/api/meetings', () => ({ meetingsApi: h.api }))
vi.mock('@/lib/api/auth', () => ({ authService: { getMyDepartments: h.getMyDepartments } }))
vi.mock('@/lib/hooks/use-capabilities', () => ({ useHasCapability: () => h.canManage }))
vi.mock('@/lib/hooks/use-admin', () => ({ useDepartments: (enabled: boolean) => ({ data: enabled ? h.allDepts : undefined }) }))
vi.mock('@/lib/meetings/room-events', () => ({ applyMeetingEnded: h.ended }))

import {
  useMeetingList, useMeeting, useMeetingByCode, useMeetingRoster, useMeetingHands, useMeetingLobby,
  useMeetingMessages, useMeetingNote, useMyDepartments, useMeetingDepartmentOptions,
  useCreateMeeting, useUpdateMeeting, useCancelMeeting, useEndMeeting,
} from '@/lib/hooks/use-meetings'
import { meetingKeys } from '@/lib/meetings/cache-updates'
import type { Meeting } from '@/lib/api/meeting-types'

const meeting = (over: Partial<Meeting> = {}) => ({
  id: 'm1', code: 'abc-defg-hjk', status: 'SCHEDULED', title: 'T',
  host: { userId: 'host' }, coHosts: [], attendance: [], scheduledStart: '2026-11-20T10:00:00Z',
  ...over,
}) as unknown as Meeting

const httpErr = (status: number) => {
  const e = new AxiosError('x')
  e.response = { status, data: {} } as AxiosResponse
  return e
}

beforeEach(() => {
  for (const f of [...Object.values(h.api), h.getMyDepartments, h.ended]) f.mockReset()
  h.canManage = false
  h.allDepts = []
})

describe('meeting queries', () => {
  it('useMeetingList pages with the last row id as cursor', async () => {
    h.api.list
      .mockResolvedValueOnce({ content: [{ id: 'a' }, { id: 'b' }], hasNext: true })
      .mockResolvedValueOnce({ content: [{ id: 'c' }], hasNext: false })
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useMeetingList('upcoming'), { wrapper })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    expect(h.api.list).toHaveBeenCalledWith('upcoming', undefined)
    await act(async () => { await result.current.fetchNextPage() })
    expect(h.api.list).toHaveBeenLastCalledWith('upcoming', 'b')
    await waitFor(() => expect(result.current.hasNextPage).toBe(false))
  })

  it('retry policy: never retries 4xx, retries other errors at most twice', async () => {
    h.api.get.mockRejectedValue(httpErr(404))
    const { qc, wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useMeeting('m1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(h.api.get).toHaveBeenCalledTimes(1)
    const retry = qc.getQueryCache().find({ queryKey: meetingKeys.detail('m1') })!.options.retry as (n: number, e: unknown) => boolean
    expect(retry(0, httpErr(403))).toBe(false)
    expect(retry(0, httpErr(500))).toBe(true)
    expect(retry(1, new AxiosError('net'))).toBe(true)
    expect(retry(2, httpErr(503))).toBe(false)
  })

  it('id / code / enabled gates', async () => {
    h.api.byCode.mockResolvedValue(meeting())
    h.api.hands.mockResolvedValue([{ userId: 'u' }])
    h.api.lobby.mockResolvedValue([])
    h.api.getNote.mockResolvedValue({ content: 'n' })
    const { wrapper } = makeQueryWrapper()
    renderHook(() => { useMeeting(undefined); useMeetingByCode(null); useMeetingHands('m1', false); useMeetingLobby('m1', false); useMeetingNote('m1', 'private' as never, false) }, { wrapper })
    expect(h.api.get).not.toHaveBeenCalled()
    expect(h.api.byCode).not.toHaveBeenCalled()
    expect(h.api.hands).not.toHaveBeenCalled()
    const { result } = renderHook(() => ({
      c: useMeetingByCode('abc-defg-hjk'), hd: useMeetingHands('m1', true), l: useMeetingLobby('m1', true),
      n: useMeetingNote('m1', 'shared' as never, true),
    }), { wrapper })
    await waitFor(() => expect(result.current.n.data).toEqual({ content: 'n' }))
    expect(result.current.hd.data).toEqual([{ userId: 'u' }])
    expect(h.api.byCode).toHaveBeenCalledWith('abc-defg-hjk')
    expect(h.api.lobby).toHaveBeenCalledWith('m1')
    expect(h.api.getNote).toHaveBeenCalledWith('m1', 'shared')
  })

  it('useMeetingRoster seeds the detail cache and derives the roster', async () => {
    const m = meeting({ attendance: [{ userId: 'host', joinedAt: '2026-11-20T10:00:00Z' }] } as never)
    h.api.get.mockResolvedValue(m)
    const { qc, wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useMeetingRoster('m1', true), { wrapper })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data![0]).toMatchObject({ userId: 'host', role: 'host' })
    expect(qc.getQueryData(meetingKeys.detail('m1'))).toBe(m)
  })

  it('useMeetingMessages pages backwards', async () => {
    h.api.messages
      .mockResolvedValueOnce({ content: [{ id: 'x2' }, { id: 'x1' }], hasNext: true })
      .mockResolvedValueOnce({ content: [], hasNext: false })
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useMeetingMessages('m1', true), { wrapper })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(async () => { await result.current.fetchNextPage() })
    expect(h.api.messages).toHaveBeenLastCalledWith('m1', 'x1')
  })

  it('useMyDepartments respects enabled', async () => {
    h.getMyDepartments.mockResolvedValue([{ id: 'd', name: 'D' }])
    const { wrapper } = makeQueryWrapper()
    renderHook(() => useMyDepartments(false), { wrapper })
    expect(h.getMyDepartments).not.toHaveBeenCalled()
    const { result } = renderHook(() => useMyDepartments(), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'd', name: 'D' }]))
  })
})

describe('useMeetingDepartmentOptions', () => {
  it('members see only their own departments, sorted', async () => {
    h.getMyDepartments.mockResolvedValue([{ id: '2', name: 'Zeta' }, { id: '1', name: 'Alpha' }])
    h.allDepts = [{ _id: '3', name: 'Ops' }]
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useMeetingDepartmentOptions(), { wrapper })
    await waitFor(() => expect(result.current).toEqual([{ id: '1', name: 'Alpha' }, { id: '2', name: 'Zeta' }]))
  })

  it('MANAGE_DEPARTMENTS merges every named department without duplicates', async () => {
    h.canManage = true
    h.getMyDepartments.mockResolvedValue([{ id: '1', name: 'Alpha' }])
    h.allDepts = [{ _id: '1', name: 'Alpha' }, { _id: '3', name: 'Beta' }, { _id: '4' }]
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useMeetingDepartmentOptions(), { wrapper })
    await waitFor(() => expect(result.current).toEqual([{ id: '1', name: 'Alpha' }, { id: '3', name: 'Beta' }]))
  })
})

describe('meeting mutations', () => {
  const listOf = (...rows: Meeting[]) => ({ pages: [{ content: rows, hasNext: false }], pageParams: [undefined] })

  it('create stores detail, by-code and inserts into upcoming', async () => {
    const m = meeting()
    h.api.create.mockResolvedValue(m)
    const { qc, wrapper } = makeQueryWrapper()
    qc.setQueryData(meetingKeys.list('upcoming'), listOf())
    const { result } = renderHook(() => useCreateMeeting(), { wrapper })
    await act(async () => { await result.current.mutateAsync(undefined as never) })
    expect(h.api.create).toHaveBeenCalledWith({})
    expect(qc.getQueryData(meetingKeys.detail('m1'))).toBe(m)
    expect(qc.getQueryData(meetingKeys.byCode('abc-defg-hjk'))).toBe(m)
    expect((qc.getQueryData(meetingKeys.list('upcoming')) as ReturnType<typeof listOf>).pages[0].content).toEqual([m])
  })

  it('update of an ENDED meeting skips upcoming and replaces it in past', async () => {
    const old = meeting({ title: 'old', status: 'ENDED' } as never)
    const next = meeting({ title: 'new', status: 'ENDED' } as never)
    h.api.update.mockResolvedValue(next)
    const { qc, wrapper } = makeQueryWrapper()
    qc.setQueryData(meetingKeys.list('upcoming'), listOf())
    qc.setQueryData(meetingKeys.list('past'), listOf(old))
    const { result } = renderHook(() => useUpdateMeeting('m1'), { wrapper })
    await act(async () => { await result.current.mutateAsync({ title: 'new' } as never) })
    expect(h.api.update).toHaveBeenCalledWith('m1', { title: 'new' })
    expect((qc.getQueryData(meetingKeys.list('upcoming')) as ReturnType<typeof listOf>).pages[0].content).toEqual([])
    expect((qc.getQueryData(meetingKeys.list('past')) as ReturnType<typeof listOf>).pages[0].content).toEqual([next])
  })

  it('cancel / end apply the ended state (cancelled flag differs)', async () => {
    h.api.cancel.mockResolvedValue(undefined)
    h.api.end.mockResolvedValue(undefined)
    const { qc, wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => ({ c: useCancelMeeting({ id: 'm1' }), e: useEndMeeting({ id: 'm2' }) }), { wrapper })
    await act(async () => { await result.current.c.mutateAsync() })
    await act(async () => { await result.current.e.mutateAsync() })
    expect(h.ended).toHaveBeenNthCalledWith(1, qc, 'm1', expect.any(String), true)
    expect(h.ended).toHaveBeenNthCalledWith(2, qc, 'm2', expect.any(String), false)
  })

  it('a failed end does not apply anything', async () => {
    h.api.end.mockRejectedValue(httpErr(403))
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useEndMeeting({ id: 'm1' }), { wrapper })
    await act(async () => { await result.current.mutateAsync().catch(() => {}) })
    expect(h.ended).not.toHaveBeenCalled()
  })
})
