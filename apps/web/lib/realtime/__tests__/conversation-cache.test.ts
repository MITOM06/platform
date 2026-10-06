/**
 * CONVERSATION_UPDATED merge rules (chat-service contract, HANDOFF §5.3).
 * The topic payload carries only shared fields: it must be MERGED so my own
 * unread / mute / archive state survives; the user-queue payload is my full view.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  ARCHIVED_CONVERSATIONS_KEY,
  CONVERSATIONS_KEY,
  applyOwnConversationUpdate,
  applySharedConversationUpdate,
  isConversationMuted,
  markPreviewRecalled,
  mergeSharedConversation,
} from '@/lib/realtime/conversation-cache'
import type { Conversation, ConversationsResponse } from '@/lib/api/types'

const ME = 'me'

function conv(over: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    participants: [ME, 'bob'],
    type: 'group',
    name: 'Team',
    avatarUrl: null,
    wallpaper: null,
    admins: [ME],
    createdBy: ME,
    isPublic: false,
    status: 'accepted',
    isMuted: true,
    muteExpiresAt: null,
    isArchived: false,
    pinnedMessages: [],
    autoDeleteSeconds: null,
    lastMessage: { content: 'hi', senderId: 'bob', createdAt: '2026-10-05T10:00:00Z', messageId: 'm1' },
    lastMessageAt: '2026-10-05T10:00:00Z',
    unreadCount: 7,
    ...over,
  }
}

/** A topic payload: viewer fields stripped, as `withoutViewerState()` sends it. */
function shared(over: Partial<Conversation> = {}): Conversation {
  const full = conv(over) as Partial<Conversation>
  delete full.unreadCount
  delete full.isMuted
  delete full.muteExpiresAt
  delete full.isArchived
  delete full.isBlocked
  return full as Conversation
}

function list(qc: QueryClient, key: readonly unknown[] = CONVERSATIONS_KEY): Conversation[] {
  return qc.getQueryData<ConversationsResponse>(key)?.content ?? []
}

function seed(qc: QueryClient, rows: Conversation[], key: readonly unknown[] = CONVERSATIONS_KEY) {
  qc.setQueryData<ConversationsResponse>(key, {
    content: rows, page: 0, size: rows.length, totalElements: rows.length,
  })
}

describe('conversation cache merge rules', () => {
  let qc: QueryClient
  beforeEach(() => {
    qc = new QueryClient()
  })

  it('merges a shared update without touching my unread / mute / archive state', () => {
    const merged = mergeSharedConversation(conv(), shared({ name: 'Renamed', unreadCount: 0 }))
    expect(merged.name).toBe('Renamed')
    expect(merged.unreadCount).toBe(7)
    expect(merged.isMuted).toBe(true)
    expect(merged.isArchived).toBe(false)
  })

  it('ignores viewer fields even if a shared payload carries them', () => {
    const merged = mergeSharedConversation(conv(), { ...shared(), isMuted: false, unreadCount: 0 })
    expect(merged.isMuted).toBe(true)
    expect(merged.unreadCount).toBe(7)
  })

  it('applies a topic update to the detail query and the list', () => {
    qc.setQueryData(['conversation', 'c1'], conv())
    seed(qc, [conv({ id: 'c0', lastMessageAt: '2026-10-05T11:00:00Z' }), conv()])

    const outcome = applySharedConversationUpdate(
      qc,
      shared({ avatarUrl: '/api/uploads/new', lastMessageAt: '2026-10-05T12:00:00Z' }),
      ME,
    )

    expect(outcome).toBe('merged')
    expect(qc.getQueryData<Conversation>(['conversation', 'c1'])?.avatarUrl).toBe('/api/uploads/new')
    expect(qc.getQueryData<Conversation>(['conversation', 'c1'])?.unreadCount).toBe(7)
    // Newest activity first.
    expect(list(qc).map((c) => c.id)).toEqual(['c1', 'c0'])
    expect(list(qc)[0].isMuted).toBe(true)
  })

  it('drops the conversation everywhere when I am no longer a participant', () => {
    qc.setQueryData(['conversation', 'c1'], conv())
    qc.setQueryData(['messages', 'c1'], { pages: [], pageParams: [] })
    seed(qc, [conv()])

    const outcome = applySharedConversationUpdate(qc, shared({ participants: ['bob'] }), ME)

    expect(outcome).toBe('removed')
    expect(list(qc)).toEqual([])
    expect(qc.getQueryData(['conversation', 'c1'])).toBeUndefined()
    expect(qc.getQueryData(['messages', 'c1'])).toBeUndefined()
  })

  it('reports an unknown conversation so the list is refetched', () => {
    seed(qc, [conv({ id: 'other' })])
    expect(applySharedConversationUpdate(qc, shared({ id: 'new' }), ME)).toBe('unknown')
  })

  it('replaces with my full view from the user queue and moves archived rows', () => {
    seed(qc, [conv()])
    seed(qc, [], ARCHIVED_CONVERSATIONS_KEY)

    applyOwnConversationUpdate(qc, conv({ isArchived: true, unreadCount: 0 }), ME)

    // Main list keeps the row (the UI filters archived) but with my new state.
    expect(list(qc)[0].isArchived).toBe(true)
    expect(list(qc)[0].unreadCount).toBe(0)

    applyOwnConversationUpdate(qc, conv({ isArchived: false }), ME)
    expect(list(qc, ARCHIVED_CONVERSATIONS_KEY)).toEqual([])
  })

  it('flips the list preview of a recalled last message', () => {
    seed(qc, [conv()])
    markPreviewRecalled(qc, 'c1', 'm1')
    expect(list(qc)[0].lastMessage).toMatchObject({ recalled: true, content: '' })

    // A different message does not touch the preview.
    seed(qc, [conv()])
    markPreviewRecalled(qc, 'c1', 'm-other')
    expect(list(qc)[0].lastMessage?.recalled).toBeUndefined()
  })

  it('treats an expired timed mute as not muted', () => {
    const now = Date.parse('2026-10-05T12:00:00Z')
    expect(isConversationMuted({ isMuted: true, muteExpiresAt: null }, now)).toBe(true)
    expect(isConversationMuted({ isMuted: true, muteExpiresAt: now + 60_000 }, now)).toBe(true)
    expect(isConversationMuted({ isMuted: true, muteExpiresAt: now - 1 }, now)).toBe(false)
    expect(isConversationMuted({ isMuted: false, muteExpiresAt: null }, now)).toBe(false)
    expect(isConversationMuted(undefined, now)).toBe(false)
  })
})
