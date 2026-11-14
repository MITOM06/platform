import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { makeQueryWrapper } from '@/test/query-wrapper'

const h = vi.hoisted(() => ({
  auth: { getRelationship: vi.fn(), blockUser: vi.fn(), unblockUser: vi.fn(), getUsers: vi.fn() },
  notif: { list: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
  asst: { fetchAssistant: vi.fn(), fetchAssistantProviders: vi.fn(), setupAssistant: vi.fn(), deleteAssistant: vi.fn() },
  createConversation: vi.fn(),
  push: vi.fn(),
}))
vi.mock('@/lib/api/auth', () => ({ authService: h.auth }))
vi.mock('@/lib/api/notifications', () => ({ notificationsApi: h.notif }))
vi.mock('@/lib/api/assistant', () => h.asst)
vi.mock('@/lib/api/chat', () => ({ chatService: { createConversation: h.createConversation } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }))

import { useRelationship } from '@/lib/hooks/use-relationship'
import { useNotifications, useNotificationActions } from '@/lib/hooks/use-notifications'
import { useAssistant, useAssistantProviders, useSetupAssistant, useDeleteAssistant } from '@/lib/hooks/use-assistant'
import { useOpenAssistantChat } from '@/lib/hooks/use-open-assistant-chat'
import { useCallNames } from '@/lib/hooks/use-call-names'
import { setNickname } from '@/lib/nicknames'

beforeEach(() => {
  for (const f of [...Object.values(h.auth), ...Object.values(h.notif), ...Object.values(h.asst), h.createConversation, h.push]) {
    f.mockReset().mockResolvedValue(undefined)
  }
  localStorage.clear()
})

describe('useRelationship', () => {
  it('is disabled without a user id', () => {
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useRelationship(undefined), { wrapper })
    expect(h.auth.getRelationship).not.toHaveBeenCalled()
    expect(result.current.relationship).toBeUndefined()
  })

  it('loads and block / unblock invalidate relationship + conversations', async () => {
    h.auth.getRelationship.mockResolvedValue({ status: 'none' })
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRelationship('u2'), { wrapper })
    await waitFor(() => expect(result.current.relationship).toEqual({ status: 'none' }))
    expect(h.auth.getRelationship).toHaveBeenCalledWith('u2')
    await act(async () => { await result.current.block('u2') })
    expect(h.auth.blockUser).toHaveBeenCalledWith('u2')
    await act(async () => { await result.current.unblock('u2') })
    expect(h.auth.unblockUser).toHaveBeenCalledWith('u2')
    expect(inv.mock.calls.map((c) => c[0])).toEqual([
      { queryKey: ['relationship', 'u2'] }, { queryKey: ['conversations'] },
      { queryKey: ['relationship', 'u2'] }, { queryKey: ['conversations'] },
    ])
  })

  it('block failure rejects and does not invalidate', async () => {
    h.auth.blockUser.mockRejectedValue(new Error('403'))
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRelationship('u2'), { wrapper })
    await act(async () => { await expect(result.current.block('u2')).rejects.toThrow('403') })
    expect(inv).not.toHaveBeenCalled()
  })
})

describe('notifications', () => {
  it('lists and marks read / all read with invalidation', async () => {
    h.notif.list.mockResolvedValue([{ _id: 'n' }])
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => ({ q: useNotifications(), a: useNotificationActions() }), { wrapper })
    await waitFor(() => expect(result.current.q.data).toEqual([{ _id: 'n' }]))
    await act(async () => { await result.current.a.markRead.mutateAsync('n') })
    expect(h.notif.markRead).toHaveBeenCalledWith('n')
    await act(async () => { await result.current.a.markAllRead.mutateAsync() })
    expect(h.notif.markAllRead).toHaveBeenCalled()
    expect(inv).toHaveBeenCalledTimes(2)
    expect(inv).toHaveBeenCalledWith({ queryKey: ['notifications'] })
  })
})

describe('assistant hooks', () => {
  it('queries the assistant and providers', async () => {
    h.asst.fetchAssistant.mockResolvedValue(null)
    h.asst.fetchAssistantProviders.mockResolvedValue([{ id: 'p' }])
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => ({ a: useAssistant(), p: useAssistantProviders() }), { wrapper })
    await waitFor(() => expect(result.current.a.isSuccess).toBe(true))
    expect(result.current.a.data).toBeNull()
    await waitFor(() => expect(result.current.p.data).toEqual([{ id: 'p' }]))
  })

  it('setup / delete invalidate the assistant query', async () => {
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => ({ s: useSetupAssistant(), d: useDeleteAssistant() }), { wrapper })
    await act(async () => { await result.current.s.mutateAsync({ name: 'A' }) })
    expect(h.asst.setupAssistant.mock.calls[0][0]).toEqual({ name: 'A' })
    await act(async () => { await result.current.d.mutateAsync() })
    expect(h.asst.deleteAssistant).toHaveBeenCalled()
    expect(inv).toHaveBeenCalledTimes(2)
    expect(inv).toHaveBeenCalledWith({ queryKey: ['assistant', 'me'] })
  })
})

describe('useOpenAssistantChat', () => {
  it('navigates to the created conversation', async () => {
    h.createConversation.mockResolvedValue({ id: 'c1' })
    const { result } = renderHook(() => useOpenAssistantChat())
    await result.current('bot1')
    expect(h.createConversation).toHaveBeenCalledWith('bot1')
    expect(h.push).toHaveBeenCalledWith('/conversations/c1')
  })

  it('409 with an existing id navigates there', async () => {
    h.createConversation.mockRejectedValue({ response: { status: 409, data: { conversationId: 'old' } } })
    const { result } = renderHook(() => useOpenAssistantChat())
    await result.current('bot1')
    expect(h.push).toHaveBeenCalledWith('/conversations/old')
  })

  it('409 without an id, or other errors, rethrow', async () => {
    const e409 = { response: { status: 409, data: {} } }
    h.createConversation.mockRejectedValueOnce(e409)
    const { result } = renderHook(() => useOpenAssistantChat())
    await expect(result.current('bot1')).rejects.toBe(e409)
    const e500 = new Error('500')
    h.createConversation.mockRejectedValueOnce(e500)
    await expect(result.current('bot1')).rejects.toBe(e500)
    expect(h.push).not.toHaveBeenCalled()
  })
})

describe('useCallNames', () => {
  it('batch-loads only missing profiles once and resolves nickname > profile > fallback', async () => {
    h.auth.getUsers.mockResolvedValue([{ id: 'u2', displayName: 'Bob' }])
    const { qc, wrapper } = makeQueryWrapper()
    qc.setQueryData(['user', 'u1'], { id: 'u1', displayName: 'Ann' })
    setNickname('c1', 'u3', 'Cee')
    const ids = ['u1', 'u2', 'u2', '']
    const { result } = renderHook(() => useCallNames('c1', ids), { wrapper })
    await waitFor(() => expect(qc.getQueryData(['user', 'u2'])).toEqual({ id: 'u2', displayName: 'Bob' }))
    expect(h.auth.getUsers).toHaveBeenCalledWith(['u2'])
    expect(result.current('u1')).toBe('Ann')
    expect(result.current('u2')).toBe('Bob')
    expect(result.current('u3')).toBe('Cee')
    expect(result.current('u9', 'fallback')).toBe('fallback')
    expect(result.current('u9')).toBeUndefined()
  })

  it('does not request when everything is cached; swallows load errors', async () => {
    const { qc, wrapper } = makeQueryWrapper()
    qc.setQueryData(['user', 'u1'], { id: 'u1', displayName: 'Ann' })
    renderHook(() => useCallNames(null, ['u1']), { wrapper })
    expect(h.auth.getUsers).not.toHaveBeenCalled()
    h.auth.getUsers.mockRejectedValue(new Error('net'))
    const { result } = renderHook(() => useCallNames(undefined, ['zz']), { wrapper })
    await waitFor(() => expect(h.auth.getUsers).toHaveBeenCalledWith(['zz']))
    expect(result.current('zz', 'fb')).toBe('fb')
  })

  it('ignores a response that lands after unmount', async () => {
    let resolve!: (u: unknown[]) => void
    h.auth.getUsers.mockReturnValue(new Promise((r) => { resolve = r }))
    const { qc, wrapper } = makeQueryWrapper()
    const { unmount } = renderHook(() => useCallNames('c', ['late']), { wrapper })
    unmount()
    await act(async () => { resolve([{ id: 'late', displayName: 'L' }]) })
    expect(qc.getQueryData(['user', 'late'])).toBeUndefined()
  })
})
