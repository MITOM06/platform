'use client'

import { useTranslations } from 'next-intl'
import { CheckSquare, FileStack, Gavel, ListChecks } from 'lucide-react'
import type { NormalizedSummary } from '@/lib/meetings/meeting-summary'

const H4 = 'mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground'

/**
 * The body of a meeting summary: overview, key points, decisions, action items,
 * source materials. Shared by the chat card and the meeting detail block; the
 * decisions / materials sections only appear when non-empty. Uses the `call` namespace.
 */
export function SummarySections({ data }: { data: NormalizedSummary }) {
  const t = useTranslations('call')
  return (
    <div className="space-y-3 text-sm">
      {data.overview && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('summaryOverview')}
          </h4>
          <p className="whitespace-pre-wrap leading-relaxed">{data.overview}</p>
        </section>
      )}

      {data.keyPoints.length > 0 && (
        <section>
          <h4 className={H4}>
            <ListChecks className="size-3.5" />
            {t('summaryKeyPoints')}
          </h4>
          <ul className="list-disc space-y-1 pl-5">
            {data.keyPoints.map((kp, i) => (
              <li key={i} className="leading-relaxed">
                {kp}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.decisions.length > 0 && (
        <section>
          <h4 className={H4}>
            <Gavel className="size-3.5" />
            {t('summaryDecisions')}
          </h4>
          <ul className="list-disc space-y-1 pl-5">
            {data.decisions.map((d, i) => (
              <li key={i} className="leading-relaxed">
                {d}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.actionItems.length > 0 && (
        <section>
          <h4 className={H4}>
            <CheckSquare className="size-3.5" />
            {t('summaryActionItems')}
          </h4>
          <ul className="space-y-1.5">
            {data.actionItems.map((ai, i) => (
              <li key={i} className="flex items-start gap-2 leading-relaxed">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border border-muted-foreground/40" />
                <span>{ai.assigneeName ? `${ai.text} — ${ai.assigneeName}` : ai.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.fromMaterials.length > 0 && (
        <section>
          <h4 className={H4}>
            <FileStack className="size-3.5" />
            {t('summaryFromMaterials')}
          </h4>
          <ul className="list-disc space-y-1 pl-5">
            {data.fromMaterials.map((m, i) => (
              <li key={i} className="leading-relaxed">
                {m}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
