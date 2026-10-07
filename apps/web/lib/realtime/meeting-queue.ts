import type { QueryClient } from '@tanstack/react-query'
import type { Meeting, MeetingEvent } from '@/lib/api/meeting-types'
import { safeDisplayName } from '@/lib/chat/names'
import type { ActiveMeetingRoom } from '@/lib/meetings/active-room'
import { invitedPlaceholder, meetingKeys, upsertUpcoming, type MeetingListData } from '@/lib/meetings/cache-updates'
import { meetingPath } from '@/lib/meetings/meeting-code'
import type { Translate } from '@/lib/meetings/meeting-errors'
import { applyMeetingEnded } from '@/lib/meetings/room-events'
import { formatMeetingRange } from '@/lib/meetings/schedule'

/**
 * `/user/queue/meeting` — the personal meeting queue, subscribed once per session in
 * useRealtimeNotifications. Invitations / reminders / cancellations patch the cache and
 * notify; room events go to the open room page (if it is that meeting).
 */

export interface MeetingNotice {
  title: string
  body: string
  href: string
}

export interface MeetingQueueContext {
  queryClient: QueryClient
  /** `meeting` namespace */
  t: Translate
  locale: string
  now: () => Date
  notificationsEnabled: () => boolean
  /** OS notification when hidden, toast + action otherwise. */
  notify(n: MeetingNotice): void
  toastInfo(message: string): void
  activeRoom(): ActiveMeetingRoom | null
}

type Invited = Extract<MeetingEvent, { event: 'meet.invited' }>
type Starting = Extract<MeetingEvent, { event: 'meet.starting' }>

const titleOr = (t: Translate, title: string | undefined) => title?.trim() || t('untitled')

function listRows(qc: QueryClient, scope: 'upcoming' | 'past'): Meeting[] {
  return qc.getQueryData<MeetingListData>(meetingKeys.list(scope))?.pages.flatMap((p) => p.content) ?? []
}

/** The title we know for a meeting, from any cache that holds it. */
function cachedTitle(qc: QueryClient, meetingId: string): string | undefined {
  const detail = qc.getQueryData<Meeting>(meetingKeys.detail(meetingId))
  if (detail) return detail.title?.trim() || undefined
  const row = [...listRows(qc, 'upcoming'), ...listRows(qc, 'past')].find((m) => m.id === meetingId)
  return row?.title?.trim() || undefined
}

function onInvited(e: Invited, ctx: MeetingQueueContext): void {
  const { queryClient: qc, t } = ctx
  const exists = listRows(qc, 'upcoming').some((m) => m.id === e.meetingId)
  if (!exists) {
    const row = invitedPlaceholder(e, ctx.now().toISOString())
    qc.setQueryData<MeetingListData>(meetingKeys.list('upcoming'), (d) => upsertUpcoming(d, row))
  }
  if (!ctx.notificationsEnabled()) return
  // hostId is identity only — a name that is missing or looks like an id becomes "Someone".
  const name = safeDisplayName(e.hostName, e.hostId) ?? t('someone')
  const title = titleOr(t, e.title)
  const body = e.scheduledStart
    ? t('notifInvitedBodyAt', { name, title, time: formatMeetingRange(ctx.locale, e.scheduledStart) })
    : t('notifInvitedBody', { name, title })
  ctx.notify({ title: t('notifInvitedTitle'), body, href: meetingPath(e.code) })
}

function onStarting(e: Starting, ctx: MeetingQueueContext): void {
  if (!ctx.notificationsEnabled()) return
  const { t } = ctx
  const time = formatMeetingRange(ctx.locale, e.scheduledStart ?? ctx.now().toISOString())
  ctx.notify({
    title: t('notifStartingTitle'),
    body: t('notifStartingBody', { title: titleOr(t, e.title), time }),
    href: meetingPath(e.code),
  })
}

function forward(e: MeetingEvent, ctx: MeetingQueueContext): void {
  const room = ctx.activeRoom()
  if (!room) return
  if (e.meetingId === undefined || e.meetingId === room.meetingId) room.handle(e)
}

export function handleMeetingQueueEvent(e: MeetingEvent, ctx: MeetingQueueContext): void {
  const { queryClient: qc, t } = ctx
  switch (e.event) {
    case 'meet.invited':
      onInvited(e, ctx)
      return
    case 'meet.starting':
      onStarting(e, ctx)
      return
    case 'meet.cancelled': {
      // Read the name before the cache is patched (the row leaves "upcoming").
      const title = e.title?.trim() || cachedTitle(qc, e.meetingId)
      applyMeetingEnded(qc, e.meetingId, ctx.now().toISOString(), true)
      if (ctx.notificationsEnabled()) {
        ctx.toastInfo(title ? t('notifCancelled', { title }) : t('notifCancelledUnknown'))
      }
      forward(e, ctx)
      return
    }
    case 'meet.ended':
      applyMeetingEnded(qc, e.meetingId, ctx.now().toISOString(), false)
      forward(e, ctx)
      return
    case 'meet.lobby':
      qc.setQueryData(meetingKeys.lobby(e.meetingId), e.waiting)
      forward(e, ctx)
      return
    case 'meet.admitted':
    case 'meet.denied':
    case 'meet.removed':
    case 'meet.muted':
    case 'meet.error':
      forward(e, ctx)
      return
    default:
      // Topic events (roster/settings/hands/chat/notes) on the wrong channel — ignore.
      return
  }
}
