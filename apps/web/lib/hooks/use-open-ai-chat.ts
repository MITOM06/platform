'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { chatService } from '@/lib/api/chat'

export const AI_BOT_ID = 'ai-bot-000000000000000000000001'

// Shared "Start chat with PON AI" logic used by both the AI Hub hero CTA and
// (historically) the conversation-list Bot button. Creates the AI conversation
// and navigates to it, with the 409 (already-exists) fallback that navigates to
// the existing conversation. Mirrors Flutter `getOrCreateConversation(kAiBotUserId)`.
export function useOpenAiChat() {
  const t = useTranslations('chat')
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const openAiChat = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      const conv = await chatService.createConversation(AI_BOT_ID)
      router.push(`/conversations/${conv.id}`)
    } catch (err) {
      // 409 = conversation already exists — find and navigate to it.
      const isConflict = (err as { response?: { status?: number } })?.response?.status === 409
      if (isConflict) {
        const body = (err as { response?: { data?: { conversationId?: string } } })?.response?.data
        if (body?.conversationId) {
          router.push(`/conversations/${body.conversationId}`)
          return
        }
      }
      toast.error(t('aiOpenError'))
    } finally {
      setLoading(false)
    }
  }, [loading, router, t])

  return { openAiChat, loading }
}
