'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'
import { useMyAiContext } from '@/lib/hooks/use-ai-context'
import { IdentitySection } from '@/components/ai/IdentitySection'
import { ResponseStyleSection } from '@/components/ai/ResponseStyleSection'
import { LearnedFactsSection } from '@/components/ai/LearnedFactsSection'
import { CompanyContextSection } from '@/components/ai/CompanyContextSection'

export default function AiContextPage() {
  const t = useTranslations('aiContext')
  const { data, isLoading, error } = useMyAiContext()

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-md">
        <Link
          href="/settings"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-base font-semibold">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg space-y-4 px-6 py-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <AlertCircle className="size-10 text-destructive/50" />
              <p className="text-sm text-destructive">{t('loadError')}</p>
            </div>
          )}

          {data && (
            <>
              <IdentitySection identity={data.identity} context={data.context} />
              <ResponseStyleSection context={data.context} />
              <LearnedFactsSection />
              <CompanyContextSection entries={data.entries} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
