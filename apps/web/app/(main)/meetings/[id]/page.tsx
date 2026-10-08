'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MeetingStatusBadge } from '@/components/meeting/MeetingStatusBadge'
import { NotesEditor } from '@/components/meeting/NotesEditor'
import { AttendanceList } from '@/components/meeting/detail/AttendanceList'
import { ChatHistory } from '@/components/meeting/detail/ChatHistory'
import { MeetingActions } from '@/components/meeting/detail/MeetingActions'
import { MeetingInfoCard } from '@/components/meeting/detail/MeetingInfoCard'
import type { Meeting } from '@/lib/api/meeting-types'
import { useMeeting, useMeetingMessages } from '@/lib/hooks/use-meetings'
import { parseMeetingError } from '@/lib/meetings/meeting-errors'
import { canEditSharedNote, canSeeRecords } from '@/lib/meetings/permissions'

const FRAME = 'mx-auto w-full max-w-3xl space-y-4 px-4 py-6 pb-24 md:px-6 md:pb-6'

/** /meetings/[id] — info, actions by viewerRole, attendance, notes and chat history. */
export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('meeting')
  const tCommon = useTranslations('common')
  const query = useMeeting(id)

  let body
  if (query.isPending) {
    body = (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  } else if (query.isError) {
    const info = parseMeetingError(query.error)
    const notFound = info.status === 404 || info.code === 'MEETING_NOT_FOUND'
    body = (
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm">{notFound ? t('errNotFound') : t('detailError')}</p>
          {notFound ? null : (
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              {tCommon('retry')}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  } else {
    body = <MeetingDetail meeting={query.data} />
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className={FRAME}>
        <Link href="/meetings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          {t('backToList')}
        </Link>
        {body}
      </div>
    </div>
  )
}

function MeetingDetail({ meeting: m }: { meeting: Meeting }) {
  const t = useTranslations('meeting')
  // Guests are asked too: someone admitted from the waiting room may read the records
  // (gap B4 lists such meetings under "Past"); the server answers 403 otherwise.
  const member = canSeeRecords(m)
  const recordsEnabled = member || m.viewerRole === 'guest'
  // Same query (and cache entry) as ChatHistory — its 403 decides what the records area shows.
  const probe = useMeetingMessages(m.id, recordsEnabled)
  const probeError = parseMeetingError(probe.error)
  const removed = probeError.code === 'MEETING_REMOVED'
  const denied = probe.isError && probeError.status === 403 && !removed
  const showRecords = recordsEnabled && !removed && !denied && (member || probe.isSuccess)

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">
          {m.title?.trim() || t('untitled')}
        </h1>
        <MeetingStatusBadge meeting={m} showScheduled />
      </div>
      <Card>
        <CardContent className="space-y-6">
          <MeetingInfoCard meeting={m} />
          <MeetingActions meeting={m} />
        </CardContent>
      </Card>
      {removed ? <p className="rounded-lg bg-muted p-4 text-sm">{t('removedNotice')}</p> : null}
      {!removed && !showRecords && (denied || !recordsEnabled) && m.status !== 'ENDED' ? (
        <p className="rounded-lg bg-muted p-4 text-sm">{t('guestNotice')}</p>
      ) : null}
      {showRecords ? (
        <Card>
          <CardContent className="space-y-8">
            {member && (m.attendance?.length || m.status !== 'SCHEDULED') ? <AttendanceList meeting={m} /> : null}
            <section className="space-y-2">
              <h2 className="text-sm font-medium">{t('sectionNotes')}</h2>
              <NotesEditor meetingId={m.id} canEditShared={canEditSharedNote(m.viewerRole, m.settings)} />
            </section>
            {/* P2: AI summary slot */}
            <ChatHistory meetingId={m.id} enabled={recordsEnabled} />
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
