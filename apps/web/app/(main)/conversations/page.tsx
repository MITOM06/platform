'use client'

import { useTranslations } from 'next-intl'

export default function ConversationsPage() {
  const t = useTranslations('conversations')
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <p>{t('selectPrompt')}</p>
    </div>
  )
}
