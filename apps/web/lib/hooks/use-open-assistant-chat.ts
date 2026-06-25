// lib/hooks/use-open-assistant-chat.ts
'use client'
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { chatService } from '@/lib/api/chat'

/**
 * Opens (or creates) the member's 1-1 conversation with their personal
 * assistant and navigates to it. Reuses the 409→existing-conversation
 * fallback so a re-open is idempotent. Mirrors Flutter `AssistantEntryTile`.
 *
 * Returns the navigation promise; throws on unexpected failures so the
 * caller can surface a toast.
 */
export function useOpenAssistantChat() {
  const router = useRouter()

  return useCallback(
    async (botUserId: string): Promise<void> => {
      try {
        const conv = await chatService.createConversation(botUserId)
        router.push(`/conversations/${conv.id}`)
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status
        const existingId = (
          err as { response?: { data?: { conversationId?: string } } }
        )?.response?.data?.conversationId
        if (status === 409 && existingId) {
          router.push(`/conversations/${existingId}`)
          return
        }
        throw err
      }
    },
    [router],
  )
}
