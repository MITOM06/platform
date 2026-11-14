import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { makeQueryWrapper } from '@/test/query-wrapper'

const h = vi.hoisted(() => ({
  chat: { getMessages: vi.fn(), getUserStatus: vi.fn(), getConversations: vi.fn(), getConversation: vi.fn() },
  auth: { getUser: vi.fn() },
  threads: { list: vi.fn(), create: vi.fn(), rename: vi.fn() },
}))
vi.mock('@/lib/api/chat', () => ({ chatService: h.chat }))
vi.mock('@/lib/api/auth', () => ({ authService: h.auth }))
vi.mock('@/lib/api/ai-threads', () => ({ aiThreadsApi: h.threads }))

import { useMessages } from '@/lib/hooks/use-messages'
import { useUser } from '@/lib/hooks/use-user'
import { useUserStatus } from '@/lib/hooks/use-user-status'
import { useConversations } from '@/lib/hooks/use-conversations'
import { useConversation } from '@/lib/hooks/use-conversation'
import { useAiThreads } from '@/lib/hooks/use-ai-threads'

beforeEach(() => {
  for (const f of [...Object.values(h.chat), ...Object.values(h.auth), ...Object.values(h.threads)]) f.mockReset()
})

describe('useMessages', () => {
  it('flattens newest-first pages into chronological order and pages with the oldest id', async () => {
    h.chat.getMessages
      .mockResolvedValueOnce({ content: [{ id: 'm4' }, { id: 'm3' }], hasNext: true })
      .mockResolvedValueOnce({ content: [{ id: 'm2' }, { id: 'm1' }], hasNext: false })
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useMessages('c1'), { wrapper })
    await waitFor(() => expect(result.current.data?.messages.map((m) => m.id)).toEqual(['m3', 'm4']))
    expect(h.chat.getMessages).toHaveBeenCalledWith('c1', undefined)
    await act(async () => { await result.current.fetchNextPage() })
    await waitFor(() => expect(result.current.data?.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']))
    expect(h.chat.getMessages).toHaveBeenLastCalledWith('c1', 'm3')
    expect(result.current.hasNextPage).toBe(false)
  })

  it('stops paging on an empty page even if hasNext is set; disabled without id', async () => {
    h.chat.getMessages.mockResolvedValueOnce({ content: [], hasNext: true })
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useMessages('c1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasNextPage).toBe(false)
    renderHook(() => useMessages(''), { wrapper })
    expect(h.chat.getMessages).toHaveBeenCalledTimes(1)
  })
})

describe('simple id-gated queries', () => {
  it('useUser / useUserStatus / useConversation fetch only with an id', async () => {
    h.auth.getUser.mockResolvedValue({ id: 'u1', displayName: 'A' })
    h.chat.getUserStatus.mockResolvedValue({ online: true })
    h.chat.getConversation.mockResolvedValue({ id: 'c1' })
    const { wrapper } = makeQueryWrapper()
    renderHook(() => { useUser(undefined); useUserStatus(undefined); useConversation('') }, { wrapper })
    expect(h.auth.getUser).not.toHaveBeenCalled()
    expect(h.chat.getUserStatus).not.toHaveBeenCalled()
    expect(h.chat.getConversation).not.toHaveBeenCalled()
    const { result } = renderHook(() => ({ u: useUser('u1'), s: useUserStatus('u1'), c: useConversation('c1') }), { wrapper })
    await waitFor(() => expect(result.current.c.data).toEqual({ id: 'c1' }))
    expect(result.current.u.data).toEqual({ id: 'u1', displayName: 'A' })
    expect(result.current.s.data).toEqual({ online: true })
  })

  it('useConversations selects the page content', async () => {
    h.chat.getConversations.mockResolvedValue({ content: [{ id: 'c1' }], hasNext: false })
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useConversations(), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'c1' }]))
  })

  it('useAiThreads lists threads; errors surface', async () => {
    h.threads.list.mockResolvedValueOnce([{ id: 't' }])
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useAiThreads(), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual([{ id: 't' }]))
    h.threads.list.mockRejectedValueOnce(new Error('401'))
    const w2 = makeQueryWrapper()
    const r2 = renderHook(() => useAiThreads(), { wrapper: w2.wrapper })
    await waitFor(() => expect(r2.result.current.error).toEqual(new Error('401')))
  })
})
