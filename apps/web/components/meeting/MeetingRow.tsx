'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Meeting } from '@/lib/api/meeting-types'
import { personName } from '@/lib/meetings/display'
import { meetingPath } from '@/lib/meetings/meeting-code'
import { detailActions } from '@/lib/meetings/permissions'
import { formatMeetingRange } from '@/lib/meetings/schedule'
import { CopyLinkButton } from './CopyLinkButton'
import { MeetingStatusBadge } from './MeetingStatusBadge'

/** Calendar-leaf date block (month + day) for scheduled meetings, a camera for instant ones. */
function DateBlock({ startIso }: { startIso?: string }) {
  const locale = useLocale()
  if (!startIso) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Video className="size-5" />
      </div>
    )
  }
  const start = new Date(startIso)
  return (
    <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md bg-accent text-accent-foreground leading-none">
      <span className="text-[10px] uppercase">
        {new Intl.DateTimeFormat(locale, { month: 'short' }).format(start)}
      </span>
      <span className="text-sm font-semibold">
        {new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(start)}
      </span>
    </div>
  )
}

export function MeetingRow({ meeting: m, canHost }: { meeting: Meeting; canHost: boolean }) {
  const t = useTranslations('meeting')
  const locale = useLocale()
  const router = useRouter()
  const title = m.title?.trim() || t('untitled')
  const when = m.scheduledStart
    ? formatMeetingRange(locale, m.scheduledStart, m.scheduledEnd)
    : t('instantMeeting')
  const host =
    m.viewerRole === 'host' ? t('roleHost') : t('hostedBy', { name: personName(m.host, t('someone')) })
  const actions = detailActions(m, canHost)

  return (
    <li className="relative flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted">
      <DateBlock startIso={m.scheduledStart} />
      <div className="min-w-0 flex-1">
        {/* Stretched link: the whole row opens the detail page, buttons stay above it. */}
        <Link
          href={`/meetings/${encodeURIComponent(m.id)}`}
          className="block truncate text-sm font-medium after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {when} · {host}
        </p>
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-1">
        <MeetingStatusBadge meeting={m} />
        {actions.join ? (
          <Button size="sm" onClick={() => router.push(meetingPath(m.code))}>
            {t('join')}
          </Button>
        ) : null}
        {actions.copyLink ? <CopyLinkButton code={m.code} /> : null}
      </div>
    </li>
  )
}
