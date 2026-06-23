'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { BookOpen, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AiSource } from '@/lib/api/types'

interface Props {
  sources: AiSource[]
  conversationId?: string
}

/** Short, human-friendly fallback when a source has no fileName (e.g. older
 * payloads carrying only a documentId). Shows the first 6 chars of the id. */
function fallbackLabel(documentId: string): string {
  return `#${documentId.slice(0, 6)}`
}

/**
 * Compact "Sources" row rendered under a finalized AI answer. One clickable chip
 * per cited document (de-duplicated by documentId) that navigates to the
 * conversation's KB view. Mirrors Flutter `FinalizedAiBubble` sources row.
 */
export function MessageSources({ sources, conversationId }: Props) {
  const t = useTranslations('chat')

  // De-duplicate by documentId — an answer may cite the same doc more than once.
  const unique = Array.from(
    new Map(sources.filter((s) => s.documentId).map((s) => [s.documentId, s])).values(),
  )
  if (unique.length === 0) return null

  const kbHref = conversationId ? `/kb/${conversationId}` : null

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70">
        <BookOpen className="size-3" />
        {t('sourcesLabel')}
      </span>
      {unique.map((s) => {
        const label = s.fileName?.trim() || fallbackLabel(s.documentId)
        // A web-search source carries an external URL (and/or type:'web'). Its
        // chip opens that URL in a new tab; KB sources keep navigating to /kb.
        const isWeb = (s.type === 'web' || !!s.url) && !!s.url?.trim()
        const interactive = isWeb || !!kbHref
        const chipCls = cn(
          'inline-flex max-w-[180px] items-center gap-1 truncate rounded-full border border-border/60 bg-muted/50 px-2 py-0.5',
          'text-[11px] text-muted-foreground transition-colors',
          'dark:bg-muted/30',
          interactive && 'hover:border-primary/50 hover:text-primary hover:bg-primary/5',
        )
        const chipBody = (
          <>
            {isWeb && <Globe className="size-3 shrink-0" />}
            <span className="truncate">{label}</span>
          </>
        )
        if (isWeb) {
          return (
            <a
              key={s.documentId}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              title={label}
              className={chipCls}
            >
              {chipBody}
            </a>
          )
        }
        return kbHref ? (
          <Link key={s.documentId} href={kbHref} title={label} className={chipCls}>
            {chipBody}
          </Link>
        ) : (
          <span key={s.documentId} title={label} className={chipCls}>
            {chipBody}
          </span>
        )
      })}
    </div>
  )
}
