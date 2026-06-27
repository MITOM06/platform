'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FAQ_CATEGORIES, type FaqCategory, type FaqItem } from '@/lib/help/faq-data'
import { FaqSearch } from '@/components/help/FaqSearch'
import { FaqAccordion } from '@/components/help/FaqAccordion'

interface FilteredCategory {
  category: FaqCategory
  items: FaqItem[]
}

export default function HelpPage() {
  const t = useTranslations('help')
  const [query, setQuery] = useState('')

  const trimmedQuery = query.trim().toLowerCase()
  const isSearching = trimmedQuery.length > 0

  const filtered = useMemo<FilteredCategory[]>(() => {
    if (!isSearching) {
      return FAQ_CATEGORIES.map((category) => ({ category, items: category.items }))
    }
    const match = (key: string) => t(key).toLowerCase().includes(trimmedQuery)
    return FAQ_CATEGORIES.map((category) => ({
      category,
      items: category.items.filter((i) => match(i.questionKey) || match(i.answerKey)),
    })).filter((c) => c.items.length > 0)
  }, [isSearching, trimmedQuery, t])

  const hasResults = filtered.length > 0

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-pon-cyan/5 blur-3xl pointer-events-none dark:bg-pon-cyan/8" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-pon-peach/5 blur-3xl pointer-events-none dark:bg-pon-peach/8" />

          <div className="relative max-w-3xl mx-auto px-6 py-6 pb-24 md:pb-12">
            <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-background/80 backdrop-blur-md">
              <FaqSearch value={query} onChange={setQuery} />
            </div>

            <div className="mt-6">
              {hasResults ? (
                filtered.map(({ category, items }) => (
                  <FaqAccordion
                    key={category.id}
                    category={category}
                    items={items}
                    hideHeader={isSearching}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <span className="text-4xl" role="img" aria-hidden="true">
                    🔍
                  </span>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {t('noResults', { query: query.trim() })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
