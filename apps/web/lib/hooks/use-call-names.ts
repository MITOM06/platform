'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authService } from '@/lib/api/auth'
import { useNicknames } from '@/lib/nicknames'

/**
 * Resolve call-participant userIds → display names client-side.
 *
 * chat-service is userId-only by design: the `call.started` / `call.roster`
 * broadcasts and the `call-ring` signal carry the raw userId in their
 * `displayName` / `startedByName` fields. This hook mirrors how the chat UI
 * resolves sender names (conversation nickname → cached `['user', id]` profile),
 * batch-loading any missing profiles in ONE request (like ConversationList) and
 * seeding the per-id cache so other `useUser` consumers reuse it.
 *
 * Returns a resolver `(userId) => name` with a graceful fallback while a name is
 * still loading.
 */
export function useCallNames(
  conversationId: string | null | undefined,
  userIds: string[],
): (userId: string, fallback?: string) => string | undefined {
  const queryClient = useQueryClient()
  // Reactively re-resolve when nicknames change for this conversation.
  const nicknames = useNicknames(conversationId ?? '')

  useEffect(() => {
    const ids = [...new Set(userIds.filter(Boolean))]
    const missing = ids.filter((id) => !queryClient.getQueryData(['user', id]))
    if (missing.length === 0) return
    let cancelled = false
    authService
      .getUsers(missing)
      .then((users) => {
        if (cancelled) return
        users.forEach((u) => queryClient.setQueryData(['user', u.id], u))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userIds, queryClient])

  return (userId: string, fallback?: string) => {
    const nick = nicknames[userId]
    if (nick) return nick
    const cached = queryClient.getQueryData<{ displayName?: string }>(['user', userId])
    return cached?.displayName ?? fallback
  }
}
