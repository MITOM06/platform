'use client'

import { useTranslations } from 'next-intl'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { FaqCategory, FaqItem } from '@/lib/help/faq-data'

interface FaqAccordionProps {
  category: FaqCategory
  /** Pre-filtered items to render (parent owns the search filtering). */
  items: FaqItem[]
  /** Hide the category header (used in flat search-results mode). */
  hideHeader?: boolean
}

export function FaqAccordion({ category, items, hideHeader }: FaqAccordionProps) {
  const t = useTranslations('help')
  const Icon = category.icon

  if (items.length === 0) return null

  return (
    <section className="mb-8 last:mb-0">
      {!hideHeader && (
        <div className="mb-2 flex items-center gap-2 border-b pb-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-pon-cyan/10">
            <Icon className="size-4 text-pon-cyan" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">{t(category.titleKey)}</h2>
        </div>
      )}

      <Accordion type="multiple" className="w-full">
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger className="font-medium">{t(item.questionKey)}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {t(item.answerKey)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
