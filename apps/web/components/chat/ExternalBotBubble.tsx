'use client'

import { useTranslations } from 'next-intl'
import { useAssistant } from '@/lib/hooks/use-assistant'
import type { Message } from '@/lib/api/types'

/**
 * Renders a message from a Bot Factory personal assistant (`senderId` starts
 * with `extbot:`). The display name + avatar come from `useAssistant()`, NOT a
 * user lookup — the bot is not a real user. Left-aligned like the `@AI` bubble
 * but with a distinct violet→teal gradient avatar; no reactions / read receipts.
 */
export function ExternalBotBubble({ message }: { message: Message }) {
  const { data: assistant } = useAssistant()
  const t = useTranslations('assistant')
  const name = assistant?.name ?? t('defaultName')

  return (
    <div className="flex items-start gap-2">
      <div
        className="size-8 rounded-full bg-gradient-to-br from-violet-500 to-teal-400
                   flex items-center justify-center text-white text-xs font-bold shrink-0"
      >
        {name[0]?.toUpperCase() ?? '🤖'}
      </div>
      <div className="flex flex-col gap-1 max-w-[70%]">
        <span className="text-xs text-muted-foreground font-medium pl-1">{name}</span>
        <div
          className="bg-muted/70 text-foreground border border-border/50 rounded-[24px] rounded-tl-none
                     px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-xs"
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}
