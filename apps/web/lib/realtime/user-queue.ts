import type { QueryClient } from '@tanstack/react-query'
import type { UserQueueEvent } from '@/lib/api/types'
import { chatCodeMessage } from '@/lib/api/chat-errors'
import { humanizeMessagePreview } from '@/lib/system-messages'
import { safeDisplayName } from '@/lib/chat/names'
import {
  CONVERSATIONS_KEY,
  applyIncomingPreview,
  applyOwnConversationUpdate,
  findCachedConversation,
  isConversationMuted,
} from './conversation-cache'

type Translate = (key: string, values?: Record<string, string | number>) => string

const KNOWN_TYPES = new Set([
  'NEW_MESSAGE', 'MENTIONED_YOU', 'RATE_LIMITED', 'MESSAGE_REJECTED', 'CONVERSATION_UPDATED',
  'CLAIMS_CHANGED',
])

/** Parse a `/user/queue/notifications` frame body; unknown / malformed → null. */
export function parseUserQueueEvent(body: string): UserQueueEvent | null {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    if (!parsed || typeof parsed.type !== 'string' || !KNOWN_TYPES.has(parsed.type)) return null
    if (parsed.type === 'CONVERSATION_UPDATED') {
      const conv = parsed.conversation as { id?: unknown } | undefined
      if (!conv || typeof conv.id !== 'string') return null
    }
    if ((parsed.type === 'NEW_MESSAGE' || parsed.type === 'MENTIONED_YOU') &&
        typeof parsed.conversationId !== 'string') {
      return null
    }
    return parsed as unknown as UserQueueEvent
  } catch {
    return null
  }
}

export interface IncomingNotification {
  conversationId: string
  title: string
  body: string
}

export interface UserQueueContext {
  queryClient: QueryClient
  currentUserId?: string
  /** `layout` namespace. */
  t: Translate
  /** `chat` namespace. */
  tChat: Translate
  notificationsEnabled: () => boolean
  isViewingConversation: (conversationId: string) => boolean
  showNotification: (notification: IncomingNotification) => void
  showError: (message: string) => void
  onRemovedFromConversation: (conversationId: string) => void
  onClaimsChanged: () => void
}

/**
 * Title + body of a message banner. Never raw: an unresolved sender (the server
 * falls back to the user id) becomes "Someone", `system.*` codes are humanized,
 * AI markdown is flattened and attachments become a localized label.
 */
export function buildMessageNotification(
  event: Extract<UserQueueEvent, { type: 'NEW_MESSAGE' | 'MENTIONED_YOU' }>,
  t: Translate,
  tChat: Translate,
): IncomingNotification {
  const content = event.content ?? ''
  const isSystemEvent = event.senderName === 'system' || content.startsWith('system.')
  if (isSystemEvent) {
    return {
      conversationId: event.conversationId,
      title: t('notificationSystemTitle'),
      body: content
        ? humanizeMessagePreview(content, event.messageType, tChat, { short: true })
        : t('notificationFallback'),
    }
  }
  const name = safeDisplayName(event.senderName, event.senderId) ?? tChat('someone')
  const type = event.messageType
  const body =
    type && type !== 'text' && type !== 'ai'
      ? t('notificationAttachment')
      : (content && humanizeMessagePreview(content, type, tChat, { short: true })) ||
        t('notificationFallback')
  return { conversationId: event.conversationId, title: t('notificationTitle', { name }), body }
}

/** Dispatch one user-queue event. */
export function handleUserQueueEvent(event: UserQueueEvent, ctx: UserQueueContext): void {
  switch (event.type) {
    case 'RATE_LIMITED':
      ctx.showError(ctx.t('rateLimitError'))
      return
    case 'MESSAGE_REJECTED':
      ctx.showError(chatCodeMessage({ code: event.code }, ctx.tChat, 'sendMessageError'))
      return
    case 'CONVERSATION_UPDATED': {
      const outcome = applyOwnConversationUpdate(ctx.queryClient, event.conversation, ctx.currentUserId)
      if (outcome === 'removed') ctx.onRemovedFromConversation(event.conversation.id)
      return
    }
    case 'CLAIMS_CHANGED':
      ctx.onClaimsChanged()
      return
    case 'NEW_MESSAGE':
    case 'MENTIONED_YOU': {
      // Keep sidebar previews / unread badges live for chats that are not open
      // (the open one is kept live by its own topic subscription) — regardless
      // of the notification preference or mute.
      // The event carries messageId + createdAt: update the row in place; only
      // an unknown chat (or an older server) needs the list refetched.
      if (
        !applyIncomingPreview(
          ctx.queryClient,
          event,
          ctx.isViewingConversation(event.conversationId),
        )
      ) {
        ctx.queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY })
      }
      if (!ctx.notificationsEnabled()) return
      if (ctx.isViewingConversation(event.conversationId)) return
      // Muted chats stay silent (mirrors the server, which skips their push).
      if (isConversationMuted(findCachedConversation(ctx.queryClient, event.conversationId))) return
      ctx.showNotification(buildMessageNotification(event, ctx.t, ctx.tChat))
      return
    }
  }
}
