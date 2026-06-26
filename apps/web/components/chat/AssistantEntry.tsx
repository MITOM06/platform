'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Settings } from 'lucide-react'
import { useAssistant } from '@/lib/hooks/use-assistant'
import { useOpenAssistantChat } from '@/lib/hooks/use-open-assistant-chat'

/**
 * Pinned sidebar entry for the member's Bot Factory personal assistant.
 * - No assistant registered → a "Set up assistant" row linking to the wizard.
 * - Assistant present → opens (or creates) the 1-1 chat, plus a settings gear.
 * Mirrors Flutter `AssistantEntryTile`.
 */
export function AssistantEntry() {
  const { data: assistant } = useAssistant()
  const router = useRouter()
  const t = useTranslations('assistant')
  const tSettings = useTranslations('assistantSettings')
  const tCommon = useTranslations('common')
  const openChat = useOpenAssistantChat()
  const [loading, setLoading] = useState(false)

  if (!assistant) {
    return (
      <Link
        href="/assistant/setup"
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                   hover:bg-accent transition-[background-color,transform] duration-[180ms]
                   active:scale-[0.98] text-left mb-1 motion-safe:pon-enter"
        aria-label={t('setupCta')}
      >
        <div
          className="size-10 rounded-full border-2 border-dashed border-muted-foreground/40
                     flex items-center justify-center text-muted-foreground shrink-0"
        >
          <Plus className="size-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate">{t('setupCta')}</span>
          <span className="text-xs text-muted-foreground truncate">{t('subtitle')}</span>
        </div>
      </Link>
    )
  }

  async function handleOpen() {
    if (loading) return
    setLoading(true)
    try {
      await openChat(assistant!.botUserId)
    } catch {
      toast.error(tCommon('somethingWrong'))
    } finally {
      setLoading(false)
    }
  }

  function handleSettings(e: React.MouseEvent) {
    e.stopPropagation()
    router.push('/assistant/settings')
  }

  return (
    <div className="relative mb-1 motion-safe:pon-enter">
      <button
        onClick={handleOpen}
        disabled={loading}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                   hover:bg-accent transition-[background-color,transform] duration-[180ms]
                   active:scale-[0.98] text-left disabled:opacity-60 pr-12"
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
      <button
        onClick={handleSettings}
        className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-lg
                   flex items-center justify-center text-muted-foreground
                   hover:bg-background hover:text-foreground transition-colors"
        aria-label={tSettings('title')}
      >
        <Settings className="size-4" />
      </button>
    </div>
  )
}
