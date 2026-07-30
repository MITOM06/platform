'use client'

import { useTranslations } from 'next-intl'

export function ChatTypingIndicator() {
  const t = useTranslations('chat')
  return (
    <div className="flex items-center justify-start ml-2 mb-2 mt-1 motion-safe:pon-enter">
      <div className="bg-card border border-border/15 px-3.5 py-2.5 rounded-[14px] flex items-center gap-2 max-w-fit">
        <span className="text-xs font-medium text-muted-foreground">{t('typingIndicator')}</span>
        <div className="flex space-x-1 items-center h-4">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  )
}
