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
