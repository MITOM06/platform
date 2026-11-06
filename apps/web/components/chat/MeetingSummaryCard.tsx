'use client'

import { useTranslations } from 'next-intl'
import { FileText, Users, Clock } from 'lucide-react'
import { SummarySections } from '@/components/meeting/summary/SummarySections'
import { normalizeSummary, type NormalizedSummary } from '@/lib/meetings/meeting-summary'
import { cn } from '@/lib/utils'

function parsePayload(content: string): NormalizedSummary | null {
  try {
    return normalizeSummary(JSON.parse(content))
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
 * (bullets), decisions, action items (checklist), materials. Reads the old group-call
 * and the new meeting format via normalizeSummary. Mirrors message_bubble.dart.
 */
export function MeetingSummaryCard({ content, isPinned }: { content: string; isPinned?: boolean }) {
  const t = useTranslations('call')
  const data = parsePayload(content)

  if (!data) {
    return (
      <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        {t('summaryUnavailable')}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'w-full max-w-md overflow-hidden rounded-lg border bg-card',
        isPinned && 'ring-2 ring-primary/40',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-primary/15 px-4 py-3">
        <FileText className="size-5 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t('meetingSummaryTitle')}</p>
          {data.title && <p className="truncate text-xs font-medium">{data.title}</p>}
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

      <div className="px-4 py-3">
        <SummarySections data={data} />
      </div>
    </div>
  )
}
