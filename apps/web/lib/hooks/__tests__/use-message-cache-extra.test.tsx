/** Paths of useMessageCache not covered by use-message-cache.test.tsx: empty caches, AI threads, sources, action status. */
import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { InfiniteData } from '@tanstack/react-query'
import { makeQueryWrapper } from '@/test/query-wrapper'
import { reconcileThread, useMessageCache } from '@/lib/hooks/use-message-cache'
import { AI_BOT_ID } from '@/lib/constants'
import type { Conversation, Message, MessagesResponse } from '@/lib/api/types'

const CONV = 'c1'
const KEY = ['messages', CONV]
type Pages = InfiniteData<MessagesResponse>

const msg = (id: string, over: Partial<Message> = {}): Message => ({
  id, conversationId: CONV, senderId: 'u', content: id, type: 'text', createdAt: '2026-06-19T10:00:00.000Z', ...over,
})
const pages = (...m: Message[]): Pages => ({
  pages: [{ content: m, page: 0, size: m.length, totalElements: m.length, hasNext: false }], pageParams: [undefined],
})
const ids = (p: Pages | undefined) => p?.pages.flatMap((x) => x.content.map((m) => m.id))

function setup() {
  const { qc, wrapper } = makeQueryWrapper()
  const { result } = renderHook(() => useMessageCache(CONV), { wrapper })
  return { qc, result, get: () => qc.getQueryData<Pages>(KEY) }
}

describe('reconcileThread', () => {
  it('returns old untouched for no messages', () => {
    const old = pages(msg('a'))
    expect(reconcileThread(old, [])).toBe(old)
  })

  it('builds a newest-first single page from nothing, de-duplicated', () => {
    const r = reconcileThread(undefined, [
      msg('a', { createdAt: '2026-01-01T00:00:00Z' }),
      msg('b', { createdAt: '2026-01-02T00:00:00Z' }),
      msg('a', { createdAt: '2026-01-01T00:00:00Z' }),
    ])
    expect(ids(r)).toEqual(['b', 'a'])
    expect(r!.pages[0]).toMatchObject({ page: 0, size: 2, totalElements: 2, hasNext: false })
  })

  it('replacing only (nothing new) keeps local sources when the server has none', () => {
    const src = [{ title: 's' }] as never
    const r = reconcileThread(pages(msg('a', { sources: src })), [msg('a', { content: 'edited' })])
    expect(r!.pages[0].content[0]).toMatchObject({ content: 'edited', sources: src })
  })
})

describe('useMessageCache — empty-cache no-ops', () => {
  it('patch / remove / read / recall / action status leave an empty cache empty', () => {
    const { result, get } = setup()
    act(() => {
      result.current.patchMessage('a', { content: 'x' })
      result.current.removeMessage('a')
      result.current.markMessageRead('a', 'u2')
      result.current.recallMessage('a')
      result.current.setPendingActionStatus('act', 'confirmed' as never)
    })
    expect(get()).toBeUndefined()
  })

  it('reconcileMessages([]) changes nothing', () => {
    const { qc, result, get } = setup()
    qc.setQueryData(KEY, pages(msg('a')))
    const before = get()
    act(() => result.current.reconcileMessages([]))
    expect(get()).toBe(before)
  })

  it('reconcileMessages fills an empty cache and bumps the list preview with the newest', () => {
    const { qc, result, get } = setup()
    const conv = { id: CONV, participants: ['u', 'v'], type: 'direct', lastMessageAt: '2020-01-01T00:00:00Z' } as Conversation
    qc.setQueryData(['conversations'], { content: [conv] })
    act(() => result.current.reconcileMessages([
      msg('old', { createdAt: '2026-01-01T00:00:00Z' }),
      msg('new', { createdAt: '2026-02-01T00:00:00Z' }),
    ]))
    expect(ids(get())).toEqual(['new', 'old'])
    const list = qc.getQueryData<{ content: Conversation[] }>(['conversations'])!
    expect(list.content[0].lastMessageAt).toBe('2026-02-01T00:00:00Z')
  })
})

describe('useMessageCache — AI thread previews', () => {
  const thread = (lastMessageAt?: string) =>
    ({ id: CONV, participants: ['u', AI_BOT_ID], type: 'direct', lastMessageAt }) as Conversation

  it('a newer message bumps the AI thread list, not the main list', () => {
    const { qc, result } = setup()
    qc.setQueryData(['ai-threads'], [{ id: 'other' }, thread('2026-01-01T00:00:00Z')])
    act(() => result.current.appendMessage(msg('m', { createdAt: '2026-03-01T00:00:00Z' })))
    const list = qc.getQueryData<Conversation[]>(['ai-threads'])!
    expect(list[0].id).toBe(CONV)
    expect(list[0].lastMessageAt).toBe('2026-03-01T00:00:00Z')
    expect(qc.getQueryData(['conversations'])).toBeUndefined()
  })

  it('an older message leaves the AI thread untouched', () => {
    const { qc, result } = setup()
    const t = thread('2026-05-01T00:00:00Z')
    qc.setQueryData(['ai-threads'], [{ id: 'other' }, t])
    act(() => result.current.appendMessage(msg('m', { createdAt: '2026-03-01T00:00:00Z' })))
    expect(qc.getQueryData<Conversation[]>(['ai-threads'])).toEqual([{ id: 'other' }, t])
  })
})

describe('useMessageCache — list preview ordering', () => {
  it('re-inserts by recency, after more recent chats', () => {
    const { qc, result } = setup()
    qc.setQueryData(['conversations'], {
      content: [
        { id: 'x', participants: [], lastMessageAt: '2026-09-01T00:00:00Z' },
        { id: CONV, participants: [], lastMessageAt: '2026-01-01T00:00:00Z' },
        { id: 'y', participants: [], lastMessageAt: '2026-02-01T00:00:00Z' },
      ],
    })
    act(() => result.current.appendMessage(msg('m', { createdAt: '2026-03-01T00:00:00Z' })))
    const list = qc.getQueryData<{ content: Conversation[] }>(['conversations'])!
    expect(list.content.map((c) => c.id)).toEqual(['x', CONV, 'y'])
  })

  it('goes to the end when every other chat is newer', () => {
    const { qc, result } = setup()
    qc.setQueryData(['conversations'], {
      content: [
        { id: CONV, participants: [] },
        { id: 'x', participants: [], lastMessageAt: '2026-09-01T00:00:00Z' },
      ],
    })
    act(() => result.current.appendMessage(msg('m', { createdAt: '2026-03-01T00:00:00Z' })))
    expect(qc.getQueryData<{ content: Conversation[] }>(['conversations'])!.content.map((c) => c.id)).toEqual(['x', CONV])
  })
})

describe('attachAiSources', () => {
  const src = [{ title: 'doc' }] as never

  it('no sources → false, no change', () => {
    const { qc, result, get } = setup()
    qc.setQueryData(KEY, pages(msg('ai', { type: 'ai' })))
    let r = true
    act(() => { r = result.current.attachAiSources([]) })
    expect(r).toBe(false)
    expect(get()!.pages[0].content[0].sources).toBeUndefined()
  })

  it('matches by replyId exactly', () => {
    const { qc, result, get } = setup()
    qc.setQueryData(KEY, pages(msg('a1', { type: 'ai', aiReplyId: 'r1' }), msg('a2', { type: 'ai', aiReplyId: 'r2' })))
    let r = false
    act(() => { r = result.current.attachAiSources(src, 'r2') })
    expect(r).toBe(true)
    const [a1, a2] = get()!.pages[0].content
    expect(a1.sources).toBeUndefined()
    expect(a2.sources).toEqual(src)
  })

  it('without replyId patches the newest sources-less AI bubble', () => {
    const { qc, result, get } = setup()
    qc.setQueryData(KEY, pages(msg('t', { type: 'text' }), msg('a1', { type: 'ai', sources: [{ title: 'x' }] as never }), msg('a2', { type: 'ai' })))
    let r = false
    act(() => { r = result.current.attachAiSources(src) })
    expect(r).toBe(true)
    expect(get()!.pages[0].content[2].sources).toEqual(src)
  })

  it('returns false when nothing matches or the cache is empty', () => {
    const { qc, result } = setup()
    let r = true
    act(() => { r = result.current.attachAiSources(src, 'nope') })
    expect(r).toBe(false)
    qc.setQueryData(KEY, pages(msg('t')))
    act(() => { r = result.current.attachAiSources(src, 'nope') })
    expect(r).toBe(false)
  })
})

describe('setPendingActionStatus', () => {
  it('updates only the matching action', () => {
    const { qc, result, get } = setup()
    qc.setQueryData(KEY, pages(
      msg('a', { type: 'ai', pendingActions: [{ id: 'p1', status: 'pending' }, { id: 'p2', status: 'pending' }] as never }),
      msg('b'),
    ))
    act(() => result.current.setPendingActionStatus('p2', 'confirmed' as never))
    const a = get()!.pages[0].content[0]
    expect(a.pendingActions!.map((x) => x.status)).toEqual(['pending', 'confirmed'])
    expect(get()!.pages[0].content[1]).toEqual(msg('b'))
  })
})
