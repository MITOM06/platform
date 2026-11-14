import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { makeQueryWrapper } from '@/test/query-wrapper'

const h = vi.hoisted(() => ({
  ctx: {
    getMine: vi.fn(), updateMyStyle: vi.fn(), getUser: vi.fn(), updateUserHard: vi.fn(),
    listEntries: vi.fn(), createEntry: vi.fn(), updateEntry: vi.fn(), deleteEntry: vi.fn(),
  },
  ai: { getMyMemories: vi.fn(), deleteMemory: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
  adminToast: vi.fn(),
}))
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@/lib/api/ai-context', () => ({ aiContextService: h.ctx }))
vi.mock('@/lib/api/ai', () => ({ aiService: h.ai }))
vi.mock('@/lib/hooks/use-admin', () => ({ useAdminErrorToast: () => h.adminToast }))

import {
  useMyAiContext, useUpdateMyStyle, useMyMemory, useDeleteMemory, useMemberAiContext,
  useUpdateMemberHard, useContextEntries, useCreateEntry, useUpdateEntry, useDeleteEntry,
} from '@/lib/hooks/use-ai-context'

beforeEach(() => {
  for (const fn of [...Object.values(h.ctx), ...Object.values(h.ai)]) fn.mockReset().mockResolvedValue({ ok: true })
  h.toast.success.mockReset(); h.toast.error.mockReset(); h.adminToast.mockReset()
})

describe('ai-context queries', () => {
  it('useMyAiContext and useMyMemory load', async () => {
    h.ctx.getMine.mockResolvedValue({ context: { style: 's' } })
    h.ai.getMyMemories.mockResolvedValue({ summary: 'S' })
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => ({ c: useMyAiContext(), m: useMyMemory() }), { wrapper })
    await waitFor(() => expect(result.current.c.data).toEqual({ context: { style: 's' } }))
    await waitFor(() => expect(result.current.m.data).toEqual({ summary: 'S' }))
  })

  it('useMemberAiContext respects `enabled`', async () => {
    const { wrapper } = makeQueryWrapper()
    renderHook(() => useMemberAiContext('u1', false), { wrapper })
    expect(h.ctx.getUser).not.toHaveBeenCalled()
    const { result } = renderHook(() => useMemberAiContext('u1', true), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual({ ok: true }))
    expect(h.ctx.getUser).toHaveBeenCalledWith('u1')
  })

  it('useContextEntries keys by scope + scopeId (null when absent)', async () => {
    h.ctx.listEntries.mockResolvedValue([{ _id: 'e' }])
    const { qc, wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useContextEntries('company'), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual([{ _id: 'e' }]))
    expect(h.ctx.listEntries).toHaveBeenCalledWith('company', undefined)
    expect(qc.getQueryData(['ai-context', 'entries', 'company', null])).toEqual([{ _id: 'e' }])
    renderHook(() => useContextEntries('department', 'd1'), { wrapper })
    await waitFor(() => expect(h.ctx.listEntries).toHaveBeenCalledWith('department', 'd1'))
  })

  it('surfaces a query error', async () => {
    h.ctx.getMine.mockRejectedValue(new Error('401'))
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useMyAiContext(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(new Error('401'))
  })
})

describe('self mutations', () => {
  it('useUpdateMyStyle success / failure', async () => {
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateMyStyle(), { wrapper })
    await act(async () => { await result.current.mutateAsync({ style: 'brief' }) })
    expect(h.ctx.updateMyStyle).toHaveBeenCalledWith({ style: 'brief' })
    expect(inv).toHaveBeenCalledWith({ queryKey: ['ai-context', 'me'] })
    expect(h.toast.success).toHaveBeenCalledWith('styleSaved')
    h.ctx.updateMyStyle.mockRejectedValueOnce(new Error('x'))
    await act(async () => { await result.current.mutateAsync({}).catch(() => {}) })
    expect(h.toast.error).toHaveBeenCalledWith('saveError')
  })

  it('useDeleteMemory success / failure', async () => {
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteMemory(), { wrapper })
    await act(async () => { await result.current.mutateAsync('c1') })
    expect(h.ai.deleteMemory).toHaveBeenCalledWith('c1')
    expect(inv).toHaveBeenCalledWith({ queryKey: ['ai-memory'] })
    expect(h.toast.success).toHaveBeenCalledWith('memoryDeleted')
    h.ai.deleteMemory.mockRejectedValueOnce(new Error('x'))
    await act(async () => { await result.current.mutateAsync('c1').catch(() => {}) })
    expect(h.toast.error).toHaveBeenCalledWith('deleteError')
  })
})

describe('admin mutations', () => {
  it('useUpdateMemberHard invalidates that member', async () => {
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateMemberHard(), { wrapper })
    await act(async () => { await result.current.mutateAsync({ userId: 'u9', body: { jobTitle: 'Dev' } }) })
    expect(h.ctx.updateUserHard).toHaveBeenCalledWith('u9', { jobTitle: 'Dev' })
    expect(inv).toHaveBeenCalledWith({ queryKey: ['ai-context', 'user', 'u9'] })
    expect(h.toast.success).toHaveBeenCalledWith('toastSaved')
  })

  it('create / update / delete entry invalidate entries and toast', async () => {
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(
      () => ({ c: useCreateEntry(), u: useUpdateEntry(), d: useDeleteEntry() }),
      { wrapper },
    )
    const dto = { scope: 'company' as const, label: 'L', text: 'T' }
    await act(async () => { await result.current.c.mutateAsync(dto) })
    await act(async () => { await result.current.u.mutateAsync({ id: 'e1', dto }) })
    await act(async () => { await result.current.d.mutateAsync('e1') })
    expect(h.ctx.createEntry).toHaveBeenCalledWith(dto)
    expect(h.ctx.updateEntry).toHaveBeenCalledWith('e1', dto)
    expect(h.ctx.deleteEntry).toHaveBeenCalledWith('e1')
    expect(inv).toHaveBeenCalledTimes(3)
    expect(inv).toHaveBeenCalledWith({ queryKey: ['ai-context', 'entries'] })
    expect(h.toast.success.mock.calls.map((c) => c[0])).toEqual(['toastSaved', 'toastSaved', 'toastDeleted'])
  })

  it('admin failures go through the admin error toast (403 etc.)', async () => {
    const err = Object.assign(new Error('forbidden'), { response: { status: 403 } })
    h.ctx.createEntry.mockRejectedValue(err)
    h.ctx.updateEntry.mockRejectedValue(err)
    h.ctx.deleteEntry.mockRejectedValue(err)
    h.ctx.updateUserHard.mockRejectedValue(err)
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(
      () => ({ c: useCreateEntry(), u: useUpdateEntry(), d: useDeleteEntry(), m: useUpdateMemberHard() }),
      { wrapper },
    )
    await act(async () => {
      await result.current.c.mutateAsync({} as never).catch(() => {})
      await result.current.u.mutateAsync({ id: 'x', dto: {} as never }).catch(() => {})
      await result.current.d.mutateAsync('x').catch(() => {})
      await result.current.m.mutateAsync({ userId: 'x', body: {} }).catch(() => {})
    })
    expect(h.adminToast).toHaveBeenCalledTimes(4)
    expect(h.adminToast.mock.calls[0][0]).toBe(err)
    expect(h.toast.success).not.toHaveBeenCalled()
  })
})
