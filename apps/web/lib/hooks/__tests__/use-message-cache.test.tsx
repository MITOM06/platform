/**
 * Tests for useMessageCache — the pure TanStack Query cache transforms that
 * STOMP events feed into (per web.md: new messages call setQueryData, NOT
 * refetch). Mirrors the Flutter chat_provider cache-mutation tests for sync
 * parity (append / read-receipt / reaction / recall / edit).
 *
 * We drive the hook with a real QueryClient, seed the ['messages', id] key with
 * InfiniteData, invoke a transform, then read the cache back and assert.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import {
  QueryClient,
  QueryClientProvider,
  type InfiniteData,
} from '@tanstack/react-query'
import { reconcileThread, useMessageCache } from '@/lib/hooks/use-message-cache'
import type { ConversationsResponse, Message, MessagesResponse } from '@/lib/api/types'

const CONV = 'conv-1'
const KEY = ['messages', CONV] as const

function msg(id: string, over: Partial<Message> = {}): Message {
  return {
    id,
    conversationId: CONV,
    senderId: 'user-1',
    content: `content-${id}`,
    type: 'text',
    createdAt: '2026-06-19T10:00:00.000Z',
    ...over,
  }
}

function seed(qc: QueryClient, messages: Message[]) {
  const data: InfiniteData<MessagesResponse> = {
    pages: [{ content: messages, page: 0, size: messages.length, totalElements: messages.length, hasNext: false }],
    pageParams: [undefined],
  }
  qc.setQueryData(KEY, data)
}

function read(qc: QueryClient): Message[] {
  const data = qc.getQueryData<InfiniteData<MessagesResponse>>(KEY)
  return data ? data.pages.flatMap((p) => p.content) : []
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useMessageCache(CONV), { wrapper })
  return { qc, result }
}

describe('useMessageCache', () => {
  let env: ReturnType<typeof setup>

  beforeEach(() => {
    env = setup()
  })

  // ── appendMessage ──────────────────────────────────────────────────────────

  it('prepends a new incoming message to page 0', () => {
    seed(env.qc, [msg('m1'), msg('m2')])
    act(() => env.result.current.appendMessage(msg('m3')))

    const ids = read(env.qc).map((m) => m.id)
    expect(ids).toEqual(['m3', 'm1', 'm2'])
  })

  it('de-dupes an already-present message id (no duplicate on STOMP echo)', () => {
    seed(env.qc, [msg('m1')])
    act(() => env.result.current.appendMessage(msg('m1', { content: 'echo' })))

    const all = read(env.qc)
    expect(all).toHaveLength(1)
    // Original content preserved — the echo is dropped, not merged.
    expect(all[0].content).toBe('content-m1')
  })

  it('seeds an empty cache when no data exists yet', () => {
    // No seed() — cache is empty.
    act(() => env.result.current.appendMessage(msg('first')))
    expect(read(env.qc).map((m) => m.id)).toEqual(['first'])
  })

  // ── markMessageRead (read receipts) ──────────────────────────────────────────

  it('adds a reader to readBy without duplicating', () => {
    seed(env.qc, [msg('m1', { readBy: ['user-1'] })])

    act(() => env.result.current.markMessageRead('m1', 'user-2'))
    expect(read(env.qc)[0].readBy).toEqual(['user-1', 'user-2'])

    // Re-applying the same reader is a no-op (idempotent — STOMP may re-deliver).
    act(() => env.result.current.markMessageRead('m1', 'user-2'))
    expect(read(env.qc)[0].readBy).toEqual(['user-1', 'user-2'])
  })

  // ── patchMessage: reactions / recall / edit ──────────────────────────────────

  it('replaces reactions via patchMessage (REACTION_UPDATED)', () => {
    seed(env.qc, [msg('m1', { reactions: [{ userId: 'u1', emoji: '👍' }] })])
    act(() =>
      env.result.current.patchMessage('m1', {
        reactions: [
          { userId: 'u1', emoji: '❤️' },
          { userId: 'u2', emoji: '❤️' },
        ],
      }),
    )
    expect(read(env.qc)[0].reactions).toEqual([
      { userId: 'u1', emoji: '❤️' },
      { userId: 'u2', emoji: '❤️' },
    ])
  })

  it('flips recalled via patchMessage (MESSAGE_RECALLED)', () => {
    seed(env.qc, [msg('m1'), msg('m2')])
    act(() => env.result.current.patchMessage('m2', { recalled: true }))

    const all = read(env.qc)
    expect(all.find((m) => m.id === 'm2')?.recalled).toBe(true)
    // Sibling message is untouched.
    expect(all.find((m) => m.id === 'm1')?.recalled).toBeUndefined()
  })

  it('updates content + editedAt via patchMessage (MESSAGE_UPDATED)', () => {
    seed(env.qc, [msg('m1', { content: 'old' })])
    act(() =>
      env.result.current.patchMessage('m1', {
        content: 'edited',
        editedAt: '2026-06-19T10:05:00.000Z',
      }),
    )
    const m = read(env.qc)[0]
    expect(m.content).toBe('edited')
    expect(m.editedAt).toBe('2026-06-19T10:05:00.000Z')
  })

  it('is a no-op on an empty cache (undefined data short-circuits)', () => {
    act(() => env.result.current.patchMessage('missing', { recalled: true }))
    expect(env.qc.getQueryData(KEY)).toBeUndefined()
  })

  // ── removeMessage ("Delete for me") ─────────────────────────────────────────

  it('removes a message deleted for me from the thread', () => {
    seed(env.qc, [msg('m1'), msg('m2')])
    act(() => env.result.current.removeMessage('m1'))
    expect(read(env.qc).map((m) => m.id)).toEqual(['m2'])
  })

  // ── recallMessage ───────────────────────────────────────────────────────────

  it('recall flips the message, its reply quotes and the sidebar preview', () => {
    seed(env.qc, [
      msg('m2', { replyPreview: { messageId: 'm1', senderId: 'user-1', content: 'secret' } }),
      msg('m1', { content: 'secret' }),
    ])
    env.qc.setQueryData<ConversationsResponse>(['conversations'], {
      content: [{
        id: CONV, participants: ['user-1'], type: 'direct', name: null, avatarUrl: null, wallpaper: null,
        admins: [], createdBy: 'user-1', isPublic: false, status: 'accepted', isMuted: false,
        isArchived: false, pinnedMessages: [], autoDeleteSeconds: null, unreadCount: 0,
        lastMessage: { content: 'secret', senderId: 'user-1', createdAt: '2026-06-19T10:00:00.000Z', messageId: 'm1' },
        lastMessageAt: '2026-06-19T10:00:00.000Z',
      }],
      page: 0, size: 1, totalElements: 1,
    })

    act(() => env.result.current.recallMessage('m1'))

    const all = read(env.qc)
    expect(all.find((m) => m.id === 'm1')?.recalled).toBe(true)
    expect(all.find((m) => m.id === 'm2')?.replyPreview).toMatchObject({ recalled: true, content: '' })
    const preview = env.qc.getQueryData<ConversationsResponse>(['conversations'])?.content[0].lastMessage
    expect(preview).toMatchObject({ recalled: true, content: '' })
  })

  // ── reconcileMessages (reconnect re-sync) ───────────────────────────────────

  it('replaces stale copies (edits / recalls) and adds missed messages, newest first', () => {
    seed(env.qc, [msg('m2', { content: 'old', createdAt: '2026-06-19T10:02:00.000Z' }), msg('m1')])
    act(() =>
      env.result.current.reconcileMessages([
        msg('m2', { content: 'edited while offline', editedAt: '2026-06-19T10:05:00.000Z', createdAt: '2026-06-19T10:02:00.000Z' }),
        msg('m4', { createdAt: '2026-06-19T10:04:00.000Z' }),
        msg('m3', { createdAt: '2026-06-19T10:03:00.000Z' }),
        msg('m4', { createdAt: '2026-06-19T10:04:00.000Z' }), // duplicate from the second fetch
      ]),
    )
    const all = read(env.qc)
    expect(all.map((m) => m.id)).toEqual(['m4', 'm3', 'm2', 'm1'])
    expect(all.find((m) => m.id === 'm2')?.content).toBe('edited while offline')
  })

  it('re-inserts the sidebar row by recency instead of always moving it to the top', () => {
    const row = (id: string, at: string) => ({
      id, participants: ['user-1'], type: 'direct' as const, name: null, avatarUrl: null, wallpaper: null,
      admins: [], createdBy: 'user-1', isPublic: false, status: 'accepted' as const, isMuted: false,
      isArchived: false, pinnedMessages: [], autoDeleteSeconds: null, unreadCount: 0,
      lastMessage: { content: 'x', senderId: 'user-1', createdAt: at, messageId: `last-${id}` },
      lastMessageAt: at,
    })
    env.qc.setQueryData<ConversationsResponse>(['conversations'], {
      content: [row('newer', '2026-06-19T12:00:00.000Z'), row(CONV, '2026-06-19T09:00:00.000Z')],
      page: 0, size: 2, totalElements: 2,
    })
    seed(env.qc, [])
    // A catch-up message older than the other chat's activity keeps its place.
    act(() => env.result.current.appendMessage(msg('m9', { createdAt: '2026-06-19T10:00:00.000Z' })))
    const ids = env.qc.getQueryData<ConversationsResponse>(['conversations'])?.content.map((c) => c.id)
    expect(ids).toEqual(['newer', CONV])
  })

  it('keeps locally attached AI sources when the server copy has none', () => {
    const sources = [{ documentId: 'd1', fileName: 'a.pdf', score: 0.9 }]
    const old = {
      pages: [{ content: [msg('a1', { type: 'ai', sources })], page: 0, size: 1, totalElements: 1, hasNext: false }],
      pageParams: [undefined],
    }
    const next = reconcileThread(old, [msg('a1', { type: 'ai', content: 'final' })])
    expect(next?.pages[0].content[0]).toMatchObject({ content: 'final', sources })
  })
})
