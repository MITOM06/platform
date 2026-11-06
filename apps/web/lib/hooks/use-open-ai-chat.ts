'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { aiThreadsApi } from '@/lib/api/ai-threads'
import { AI_BOT_ID } from '@/lib/constants'
import { AI_THREADS_KEY, upsertAiThread } from '@/lib/realtime/conversation-cache'
import type { Conversation } from '@/lib/api/types'

export { AI_BOT_ID }

// Shared "Start chat with PON AI" logic (AI Hub hero CTA). Opens the most recent
// AI thread, or creates the first one when the user has none.
export function useOpenAiChat() {
  const t = useTranslations('chat')
  const router = useRouter()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const openAiChat = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      const threads = await queryClient.fetchQuery<Conversation[]>({
        queryKey: AI_THREADS_KEY,
        queryFn: () => aiThreadsApi.list(),
        staleTime: 0,
      })
      let target = threads[0]
      if (!target) {
        target = await aiThreadsApi.create()
        upsertAiThread(queryClient, target)
      }
      router.push(`/conversations/${target.id}`)
    } catch {
      toast.error(t('aiOpenError'))
    } finally {
      setLoading(false)
    }
  }, [loading, queryClient, router, t])

  return { openAiChat, loading }
}
