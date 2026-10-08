'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import type { Meeting } from '@/lib/api/meeting-types'

interface Props {
  meeting: Pick<Meeting, 'status' | 'cancelledAt'>
  /** Also label SCHEDULED meetings (detail page); the list leaves them unlabelled. */
  showScheduled?: boolean
}

export function MeetingStatusBadge({ meeting, showScheduled = false }: Props) {
  const t = useTranslations('meeting')
  if (meeting.cancelledAt) return <Badge variant="outline">{t('statusCancelled')}</Badge>
  if (meeting.status === 'ENDED') return <Badge variant="secondary">{t('statusEnded')}</Badge>
  if (meeting.status === 'LIVE') {
    return (
      <Badge>
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {t('statusLive')}
      </Badge>
    )
  }
  return showScheduled ? <Badge variant="outline">{t('statusScheduled')}</Badge> : null
}
