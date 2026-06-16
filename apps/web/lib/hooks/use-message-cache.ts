'use client'

import { useCallback } from 'react'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import type { Message, MessagesResponse } from '@/lib/api/types'

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
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, queryClient],
  )

  return { patchMessage, markMessageRead, appendMessage }
}
