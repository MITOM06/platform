'use client'

import { useCallback } from 'react'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import type {
  AiSource,
  Conversation,
  ConversationsResponse,
  Message,
  MessagesResponse,
} from '@/lib/api/types'

/**
 * Direct TanStack Query cache mutations for a conversation's message thread.
 * STOMP events patch the cache here instead of refetching (per web rules).
 */
export function useMessageCache(conversationId: string) {
  const queryClient = useQueryClient()
  const key = ['messages', conversationId] as const

  // Patch a single message in place.
  const patchMessage = useCallback(
    (messageId: string, patch: Partial<Message>) => {
      queryClient.setQueryData<InfiniteData<MessagesResponse>>(key, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            content: page.content.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
          })),
        }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, queryClient],
  )

  // Add a reader to a message's readBy (read receipt). De-dupes so the seen-tick
  // flips on without a refetch (mirror Flutter chat_provider).
  const markMessageRead = useCallback(
    (messageId: string, readerId: string) => {
      queryClient.setQueryData<InfiniteData<MessagesResponse>>(key, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            content: page.content.map((m) =>
              m.id === messageId && !(m.readBy ?? []).includes(readerId)
                ? { ...m, readBy: [...(m.readBy ?? []), readerId] }
                : m,
            ),
          })),
        }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, queryClient],
  )

  // Prepend a new message to page[0] (de-duped) and refresh the conversation list.
  const appendMessage = useCallback(
    (incoming: Message) => {
      queryClient.setQueryData<InfiniteData<MessagesResponse>>(key, (old) => {
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
      // Refresh the conversation-list preview WITHOUT a full refetch: patch the
      // matching conversation's last-message + timestamp and move it to front.
      // On busy threads this fires per message, so invalidating (refetching the
      // whole list) every time was a refetch storm. Fall back to invalidate only
      // when the list cache is empty or doesn't yet contain this conversation
      // (a brand-new thread must be pulled in from the server).
      const existing = queryClient.getQueryData<ConversationsResponse>(['conversations'])
      const hasConv = existing?.content.some((c) => c.id === incoming.conversationId) ?? false
      if (!existing || existing.content.length === 0 || !hasConv) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
        return
      }
      queryClient.setQueryData<ConversationsResponse>(['conversations'], (old) => {
        if (!old) return old
        const idx = old.content.findIndex((c) => c.id === incoming.conversationId)
        if (idx === -1) return old
        const conv = old.content[idx]!
        const updated: Conversation = {
          ...conv,
          lastMessage: {
            content: incoming.content,
            senderId: incoming.senderId,
            createdAt: incoming.createdAt,
          },
          lastMessageAt: incoming.createdAt,
        }
        return {
          ...old,
          content: [updated, ...old.content.filter((_, i) => i !== idx)],
        }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      queryClient.setQueryData<InfiniteData<MessagesResponse>>(key, (old) => {
        if (!old) return old
        // Scan newest-first (page[0] is freshest; content[0] is newest).
        for (const page of old.pages) {
          for (const m of page.content) {
            if (m.type === 'ai' && (m.sources?.length ?? 0) === 0) {
              attached = true
              return {
                ...old,
                pages: old.pages.map((p) => ({
                  ...p,
                  content: p.content.map((x) => (x.id === m.id ? { ...x, sources } : x)),
                })),
              }
            }
          }
        }
        return old
      })
      return attached
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, queryClient],
  )

  return { patchMessage, markMessageRead, appendMessage, attachAiSources }
}
