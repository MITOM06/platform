/**
 * `/user/queue/notifications` dispatch: muted chats stay silent, MESSAGE_REJECTED
 * and RATE_LIMITED become localized toasts, CLAIMS_CHANGED triggers the silent
 * claims refresh, and banners never show raw ids / system codes / markdown.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  buildMessageNotification,
  handleUserQueueEvent,
  parseUserQueueEvent,
  type UserQueueContext,
} from '@/lib/realtime/user-queue'
import { CONVERSATIONS_KEY } from '@/lib/realtime/conversation-cache'
import { humanizeLastMessage } from '@/lib/system-messages'
import type { Conversation, ConversationsResponse } from '@/lib/api/types'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key

function ctx(qc: QueryClient, over: Partial<UserQueueContext> = {}): UserQueueContext {
  return {
    queryClient: qc,
    currentUserId: 'me',
    t,
    tChat: t,
    notificationsEnabled: () => true,
    isViewingConversation: () => false,
    showNotification: vi.fn(),
    showError: vi.fn(),
    onRemovedFromConversation: vi.fn(),
    onClaimsChanged: vi.fn(),
    ...over,
  }
}

function seedConversation(qc: QueryClient, over: Partial<Conversation>) {
  qc.setQueryData<ConversationsResponse>(CONVERSATIONS_KEY, {
    content: [{ id: 'c1', participants: ['me', 'bob'], type: 'direct', isMuted: false, ...over } as Conversation],
    page: 0,
    size: 1,
    totalElements: 1,
  })
}

const newMessage = {
  type: 'NEW_MESSAGE' as const,
  conversationId: 'c1',
  senderId: 'bob',
  senderName: 'Bob',
  content: 'hello',
  messageType: 'text',
}

describe('user queue events', () => {
  let qc: QueryClient
  beforeEach(() => {
    qc = new QueryClient()
  })

  it('parses only known, well-formed events', () => {
    expect(parseUserQueueEvent('{"type":"CLAIMS_CHANGED"}')).toEqual({ type: 'CLAIMS_CHANGED' })
    expect(parseUserQueueEvent('{"type":"SOMETHING_NEW"}')).toBeNull()
    expect(parseUserQueueEvent('{"type":"CONVERSATION_UPDATED"}')).toBeNull()
    expect(parseUserQueueEvent('{"type":"NEW_MESSAGE"}')).toBeNull()
    expect(parseUserQueueEvent('not json')).toBeNull()
  })

  it('shows a banner for a new message in an unmuted chat', () => {
    seedConversation(qc, { isMuted: false })
    const c = ctx(qc)
    handleUserQueueEvent(newMessage, c)
    expect(c.showNotification).toHaveBeenCalledWith({
      conversationId: 'c1',
      title: 'notificationTitle(Bob)',
      body: 'hello',
    })
  })

  it('stays silent for a muted chat (but still refreshes the list)', () => {
    seedConversation(qc, { isMuted: true, muteExpiresAt: null })
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const c = ctx(qc)
    handleUserQueueEvent({ ...newMessage, type: 'MENTIONED_YOU' }, c)
    expect(c.showNotification).not.toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalled()
  })

  it('stays silent for the open conversation and when notifications are off', () => {
    seedConversation(qc, {})
    const open = ctx(qc, { isViewingConversation: () => true })
    handleUserQueueEvent(newMessage, open)
    expect(open.showNotification).not.toHaveBeenCalled()

    const off = ctx(qc, { notificationsEnabled: () => false })
    handleUserQueueEvent(newMessage, off)
    expect(off.showNotification).not.toHaveBeenCalled()
  })

  it('maps MESSAGE_REJECTED codes to specific messages', () => {
    const c = ctx(qc)
    handleUserQueueEvent({ type: 'MESSAGE_REJECTED', code: 'USER_BLOCKED', conversationId: 'c1' }, c)
    handleUserQueueEvent({ type: 'MESSAGE_REJECTED', code: 'GROUP_ADMIN_REQUIRED' }, c)
    handleUserQueueEvent({ type: 'MESSAGE_REJECTED', code: 'BAD_REQUEST' }, c)
    expect(c.showError).toHaveBeenNthCalledWith(1, 'errUserBlocked')
    expect(c.showError).toHaveBeenNthCalledWith(2, 'errGroupAdminRequired')
    expect(c.showError).toHaveBeenNthCalledWith(3, 'sendMessageError')
  })

  it('surfaces RATE_LIMITED and forwards CLAIMS_CHANGED', () => {
    const c = ctx(qc)
    handleUserQueueEvent({ type: 'RATE_LIMITED' }, c)
    handleUserQueueEvent({ type: 'CLAIMS_CHANGED' }, c)
    expect(c.showError).toHaveBeenCalledWith('rateLimitError')
    expect(c.onClaimsChanged).toHaveBeenCalledTimes(1)
  })

  it('reports removal when my own view no longer lists me', () => {
    seedConversation(qc, {})
    const c = ctx(qc)
    handleUserQueueEvent(
      { type: 'CONVERSATION_UPDATED', conversation: { id: 'c1', participants: ['bob'] } as Conversation },
      c,
    )
    expect(c.onRemovedFromConversation).toHaveBeenCalledWith('c1')
  })

  it('never shows a raw sender id, system code or markdown', () => {
    const rawId = buildMessageNotification(
      { ...newMessage, senderName: '6e3f1c2d4e5f6a7b8c9d0e1f', content: '**bold** answer', messageType: 'ai' },
      t,
      t,
    )
    expect(rawId.title).toBe('notificationTitle(someone)')
    expect(rawId.body).toBe('bold answer')

    const system = buildMessageNotification(
      { ...newMessage, senderName: 'system', content: 'system.autodelete.changed:0', messageType: 'system' },
      t,
      t,
    )
    expect(system.title).toBe('notificationSystemTitle')
    expect(system.body).toBe('systemAutoDeleteOff')

    const file = buildMessageNotification(
      { ...newMessage, content: '{"url":"/api/uploads/x","name":"a.pdf"}', messageType: 'file' },
      t,
      t,
    )
    expect(file.body).toBe('notificationAttachment')
  })
})

/**
 * chat-service system notices (group created, members added/left/joined,
 * auto-delete, admin changes) arrive with the full message payload; the content
 * is the system code and senderId is the actor or "system".
 */
describe('system-notice NEW_MESSAGE payload', () => {
  const ANN = '64b7f0c2a1b2c3d4e5f60718'
  const BOB = '64b7f0c2a1b2c3d4e5f60719'
  const frame = (over: Record<string, string> = {}) =>
    JSON.stringify({
      type: 'NEW_MESSAGE',
      conversationId: 'g1',
      senderId: ANN,
      senderName: 'Ann',
      content: `system.admin.promoted:${BOB}`,
      messageType: 'system',
      messageId: 'm-9',
      createdAt: '2026-10-11T08:00:00Z',
      ...over,
    })
  const leaks = (text: string) => [ANN, BOB, 'system.', 'g1'].filter((raw) => text.includes(raw))

  let qc: QueryClient
  beforeEach(() => {
    qc = new QueryClient()
    qc.setQueryData<ConversationsResponse>(CONVERSATIONS_KEY, {
      content: [
        {
          id: 'g1', type: 'group', name: 'Team', participants: ['me', ANN, BOB], isMuted: false,
          lastMessageAt: '2026-10-11T07:00:00Z', unreadCount: 0,
        } as Conversation,
      ],
      page: 0,
      size: 1,
      totalElements: 1,
    })
  })

  const deliver = (over: Record<string, string> = {}) => {
    const event = parseUserQueueEvent(frame(over))
    expect(event).not.toBeNull()
    const c = ctx(qc)
    handleUserQueueEvent(event!, c)
    return c
  }
  const row = () => qc.getQueryData<ConversationsResponse>(CONVERSATIONS_KEY)!.content[0]!
  const banner = (c: UserQueueContext) =>
    (c.showNotification as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { title: string; body: string }

  it('updates the list row in place with the code, its actor and its type', () => {
    deliver()
    expect(row().lastMessage).toMatchObject({
      content: `system.admin.promoted:${BOB}`,
      senderId: ANN,
      type: 'system',
      messageId: 'm-9',
    })
    expect(row().lastMessageAt).toBe('2026-10-11T08:00:00Z')
  })

  it('the list preview is humanized with name resolution — never the code or an id', () => {
    deliver()
    const names: Record<string, string> = { [BOB]: 'Bob' }
    const resolved = humanizeLastMessage(row().lastMessage, t, {
      resolveName: (id) => names[id],
      currentUserId: 'me',
    })
    expect(resolved).toBe('systemAdminPromoted(Bob)')

    const unresolved = humanizeLastMessage(row().lastMessage, t, { resolveName: () => undefined, currentUserId: 'me' })
    expect(unresolved).toBe('systemAdminChanged')
    expect(leaks(`${resolved} ${unresolved}`)).toEqual([])
  })

  it('the banner resolves names too: the viewer as "you"…', () => {
    const c = deliver({ content: 'system.admin.promoted:me' })
    expect(banner(c)).toEqual({ conversationId: 'g1', title: 'notificationSystemTitle', body: 'systemAdminPromotedYou' })
  })

  it('…and others from what this tab already knows, never their id', () => {
    qc.setQueryData(['user', BOB], { displayName: 'Bob' })
    const known = deliver()
    expect(banner(known).body).toBe('systemAdminPromoted(Bob)')

    qc.removeQueries({ queryKey: ['user', BOB] })
    const unknown = deliver({ messageId: 'm-10', createdAt: '2026-10-11T08:01:00Z' })
    expect(banner(unknown).body).toBe('systemAdminChanged')
    expect(leaks(`${banner(known).title} ${banner(known).body} ${banner(unknown).body}`)).toEqual([])
  })

  it('a notice from the server itself (senderId "system")', () => {
    const c = deliver({ senderId: 'system', senderName: 'system', content: 'system.group.created' })
    expect(banner(c)).toEqual({ conversationId: 'g1', title: 'notificationSystemTitle', body: 'systemGroupCreated' })
    expect(row().lastMessage).toMatchObject({ senderId: 'system', type: 'system' })
    expect(humanizeLastMessage(row().lastMessage, t, { currentUserId: 'me' })).toBe('systemGroupCreated')
  })
})
