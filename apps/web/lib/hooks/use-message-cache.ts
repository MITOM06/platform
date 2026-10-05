'use client'

import { useCallback } from 'react'
import { useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import type {
  AiSource,
  Conversation,
  ConversationsResponse,
  Message,
  MessagesResponse,
} from '@/lib/api/types'
import { CONVERSATIONS_KEY, lastMessageOf, markPreviewRecalled } from '@/lib/realtime/conversation-cache'

type Pages = InfiniteData<MessagesResponse>

function mapMessages(old: Pages, fn: (m: Message) => Message): Pages {
  return {
    ...old,
    pages: old.pages.map((page) => ({ ...page, content: page.content.map(fn) })),
  }
}

/**
 * Merge server copies into a cached thread (reconnect re-sync). Messages already
 * cached are replaced by the server version — that is how edits, recalls and
 * reactions made while the socket was down show up — keeping locally attached
 * RAG sources; unknown ones are prepended to page 0 (newest first).
 */
export function reconcileThread(old: Pages | undefined, incoming: Message[]): Pages | undefined {
  // The same message can arrive from both the catch-up and the latest-page fetch.
  const fresh = [...new Map(incoming.map((m) => [m.id, m])).values()]
  if (fresh.length === 0) return old
  if (!old) {
    const newestFirst = [...fresh].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    return {
      pages: [{ content: newestFirst, page: 0, size: newestFirst.length, totalElements: newestFirst.length, hasNext: false }],
      pageParams: [undefined],
    }
  }
  const byId = new Map(fresh.map((m) => [m.id, m]))
  const seen = new Set<string>()
  const replaced = mapMessages(old, (m) => {
    const server = byId.get(m.id)
    if (!server) return m
    seen.add(m.id)
    return { ...m, ...server, sources: server.sources ?? m.sources }
  })
  const added = fresh
    .filter((m) => !seen.has(m.id))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  if (added.length === 0) return replaced
  return {
    ...replaced,
    pages: replaced.pages.map((page, i) =>
      i === 0 ? { ...page, content: [...added, ...page.content] } : page,
    ),
  }
}

/** Refresh the conversation-list preview for a message without refetching the list. */
function bumpListPreview(queryClient: QueryClient, incoming: Message): void {
  // On busy threads this fires per message, so invalidating (refetching the
  // whole list) every time was a refetch storm. Fall back to invalidate only
  // when the list cache is empty or doesn't yet contain this conversation
  // (a brand-new thread must be pulled in from the server).
  const existing = queryClient.getQueryData<ConversationsResponse>(CONVERSATIONS_KEY)
  const hasConv = existing?.content.some((c) => c.id === incoming.conversationId) ?? false
  if (!existing || existing.content.length === 0 || !hasConv) {
    queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY, exact: true })
    return
  }
  queryClient.setQueryData<ConversationsResponse>(CONVERSATIONS_KEY, (old) => {
    if (!old) return old
    const idx = old.content.findIndex((c) => c.id === incoming.conversationId)
    if (idx === -1) return old
    const conv = old.content[idx]!
    // Never move a chat back to the top for an OLDER message (catch-up order),
    // and leave the list untouched when this is already its preview (re-sync).
    if (conv.lastMessageAt && Date.parse(conv.lastMessageAt) > Date.parse(incoming.createdAt)) {
      return old
    }
    if (conv.lastMessage?.messageId === incoming.id && conv.lastMessageAt === incoming.createdAt) {
      return old
    }
    const updated: Conversation = {
      ...conv,
      lastMessage: lastMessageOf(incoming),
      lastMessageAt: incoming.createdAt,
    }
    // Re-insert by recency (the server orders by newest activity) instead of
    // blindly moving to the front.
    const rest = old.content.filter((_, i) => i !== idx)
    const at = Date.parse(incoming.createdAt)
    const insertAt = rest.findIndex((c) => !c.lastMessageAt || Date.parse(c.lastMessageAt) <= at)
    const content =
      insertAt === -1 ? [...rest, updated] : [...rest.slice(0, insertAt), updated, ...rest.slice(insertAt)]
    return { ...old, content }
  })
}

/**
 * Direct TanStack Query cache mutations for a conversation's message thread.
 * STOMP events patch the cache here instead of refetching (per web rules).
 */
export function useMessageCache(conversationId: string) {
  const queryClient = useQueryClient()

  // Patch a single message in place.
  const patchMessage = useCallback(
    (messageId: string, patch: Partial<Message>) => {
      queryClient.setQueryData<Pages>(['messages', conversationId], (old) =>
        old ? mapMessages(old, (m) => (m.id === messageId ? { ...m, ...patch } : m)) : old,
      )
    },
    [conversationId, queryClient],
  )

  // A message was recalled: blank it, flip every reply quote of it to the
  // recalled label and update the sidebar preview if it was the last message.
  const recallMessage = useCallback(
    (messageId: string) => {
      queryClient.setQueryData<Pages>(['messages', conversationId], (old) =>
        old
          ? mapMessages(old, (m) => {
              if (m.id === messageId) return { ...m, recalled: true }
              if (m.replyPreview?.messageId === messageId) {
                return { ...m, replyPreview: { ...m.replyPreview, content: '', recalled: true } }
              }
              return m
            })
          : old,
      )
      markPreviewRecalled(queryClient, conversationId, messageId)
    },
    [conversationId, queryClient],
  )

  // Remove a message from the thread ("Delete for me" hides it for this user only).
  const removeMessage = useCallback(
    (messageId: string) => {
      queryClient.setQueryData<Pages>(['messages', conversationId], (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                content: page.content.filter((m) => m.id !== messageId),
              })),
            }
          : old,
      )
    },
    [conversationId, queryClient],
  )

  // Add a reader to a message's readBy (read receipt). De-dupes so the seen-tick
  // flips on without a refetch (mirror Flutter chat_provider).
  const markMessageRead = useCallback(
    (messageId: string, readerId: string) => {
      queryClient.setQueryData<Pages>(['messages', conversationId], (old) =>
        old
          ? mapMessages(old, (m) =>
              m.id === messageId && !(m.readBy ?? []).includes(readerId)
                ? { ...m, readBy: [...(m.readBy ?? []), readerId] }
                : m,
            )
          : old,
      )
    },
    [conversationId, queryClient],
  )

  // Prepend a new message to page[0] (de-duped) and refresh the conversation list.
  const appendMessage = useCallback(
    (incoming: Message) => {
      queryClient.setQueryData<Pages>(['messages', conversationId], (old) => {
        if (!old) {
          return {
            pages: [{ content: [incoming], page: 0, size: 1, totalElements: 1, hasNext: false }],
            pageParams: [undefined],
          }
        }
        const allIds = new Set(old.pages.flatMap((p) => p.content.map((m) => m.id)))
        if (allIds.has(incoming.id)) return old
        return {
          ...old,
          pages: old.pages.map((page, i) =>
            i === 0 ? { ...page, content: [incoming, ...page.content] } : page,
          ),
        }
      })
      bumpListPreview(queryClient, incoming)
    },
    [conversationId, queryClient],
  )

  // Replace cached copies with server ones + add missing (reconnect re-sync).
  const reconcileMessages = useCallback(
    (fresh: Message[]) => {
      if (fresh.length === 0) return
      queryClient.setQueryData<Pages>(['messages', conversationId], (old) => reconcileThread(old, fresh))
      const newest = fresh.reduce((a, b) => (Date.parse(a.createdAt) >= Date.parse(b.createdAt) ? a : b))
      bumpListPreview(queryClient, newest)
    },
    [conversationId, queryClient],
  )

  // Attach RAG citation sources to the most recent AI message that doesn't yet
  // have them. The `AI_STREAM_DONE` event carries sources but the persisted AI
  // message arrives as a separate frame (saved first, DONE second — same topic,
  // FIFO), so on DONE we patch the latest sources-less AI bubble. Returns true
  // when a message was patched; the caller can stash sources for a late message.
  const attachAiSources = useCallback(
    (sources: AiSource[]): boolean => {
      if (sources.length === 0) return false
      let attached = false
      queryClient.setQueryData<Pages>(['messages', conversationId], (old) => {
        if (!old) return old
        // Scan newest-first (page[0] is freshest; content[0] is newest).
        for (const page of old.pages) {
          for (const m of page.content) {
            if (m.type === 'ai' && (m.sources?.length ?? 0) === 0) {
              attached = true
              return mapMessages(old, (x) => (x.id === m.id ? { ...x, sources } : x))
            }
          }
        }
        return old
      })
      return attached
    },
    [conversationId, queryClient],
  )

  return {
    patchMessage,
    recallMessage,
    removeMessage,
    markMessageRead,
    appendMessage,
    reconcileMessages,
    attachAiSources,
  }
}
