'use client'

import { useTranslations } from 'next-intl'
import { FileText, Users, Clock, CheckSquare, ListChecks } from 'lucide-react'
import type { MeetingSummaryPayload } from '@/lib/api/types'
import { cn } from '@/lib/utils'

function parsePayload(content: string): MeetingSummaryPayload | null {
  try {
    const raw = JSON.parse(content) as Partial<MeetingSummaryPayload>
    return {
      attendees: Array.isArray(raw.attendees) ? raw.attendees.filter((a) => typeof a === 'string') : [],
      durationSec: typeof raw.durationSec === 'number' ? raw.durationSec : 0,
      overview: typeof raw.overview === 'string' ? raw.overview : '',
      keyPoints: Array.isArray(raw.keyPoints) ? raw.keyPoints.filter((k) => typeof k === 'string') : [],
      actionItems: Array.isArray(raw.actionItems) ? raw.actionItems.filter((a) => typeof a === 'string') : [],
    }
  } catch {
    return null
  }
}

/**
 * Human-readable duration. Matches Flutter `meeting_summary_card.dart`
 * exactly (cross-platform parity, sync.md): `h:mm:ss` above an hour, else
 * `m:ss` (minutes NOT zero-padded).
 */
function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = s.toString().padStart(2, '0')
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${ss}`
  return `${m}:${ss}`
}

/**
 * Renders a `meeting_summary` message (Track A §6) as a distinct AI card.
 * Header = attendees + formatted duration; sections = overview, key points
 * (bullets), action items (checklist). Mirrors message_bubble.dart.
 */
export function MeetingSummaryCard({ content, isPinned }: { content: string; isPinned?: boolean }) {
  const t = useTranslations('call')
  const data = parsePayload(content)

  if (!data) {
    return (
      <div className="rounded-2xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        {t('summaryUnavailable')}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-sm',
        isPinned && 'ring-2 ring-primary/40',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-gradient-to-r from-pon-cyan/15 via-pon-peach/10 to-pon-pink/15 px-4 py-3">
        <FileText className="size-5 text-pon-cyan shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t('meetingSummaryTitle')}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {data.attendees.length > 0 ? data.attendees.join(', ') : t('noAttendees')}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatDuration(data.durationSec)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3 text-sm">
        {/* Overview */}
        {data.overview && (
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('summaryOverview')}
            </h4>
            <p className="whitespace-pre-wrap leading-relaxed">{data.overview}</p>
          </section>
        )}

        {/* Key points */}
        {data.keyPoints.length > 0 && (
          <section>
            <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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

        {/* Action items */}
        {data.actionItems.length > 0 && (
          <section>
            <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CheckSquare className="size-3.5" />
              {t('summaryActionItems')}
            </h4>
            <ul className="space-y-1.5">
              {data.actionItems.map((ai, i) => (
                <li key={i} className="flex items-start gap-2 leading-relaxed">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border border-muted-foreground/40" />
                  <span>{ai}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
