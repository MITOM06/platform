'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useAssistant } from '@/lib/hooks/use-assistant'
import { chatService } from '@/lib/api/chat'

/**
 * Pinned sidebar entry that opens (or creates) the member's 1-1 conversation
 * with their Bot Factory personal assistant. Hidden gracefully when no
 * assistant is registered (GET /api/assistant/me → 404, so `data` is null).
 * Mirrors Flutter `AssistantEntryTile`.
 */
export function AssistantEntry() {
  const { data: assistant } = useAssistant()
  const router = useRouter()
  const t = useTranslations('assistant')
  const tCommon = useTranslations('common')
  const [loading, setLoading] = useState(false)

  if (!assistant) return null

  async function handleOpen() {
    if (loading) return
    setLoading(true)
    try {
      const conv = await chatService.createConversation(assistant!.botUserId)
      router.push(`/conversations/${conv.id}`)
    } catch (err) {
      // 409 = conversation already exists — navigate to it (idempotent open).
      const status = (err as { response?: { status?: number } })?.response?.status
      const existingId = (err as { response?: { data?: { conversationId?: string } } })
        ?.response?.data?.conversationId
      if (status === 409 && existingId) {
        router.push(`/conversations/${existingId}`)
        return
      }
      toast.error(tCommon('somethingWrong'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleOpen}
      disabled={loading}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                 hover:bg-accent transition-[background-color,transform] duration-[180ms]
                 active:scale-[0.98] text-left mb-1 disabled:opacity-60
                 motion-safe:pon-enter"
      aria-label={t('openChat')}
    >
      <div
        className="relative size-10 rounded-full bg-gradient-to-br from-violet-500 to-teal-400
                   flex items-center justify-center text-white font-bold text-sm shrink-0
                   overflow-hidden"
      >
        {/* Signature ambient sheen sweep — the one bold motion moment. */}
        <span aria-hidden className="motion-safe:pon-sheen" />
        <span className="relative">{assistant.name[0]?.toUpperCase() ?? '🤖'}</span>
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold truncate">{assistant.name}</span>
        <span className="text-xs text-muted-foreground truncate">{t('subtitle')}</span>
      </div>
    </button>
  )
}
