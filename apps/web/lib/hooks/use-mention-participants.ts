'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authService } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth.store'
import type { Conversation } from '@/lib/api/types'

const AI_BOT_ID = 'ai-bot-000000000000000000000001'

/**
 * Resolves group participant userIds → display names for @mentions. Mirrors
 * Flutter (mention_list.dart) which filters + inserts by display name. The AI
 * bot and self are excluded from the candidate list.
 *
 * Extracted from MessageInput.tsx to keep the component under the 400-line
 * limit; behaviour is identical to the inline version.
 */
export function useMentionParticipants(
  conversation?: Conversation,
): { id: string; name: string }[] {
  const currentUserId = useAuthStore((s) => s.user?.id)
  const queryClient = useQueryClient()

  const mentionableIds = (conversation?.type === 'group'
    ? conversation.participants.filter(
        (p) => p !== currentUserId && p !== AI_BOT_ID,
      )
    : []
  )
  // Resolve all mentionable participants in ONE batched request (was an N+1
  // useQueries fanning out one request per participant → 429s), then seed the
  // per-id `['user', id]` cache so other consumers (useUser) hit cache too.
  const mentionKey = [...mentionableIds].sort().join(',')
  const { data: batchedUsers } = useQuery({
    queryKey: ['users-batch', mentionKey],
    queryFn: () => authService.getUsers(mentionableIds),
    enabled: mentionableIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
  useEffect(() => {
    batchedUsers?.forEach((u) => queryClient.setQueryData(['user', u.id], u))
  }, [batchedUsers, queryClient])

  return mentionableIds.map((uid) => {
    const cached = queryClient.getQueryData<{ displayName?: string }>(['user', uid])
    return { id: uid, name: cached?.displayName ?? uid }
  })
}
