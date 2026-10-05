'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/store/auth.store'
import { useUser } from '@/lib/hooks/use-user'
import { useAssistantName } from '@/lib/hooks/use-capabilities'
import { getNickname, useNickname } from '@/lib/nicknames'
import { safeDisplayName } from '@/lib/chat/names'
import { AI_BOT_ID } from '@/lib/constants'
import { isExternalBot } from '@/lib/api/types'

/** A real user id worth a profile lookup (not a bot / system / empty id). */
export function isHumanUserId(id: string | undefined | null): id is string {
  return !!id && id !== AI_BOT_ID && id !== 'system' && !isExternalBot(id)
}

/**
 * Synchronous user-id → display-name resolver for system-message actors and
 * previews: current user → "You", the native AI → its workspace name, then the
 * conversation nickname, then the cached profile. Returns undefined when the name
 * is not known yet — callers fall back to a generic label, NEVER the id.
 */
export function useNameResolver(conversationId?: string): (userId: string) => string | undefined {
  const t = useTranslations('chat')
  const queryClient = useQueryClient()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const assistantName = useAssistantName()
  return useCallback(
    (userId: string) => {
      if (!userId) return undefined
      if (userId === currentUserId) return t('you')
      if (userId === AI_BOT_ID) return assistantName ?? t('aiAssistant')
      const nick = conversationId ? getNickname(conversationId, userId) : undefined
      if (nick) return nick
      const cached = queryClient.getQueryData<{ displayName?: string }>(['user', userId])
      return safeDisplayName(cached?.displayName, userId)
    },
    [assistantName, conversationId, currentUserId, queryClient, t],
  )
}

/**
 * Display name of a message sender, for the name label above group bubbles and the
 * "Reply to …" banner. Chat-service messages carry no sender name, so it is
 * resolved here (nickname → profile); the AI bot uses its workspace name.
 * Returns '' while the profile is loading and a localized "Member" if it fails.
 */
export function useSenderDisplayName(
  senderId: string | undefined,
  conversationId: string | undefined,
  enabled = true,
): string {
  const t = useTranslations('chat')
  const nickname = useNickname(conversationId ?? '', senderId)
  const assistantName = useAssistantName()
  const lookup = enabled && isHumanUserId(senderId) && !nickname ? senderId : undefined
  const { data: user, isError } = useUser(lookup)
  if (!enabled || !senderId) return ''
  if (nickname) return nickname
  if (senderId === AI_BOT_ID) return assistantName ?? t('aiAssistant')
  if (!isHumanUserId(senderId)) return t('memberDefault')
  const name = safeDisplayName(user?.displayName, senderId)
  if (name) return name
  return isError || user ? t('memberDefault') : ''
}
