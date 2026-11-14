import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { makeQueryWrapper } from '@/test/query-wrapper'
import type { MeetingRoomController } from '@/lib/meetings/meeting-room-controller'

const h = vi.hoisted(() => ({ summary: vi.fn(), regenerate: vi.fn(), caps: vi.fn() }))
vi.mock('@/lib/api/meetings', () => ({ meetingsApi: { summary: h.summary, regenerateSummary: h.regenerate } }))
vi.mock('@/lib/api/admin', () => ({ adminService: { getCapabilities: h.caps } }))

import { useMeetingShortcuts } from '@/lib/hooks/use-meeting-shortcuts'
import { useMeetingSummary, useRegenerateSummary } from '@/lib/hooks/use-meeting-summary'
import { useCanAccessAdmin, useHasCapability } from '@/lib/hooks/use-capabilities'
import { meetingKeys } from '@/lib/meetings/cache-updates'
import { FAQ_CATEGORIES } from '@/lib/help/faq-data'
import { buildProfileFormTexts } from '@/components/profile/profile-form-texts'
import { useAuthStore } from '@/lib/store/auth.store'

const httpErr = (status: number, code?: string) => {
  const e = new AxiosError('x')
  e.response = { status, data: code ? { code } : {} } as AxiosResponse
  return e
}

beforeEach(() => {
  h.summary.mockReset(); h.regenerate.mockReset(); h.caps.mockReset()
  Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' })
})

describe('useMeetingShortcuts', () => {
  it('Ctrl+D / Ctrl+E / Ctrl+Alt+H drive the controller; other keys do nothing', () => {
    const controller = { toggleMic: vi.fn(), toggleCamera: vi.fn(), setHand: vi.fn() }
    const { rerender, unmount } = renderHook((p: { raised: boolean }) =>
      useMeetingShortcuts(controller as unknown as MeetingRoomController, p.raised), { initialProps: { raised: false } })
    const key = (code: string, alt = false) => {
      const e = new KeyboardEvent('keydown', { code, ctrlKey: true, altKey: alt, cancelable: true })
      window.dispatchEvent(e)
      return e
    }
    expect(key('KeyD').defaultPrevented).toBe(true)
    expect(controller.toggleMic).toHaveBeenCalledTimes(1)
    key('KeyE')
    expect(controller.toggleCamera).toHaveBeenCalledTimes(1)
    key('KeyH', true)
    expect(controller.setHand).toHaveBeenLastCalledWith(true)
    rerender({ raised: true })
    key('KeyH', true)
    expect(controller.setHand).toHaveBeenLastCalledWith(false)
    expect(key('KeyQ').defaultPrevented).toBe(false)
    unmount()
    key('KeyD')
    expect(controller.toggleMic).toHaveBeenCalledTimes(1)
  })
})

describe('useMeetingSummary', () => {
  it('loads; never retries a 4xx', async () => {
    h.summary.mockResolvedValueOnce({ state: 'DONE' })
    const { wrapper, qc } = makeQueryWrapper()
    const { result } = renderHook(() => useMeetingSummary('m1', true), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual({ state: 'DONE' }))
    const retry = qc.getQueryCache().find({ queryKey: meetingKeys.summary('m1') })!.options.retry as (n: number, e: unknown) => boolean
    expect(retry(0, httpErr(404))).toBe(false)
    expect(retry(0, httpErr(500))).toBe(true)
    expect(retry(2, httpErr(500))).toBe(false)
  })

  it('regenerate marks PENDING; a PENDING conflict re-reads the summary', async () => {
    h.regenerate.mockResolvedValueOnce({ state: 'PENDING' })
    const { wrapper, qc } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRegenerateSummary('m1'), { wrapper })
    await act(async () => { await result.current.mutateAsync() })
    expect(qc.getQueryData(meetingKeys.summary('m1'))).toEqual({ inGroup: false, state: 'PENDING' })
    h.regenerate.mockRejectedValueOnce(httpErr(409, 'MEETING_SUMMARY_PENDING'))
    await act(async () => { await result.current.mutateAsync().catch(() => {}) })
    expect(inv).toHaveBeenCalledWith({ queryKey: meetingKeys.summary('m1') })
    inv.mockClear()
    h.regenerate.mockRejectedValueOnce(httpErr(409, 'MEETING_SUMMARY_UNAVAILABLE'))
    await act(async () => { await result.current.mutateAsync().catch(() => {}) })
    expect(inv).not.toHaveBeenCalled()
  })
})

describe('capabilities', () => {
  it('admin access needs a section capability; signed out → no fetch', async () => {
    useAuthStore.setState({ user: null })
    const w0 = makeQueryWrapper()
    renderHook(() => useCanAccessAdmin(), { wrapper: w0.wrapper })
    expect(h.caps).not.toHaveBeenCalled()
    useAuthStore.setState({ user: { id: 'u1' } as never })
    h.caps.mockResolvedValue({ perms: ['MANAGE_MEMBERS'], workspace: {} })
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => ({ admin: useCanAccessAdmin(), mm: useHasCapability('MANAGE_MEMBERS' as never) }), { wrapper })
    await waitFor(() => expect(result.current.admin).toBe(true))
    expect(result.current.mm).toBe(true)
  })
})

describe('static content builders', () => {
  it('FAQ items carry namespaced keys only', () => {
    const items = FAQ_CATEGORIES.flatMap((c) => c.items.map((i) => ({ c: c.id, ...i })))
    expect(items.length).toBeGreaterThan(5)
    for (const i of items) {
      expect(i.id.startsWith(`${i.c}.`)).toBe(true)
      expect(i.questionKey).toBe(`q.${i.id}`)
      expect(i.answerKey).toBe(`a.${i.id}`)
    }
  })

  it('profile form texts map every label through t', () => {
    const texts = buildProfileFormTexts((k) => `T(${k})`)
    expect(texts.displayNameLabel).toBe('T(displayNameLabel)')
    expect(Object.values(texts).every((v) => typeof v === 'string' && v.startsWith('T('))).toBe(true)
  })
})
