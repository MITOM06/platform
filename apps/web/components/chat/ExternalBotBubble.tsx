'use client'

import { useTranslations } from 'next-intl'
import { useAssistant } from '@/lib/hooks/use-assistant'
import type { Message } from '@/lib/api/types'

/**
 * Renders a message from a Bot Factory personal assistant (`senderId` starts
 * with `extbot:`). The display name + avatar come from `useAssistant()`, NOT a
 * user lookup — the bot is not a real user. Left-aligned like the `@AI` bubble;
 * no reactions / read receipts. Flat accent avatar — the old violet→teal
 * gradient was both a gradient and a second accent (UI-REDESIGN-DIRECTION.md
 * §2 rules 1-2). Mirrors Flutter's `_ExternalBotAvatar` in ai_message_parts.dart.
 */
export function ExternalBotBubble({ message }: { message: Message }) {
  const { data: assistant } = useAssistant()
  const t = useTranslations('assistant')
  const name = assistant?.name ?? t('defaultName')

  return (
    <div className="flex items-start gap-2">
      <div
        className="size-8 rounded-full bg-primary
                   flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0"
      >
        {name[0]?.toUpperCase() ?? '🤖'}
      </div>
      <div className="flex flex-col gap-1 max-w-[70%]">
        <span className="text-xs text-muted-foreground font-medium pl-1">{name}</span>
        <div
          className="bg-muted/70 text-foreground border border-border/50 rounded-[14px] rounded-tl-[4px]
                     px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}
