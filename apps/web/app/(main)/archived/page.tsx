'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { ArchivedConversationList } from '@/components/chat/ArchivedConversationList'

export default function ArchivedChatsPage() {
  const t = useTranslations('archived')
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="h-14 flex items-center px-4 border-b shrink-0 gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="p-4 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            className="pl-9 bg-muted/50 border-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <ArchivedConversationList searchQuery={searchQuery} />
      </div>
    </div>
  )
}
