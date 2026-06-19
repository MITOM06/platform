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
import { useMessageCache } from '@/lib/hooks/use-message-cache'
import type { Message, MessagesResponse } from '@/lib/api/types'

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
})
