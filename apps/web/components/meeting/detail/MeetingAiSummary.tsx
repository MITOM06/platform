'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, MessagesSquare, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { SummarySections } from '@/components/meeting/summary/SummarySections'
import { Button } from '@/components/ui/button'
import type { Meeting } from '@/lib/api/meeting-types'
import { useMeetingSummary, useRegenerateSummary } from '@/lib/hooks/use-meeting-summary'
import { meetingErrorMessage } from '@/lib/meetings/meeting-errors'
import { normalizeSummary } from '@/lib/meetings/meeting-summary'
import { isManager } from '@/lib/meetings/permissions'

/**
 * "AI summary" block of the meeting detail page. Nothing at all when AI notes were never on
 * (state null) or the summary cannot be read. The newest successful summary stays visible under a
 * PENDING / FAILED status line. Open-group whenever the viewer is in the group;
 * regenerate only for host / co-host. The server re-checks both.
 */
export function MeetingAiSummary({ meeting: m }: { meeting: Meeting }) {
  const t = useTranslations('meeting')
  const router = useRouter()
  const enabled = m.status === 'ENDED' && (!!m.aiNotesEverEnabled || !!m.summaryState)
  const query = useMeetingSummary(m.id, enabled)
  const regenerate = useRegenerateSummary(m.id)

  const data = query.data
  const state = data?.state ?? null
  if (!enabled || !data || state === null) return null

  const canRegenerate = isManager(m.viewerRole)
  const groupId = data.inGroup && data.groupConversationId ? data.groupConversationId : undefined
  const summary = normalizeSummary(data.summary)

  const onRegenerate = () =>
    regenerate.mutate(undefined, { onError: (err) => toast.error(meetingErrorMessage(err, t)) })

  const regenerateButton =
    canRegenerate && state !== 'PENDING' ? (
      <Button variant="outline" size="sm" disabled={regenerate.isPending} onClick={onRegenerate}>
        <RefreshCw className="size-4" />
        {t('aiSummaryRegenerate')}
      </Button>
    ) : null

  return (
    <section className="space-y-3" aria-label={t('aiSummaryTitle')}>
      <h2 className="flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="size-4 text-primary" aria-hidden />
        {t('aiSummaryTitle')}
      </h2>

      {state === 'PENDING' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('aiSummaryPending')}
        </p>
      )}
      {state === 'EMPTY' && <p className="text-sm text-muted-foreground">{t('aiSummaryEmpty')}</p>}
      {state === 'FAILED' && <p className="text-sm text-muted-foreground">{t('aiSummaryFailed')}</p>}
      {state !== 'EMPTY' && summary ? <SummarySections data={summary} /> : null}

      {groupId || regenerateButton ? (
        <div className="flex flex-wrap gap-2">
          {groupId ? (
            <Button variant="outline" size="sm" onClick={() => router.push(`/conversations/${groupId}`)}>
              <MessagesSquare className="size-4" />
              {t('aiSummaryOpenGroup')}
            </Button>
          ) : null}
          {regenerateButton}
        </div>
      ) : null}
    </section>
  )
}
