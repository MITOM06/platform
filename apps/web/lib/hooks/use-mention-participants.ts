'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authService } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth.store'
import type { Conversation } from '@/lib/api/types'
import { isHumanUserId } from '@/lib/hooks/use-display-names'
import { safeDisplayName } from '@/lib/chat/names'

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

  // Humans only: the AI bot and Bot Factory assistants (`extbot:*`) have no
  // auth-service profile — sending their ids broke the whole batch lookup.
  const mentionableIds = (conversation?.type === 'group'
    ? conversation.participants.filter((p) => p !== currentUserId && isHumanUserId(p))
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

  // Only members whose name is known: inserting `@<userId>` leaked the raw id
  // into the message. Unresolved members appear once their profile loads.
  return mentionableIds.flatMap((uid) => {
    const cached = queryClient.getQueryData<{ displayName?: string }>(['user', uid])
    const name = safeDisplayName(cached?.displayName, uid)
    return name ? [{ id: uid, name }] : []
  })
}
