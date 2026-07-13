'use client'

import { useTranslations } from 'next-intl'
import { Brain, Lightbulb, MessageSquare } from 'lucide-react'
import { useMyMemory } from '@/lib/hooks/use-ai-context'

export function LearnedFactsSection() {
  const t = useTranslations('aiContext')
  const { data: memory, isLoading } = useMyMemory()

  const hasContent = !!memory && (memory.summary.length > 0 || memory.keyFacts.length > 0)

  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Brain className="size-4 text-muted-foreground" />
        {t('learnedFactsTitle')}
        {hasContent && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <MessageSquare className="size-3" />
            {memory!.messageCount}
          </span>
        )}
      </h2>

      {isLoading && <p className="text-sm text-muted-foreground">{t('loading')}</p>}

      {!isLoading && !hasContent && (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground/60">{t('memoryEmpty')}</p>
          <p className="mt-1 text-xs text-muted-foreground/40">{t('memoryEmptyHint')}</p>
        </div>
      )}

      {!isLoading && hasContent && (
        <div className="space-y-2.5">
          {memory!.summary && (
            <p className="text-sm leading-relaxed text-foreground/90">{memory!.summary}</p>
          )}
          {memory!.keyFacts.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground/70">
                <Lightbulb className="size-3" />
                {t('keyInfo')}
              </p>
              <ul className="space-y-0.5">
                {memory!.keyFacts.map((f, i) => (
                  <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                    • {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
