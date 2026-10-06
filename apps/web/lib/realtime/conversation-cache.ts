import type { QueryClient } from '@tanstack/react-query'
import {
  SHARED_CONVERSATION_FIELDS,
  type Conversation,
  type ConversationsResponse,
  type LastMessage,
  type Message,
} from '@/lib/api/types'

/**
 * TanStack cache rules for conversation events (chat-service contract, HANDOFF §5.3).
 *
 * - Topic `CONVERSATION_UPDATED` carries only the SHARED fields — never the
 *   viewer's unread / mute / archive / block state — so it is MERGED into the
 *   cached per-user copy. Replacing the copy (the old behaviour) wiped my own
 *   unread badge / mute flag with whatever the server left out.
 * - User-queue `CONVERSATION_UPDATED` is MY full view after a per-user action
 *   (mute, archive, read, …), possibly from another device — it replaces.
 * - A conversation whose `participants` no longer contains me (removed / left)
 *   is dropped from every cache.
 */

export const CONVERSATIONS_KEY = ['conversations'] as const
export const ARCHIVED_CONVERSATIONS_KEY = ['conversations', 'archived'] as const
const BLOCKED_CONVERSATIONS_KEY = ['conversations', 'blocked'] as const
const LEGACY_BLOCKED_KEY = ['blocked-conversations'] as const

const LIST_KEYS = [CONVERSATIONS_KEY, ARCHIVED_CONVERSATIONS_KEY, BLOCKED_CONVERSATIONS_KEY] as const

const conversationKey = (id: string) => ['conversation', id] as const

/** Only the fields every member shares (a defensive copy of the topic payload). */
export function pickSharedFields(source: Partial<Conversation>): Partial<Conversation> {
  const out: Partial<Conversation> = {}
  for (const field of SHARED_CONVERSATION_FIELDS) {
    if (field in source) {
      ;(out as Record<string, unknown>)[field] = source[field]
    }
  }
  return out
}

/** Merge a shared (topic) payload into my cached copy, keeping my viewer state. */
export function mergeSharedConversation(
  existing: Conversation,
  shared: Partial<Conversation>,
): Conversation {
  return { ...existing, ...pickSharedFields(shared) }
}

/** True while `userId` is still a participant of `conversation`. */
export function isParticipant(
  conversation: Pick<Conversation, 'participants'>,
  userId: string | undefined,
): boolean {
  if (!userId) return true
  return Array.isArray(conversation.participants) && conversation.participants.includes(userId)
}

/** Muted right now? A timed mute whose expiry has passed no longer counts. */
export function isConversationMuted(
  conversation: Pick<Conversation, 'isMuted' | 'muteExpiresAt'> | undefined,
  now: number = Date.now(),
): boolean {
  if (!conversation?.isMuted) return false
  const expires = conversation.muteExpiresAt
  if (typeof expires === 'number' && expires > 0 && expires <= now) return false
  return true
}

function byNewestActivity(a: Conversation, b: Conversation): number {
  const at = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0
  const bt = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0
  return bt - at
}

function patchList(
  queryClient: QueryClient,
  key: readonly unknown[],
  fn: (list: Conversation[]) => Conversation[],
): void {
  queryClient.setQueryData<ConversationsResponse>(key, (old) =>
    old ? { ...old, content: fn(old.content) } : old,
  )
}

function listContains(queryClient: QueryClient, key: readonly unknown[], id: string): boolean {
  const data = queryClient.getQueryData<ConversationsResponse>(key)
  return data?.content.some((c) => c.id === id) ?? false
}

/** The cached copy of a conversation (detail query first, then any list). */
export function findCachedConversation(
  queryClient: QueryClient,
  id: string,
): Conversation | undefined {
  const one = queryClient.getQueryData<Conversation>(conversationKey(id))
  if (one) return one
  for (const key of LIST_KEYS) {
    const hit = queryClient.getQueryData<ConversationsResponse>(key)?.content.find((c) => c.id === id)
    if (hit) return hit
  }
  return undefined
}

/** Remove a conversation (and its thread) from every cache. */
export function dropConversation(queryClient: QueryClient, id: string): void {
  for (const key of LIST_KEYS) patchList(queryClient, key, (list) => list.filter((c) => c.id !== id))
  queryClient.removeQueries({ queryKey: conversationKey(id), exact: true })
  queryClient.removeQueries({ queryKey: ['messages', id], exact: true })
}

export type ConversationUpdateOutcome = 'removed' | 'merged' | 'unknown'

/**
 * Apply a topic (shared) `CONVERSATION_UPDATED`. Returns `'removed'` when I am no
 * longer a participant (caller leaves the page if it is open), `'unknown'` when no
 * cache held it yet (the list is refetched so a newly joined chat appears).
 */
export function applySharedConversationUpdate(
  queryClient: QueryClient,
  shared: Conversation,
  currentUserId: string | undefined,
): ConversationUpdateOutcome {
  if (!shared?.id) return 'unknown'
  if (!isParticipant(shared, currentUserId)) {
    dropConversation(queryClient, shared.id)
    return 'removed'
  }
  let found = false
  const one = queryClient.getQueryData<Conversation>(conversationKey(shared.id))
  if (one) {
    queryClient.setQueryData(conversationKey(shared.id), mergeSharedConversation(one, shared))
    found = true
  }
  for (const key of LIST_KEYS) {
    if (!listContains(queryClient, key, shared.id)) continue
    found = true
    patchList(queryClient, key, (list) =>
      list
        .map((c) => (c.id === shared.id ? mergeSharedConversation(c, shared) : c))
        .sort(byNewestActivity),
    )
  }
  if (!found) {
    queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY, exact: true })
    return 'unknown'
  }
  return 'merged'
}

/**
 * Apply MY full view from the user queue (mute / archive / read / block …, maybe
 * done on another device). Moves the row between the main and Archived lists.
 */
export function applyOwnConversationUpdate(
  queryClient: QueryClient,
  full: Conversation,
  currentUserId: string | undefined,
): ConversationUpdateOutcome {
  if (!full?.id) return 'unknown'
  if (!isParticipant(full, currentUserId)) {
    dropConversation(queryClient, full.id)
    return 'removed'
  }
  const previous = findCachedConversation(queryClient, full.id)
  if (queryClient.getQueryData<Conversation>(conversationKey(full.id))) {
    queryClient.setQueryData(conversationKey(full.id), full)
  }

  const replace = (list: Conversation[]) => list.map((c) => (c.id === full.id ? full : c))
  if (listContains(queryClient, CONVERSATIONS_KEY, full.id)) {
    patchList(queryClient, CONVERSATIONS_KEY, replace)
  } else if (!full.isArchived && !full.isBlocked) {
    // Unarchived / restored on another device: the main list must pull it in.
    queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY, exact: true })
  }

  if (full.isArchived) {
    if (listContains(queryClient, ARCHIVED_CONVERSATIONS_KEY, full.id)) {
      patchList(queryClient, ARCHIVED_CONVERSATIONS_KEY, replace)
    } else {
      queryClient.invalidateQueries({ queryKey: ARCHIVED_CONVERSATIONS_KEY, exact: true })
    }
  } else {
    patchList(queryClient, ARCHIVED_CONVERSATIONS_KEY, (list) => list.filter((c) => c.id !== full.id))
  }

  if ((previous?.isBlocked ?? false) !== (full.isBlocked ?? false)) {
    queryClient.invalidateQueries({ queryKey: BLOCKED_CONVERSATIONS_KEY })
    queryClient.invalidateQueries({ queryKey: LEGACY_BLOCKED_KEY })
  }
  return previous ? 'merged' : 'unknown'
}

/** The list preview for a freshly received / sent message. */
export function lastMessageOf(message: Message): LastMessage {
  return {
    content: message.content,
    senderId: message.senderId,
    createdAt: message.createdAt,
    messageId: message.id,
    type: message.type,
    recalled: !!message.recalled,
  }
}

/**
 * A message was recalled: if it is the list preview of its conversation, flip the
 * preview to the recalled label right away (the server also re-broadcasts the
 * refreshed `lastMessage` in a shared CONVERSATION_UPDATED).
 */
export function markPreviewRecalled(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
): void {
  const recall = (c: Conversation): Conversation =>
    c.id === conversationId && c.lastMessage?.messageId === messageId
      ? { ...c, lastMessage: { ...c.lastMessage, content: '', recalled: true } }
      : c
  for (const key of LIST_KEYS) patchList(queryClient, key, (list) => list.map(recall))
  const one = queryClient.getQueryData<Conversation>(conversationKey(conversationId))
  if (one) queryClient.setQueryData(conversationKey(conversationId), recall(one))
}

/**
 * A user-queue `NEW_MESSAGE` / `MENTIONED_YOU` for a chat that is not open: move
 * its row to the top with the new preview (and +1 unread unless I am looking at
 * it) instead of refetching the whole list. Needs the event's `messageId` +
 * `createdAt`; returns false when the row is not cached (caller refetches).
 */
export function applyIncomingPreview(
  queryClient: QueryClient,
  event: {
    conversationId: string
    messageId?: string
    createdAt?: string
    senderId?: string
    content?: string
    messageType?: string
  },
  viewing: boolean,
): boolean {
  const { conversationId, messageId, createdAt } = event
  if (!messageId || !createdAt || !Number.isFinite(Date.parse(createdAt))) return false
  const list = queryClient.getQueryData<ConversationsResponse>(CONVERSATIONS_KEY)
  const conv = list?.content.find((c) => c.id === conversationId)
  if (!list || !conv) return false
  // Already applied (the open thread or a duplicate frame), or older than the row.
  if (conv.lastMessage?.messageId === messageId) return true
  if (conv.lastMessageAt && Date.parse(conv.lastMessageAt) > Date.parse(createdAt)) return true
  const updated: Conversation = {
    ...conv,
    lastMessage: {
      content: event.content ?? '',
      senderId: event.senderId ?? '',
      createdAt,
      messageId,
      type: event.messageType ?? null,
      recalled: false,
    },
    lastMessageAt: createdAt,
    unreadCount: viewing ? conv.unreadCount : (conv.unreadCount ?? 0) + 1,
  }
  queryClient.setQueryData<ConversationsResponse>(CONVERSATIONS_KEY, {
    ...list,
    content: [updated, ...list.content.filter((c) => c.id !== conversationId)],
  })
  return true
}
