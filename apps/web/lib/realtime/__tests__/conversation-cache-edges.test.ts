import { describe, it, expect, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  isParticipant, findCachedConversation, applySharedConversationUpdate, applyOwnConversationUpdate,
  markPreviewRecalled, applyIncomingPreview, CONVERSATIONS_KEY, ARCHIVED_CONVERSATIONS_KEY, AI_THREADS_KEY,
} from '@/lib/realtime/conversation-cache'
import { AI_BOT_ID } from '@/lib/constants'
import type { Conversation } from '@/lib/api/types'

const conv = (over: Partial<Conversation> = {}) =>
  ({ id: 'c1', type: 'direct', participants: ['me', 'bob'], ...over }) as Conversation
const list = (...c: Conversation[]) => ({ content: c })
const ids = (qc: QueryClient, key: readonly unknown[]) =>
  qc.getQueryData<{ content: Conversation[] }>(key)?.content.map((c) => c.id)

describe('isParticipant / findCachedConversation', () => {
  it('unknown user counts as participant; non-array participants do not', () => {
    expect(isParticipant(conv(), undefined)).toBe(true)
    expect(isParticipant(conv(), 'me')).toBe(true)
    expect(isParticipant(conv(), 'eve')).toBe(false)
    expect(isParticipant({ participants: null } as never, 'me')).toBe(false)
  })

  it('finds a conversation in the detail cache, a list, or the AI threads', () => {
    const qc = new QueryClient()
    expect(findCachedConversation(qc, 'c1')).toBeUndefined()
    qc.setQueryData(AI_THREADS_KEY, [conv({ id: 'ai' })])
    expect(findCachedConversation(qc, 'ai')?.id).toBe('ai')
    qc.setQueryData(ARCHIVED_CONVERSATIONS_KEY, list(conv({ id: 'arch' })))
    expect(findCachedConversation(qc, 'arch')?.id).toBe('arch')
    qc.setQueryData(['conversation', 'one'], conv({ id: 'one', name: 'detail' }))
    expect(findCachedConversation(qc, 'one')?.name).toBe('detail')
  })
})

describe('apply*ConversationUpdate guards', () => {
  it('payloads without an id are unknown', () => {
    const qc = new QueryClient()
    expect(applySharedConversationUpdate(qc, {} as Conversation, 'me')).toBe('unknown')
    expect(applyOwnConversationUpdate(qc, null as unknown as Conversation, 'me')).toBe('unknown')
  })

  it('own update after I was removed drops the conversation', () => {
    const qc = new QueryClient()
    qc.setQueryData(CONVERSATIONS_KEY, list(conv()))
    expect(applyOwnConversationUpdate(qc, conv({ participants: ['bob'] }), 'me')).toBe('removed')
    expect(ids(qc, CONVERSATIONS_KEY)).toEqual([])
  })
})

describe('applyOwnConversationUpdate', () => {
  it('replaces the detail cache and the list row', () => {
    const qc = new QueryClient()
    qc.setQueryData(['conversation', 'c1'], conv())
    qc.setQueryData(CONVERSATIONS_KEY, list(conv()))
    expect(applyOwnConversationUpdate(qc, conv({ name: 'New' }), 'me')).toBe('merged')
    expect(qc.getQueryData<Conversation>(['conversation', 'c1'])?.name).toBe('New')
    expect(qc.getQueryData<{ content: Conversation[] }>(CONVERSATIONS_KEY)?.content[0].name).toBe('New')
  })

  it('an unknown active conversation pulls the main list; archived goes to the archive', () => {
    const qc = new QueryClient()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    expect(applyOwnConversationUpdate(qc, conv(), 'me')).toBe('unknown')
    expect(inv).toHaveBeenCalledWith({ queryKey: CONVERSATIONS_KEY, exact: true })
    inv.mockClear()
    applyOwnConversationUpdate(qc, conv({ isArchived: true }), 'me')
    expect(inv).toHaveBeenCalledWith({ queryKey: ARCHIVED_CONVERSATIONS_KEY, exact: true })
    expect(inv).not.toHaveBeenCalledWith({ queryKey: CONVERSATIONS_KEY, exact: true })
  })

  it('archived row already cached is patched; unarchiving removes it from the archive', () => {
    const qc = new QueryClient()
    qc.setQueryData(ARCHIVED_CONVERSATIONS_KEY, list(conv({ isArchived: true })))
    applyOwnConversationUpdate(qc, conv({ isArchived: true, name: 'Renamed' }), 'me')
    expect(qc.getQueryData<{ content: Conversation[] }>(ARCHIVED_CONVERSATIONS_KEY)?.content[0].name).toBe('Renamed')
    applyOwnConversationUpdate(qc, conv({ isArchived: false }), 'me')
    expect(ids(qc, ARCHIVED_CONVERSATIONS_KEY)).toEqual([])
  })

  it('a block change refreshes the blocked lists', () => {
    const qc = new QueryClient()
    qc.setQueryData(CONVERSATIONS_KEY, list(conv({ isBlocked: false })))
    const inv = vi.spyOn(qc, 'invalidateQueries')
    applyOwnConversationUpdate(qc, conv({ isBlocked: true }), 'me')
    expect(inv).toHaveBeenCalledWith({ queryKey: ['conversations', 'blocked'] })
    expect(inv).toHaveBeenCalledWith({ queryKey: ['blocked-conversations'] })
  })

  it('AI threads are upserted into the AI list only', () => {
    const qc = new QueryClient()
    const ai = conv({ id: 'ai1', participants: ['me', AI_BOT_ID] })
    qc.setQueryData(AI_THREADS_KEY, [])
    const inv = vi.spyOn(qc, 'invalidateQueries')
    expect(applyOwnConversationUpdate(qc, ai, 'me')).toBe('unknown')
    expect(inv).not.toHaveBeenCalled()
    expect(qc.getQueryData<Conversation[]>(AI_THREADS_KEY)?.map((c) => c.id)).toEqual(['ai1'])
    expect(applyOwnConversationUpdate(qc, { ...ai, name: 'T' }, 'me')).toBe('merged')
    expect(qc.getQueryData<Conversation[]>(AI_THREADS_KEY)?.[0].name).toBe('T')
  })
})

describe('markPreviewRecalled', () => {
  it('blanks the matching preview in lists and the detail cache', () => {
    const qc = new QueryClient()
    const c = conv({ lastMessage: { messageId: 'm1', content: 'secret' } as never })
    qc.setQueryData(CONVERSATIONS_KEY, list(c))
    qc.setQueryData(['conversation', 'c1'], c)
    markPreviewRecalled(qc, 'c1', 'm1')
    expect(qc.getQueryData<Conversation>(['conversation', 'c1'])?.lastMessage).toMatchObject({ content: '', recalled: true })
    expect(qc.getQueryData<{ content: Conversation[] }>(CONVERSATIONS_KEY)?.content[0].lastMessage).toMatchObject({ recalled: true })
    markPreviewRecalled(qc, 'c1', 'other')
  })
})

describe('applyIncomingPreview', () => {
  const ev = (over = {}) => ({ conversationId: 'c1', messageId: 'm9', createdAt: '2026-05-01T00:00:00Z', senderId: 'bob', content: 'hey', ...over })

  it('needs a message id and a valid timestamp, and a cached row', () => {
    const qc = new QueryClient()
    expect(applyIncomingPreview(qc, ev({ messageId: undefined }), false)).toBe(false)
    expect(applyIncomingPreview(qc, ev({ createdAt: 'garbage' }), false)).toBe(false)
    expect(applyIncomingPreview(qc, ev(), false)).toBe(false)
  })

  it('moves the row to the top with +1 unread unless viewing', () => {
    const qc = new QueryClient()
    qc.setQueryData(CONVERSATIONS_KEY, list(conv({ id: 'x' }), conv({ unreadCount: 2 })))
    expect(applyIncomingPreview(qc, ev(), false)).toBe(true)
    const row = qc.getQueryData<{ content: Conversation[] }>(CONVERSATIONS_KEY)!.content[0]
    expect(row).toMatchObject({ id: 'c1', unreadCount: 3, lastMessageAt: '2026-05-01T00:00:00Z' })
    expect(row.lastMessage).toMatchObject({ content: 'hey', senderId: 'bob', messageId: 'm9', type: null, recalled: false })
    expect(applyIncomingPreview(qc, ev(), false)).toBe(true)
    expect(qc.getQueryData<{ content: Conversation[] }>(CONVERSATIONS_KEY)!.content[0].unreadCount).toBe(3)
  })

  it('older events than the row are ignored; viewing keeps unread', () => {
    const qc = new QueryClient()
    qc.setQueryData(CONVERSATIONS_KEY, list(conv({ lastMessageAt: '2026-09-01T00:00:00Z', unreadCount: 0 })))
    expect(applyIncomingPreview(qc, ev(), false)).toBe(true)
    expect(qc.getQueryData<{ content: Conversation[] }>(CONVERSATIONS_KEY)!.content[0].lastMessageAt).toBe('2026-09-01T00:00:00Z')
    expect(applyIncomingPreview(qc, ev({ createdAt: '2026-10-01T00:00:00Z', messageId: 'm10' }), true)).toBe(true)
    expect(qc.getQueryData<{ content: Conversation[] }>(CONVERSATIONS_KEY)!.content[0].unreadCount).toBe(0)
  })

  it('AI threads get the preview in the AI list', () => {
    const qc = new QueryClient()
    qc.setQueryData(AI_THREADS_KEY, [conv({ id: 'other' }), conv({ id: 'c1', participants: ['me', AI_BOT_ID] })])
    expect(applyIncomingPreview(qc, ev(), false)).toBe(true)
    const t = qc.getQueryData<Conversation[]>(AI_THREADS_KEY)!
    expect(t[0]).toMatchObject({ id: 'c1', unreadCount: 1 })
  })
})
