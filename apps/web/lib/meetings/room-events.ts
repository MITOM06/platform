import type { QueryClient } from '@tanstack/react-query'
import type {
  Meeting,
  MeetingEvent,
  MeetingHand,
  MeetingPerson,
  MeetingSettings,
  RosterEntry,
} from '@/lib/api/meeting-types'
import {
  appendMessage,
  markEnded,
  meetingKeys,
  removeFromList,
  withSettings,
  type MeetingListData,
  type MessageListData,
} from './cache-updates'

/** Events of `/topic/meeting/{id}` → TanStack cache patches + callbacks for the room UI. */

export interface RoomEventDeps {
  queryClient: QueryClient
  meetingId: string
  code?: string
  now: () => Date
  onRoster?(participants: RosterEntry[]): void
  onSettings?(settings: MeetingSettings): void
  onChat?(e: Extract<MeetingEvent, { event: 'meet.chat' }>): void
  onSharedNoteUpdated?(version: number, updatedBy?: MeetingPerson): void
  onEnded?(): void
}

/** Shared by room-events and meeting-queue: ENDED in detail/byCode, out of upcoming, past marked stale. */
export function applyMeetingEnded(
  qc: QueryClient,
  meetingId: string,
  atIso: string,
  cancelled: boolean,
): void {
  qc.setQueryData<Meeting>(meetingKeys.detail(meetingId), (m) => markEnded(m, atIso, cancelled))
  qc.setQueriesData<Meeting>({ queryKey: meetingKeys.byCodeAll }, (m) =>
    m?.id === meetingId ? markEnded(m, atIso, cancelled) : m,
  )
  qc.setQueryData<MeetingListData>(meetingKeys.list('upcoming'), (d) => removeFromList(d, meetingId))
  void qc.invalidateQueries({ queryKey: meetingKeys.list('past'), refetchType: 'none' })
}

export function applyRoomEvent(e: MeetingEvent, deps: RoomEventDeps): void {
  const { queryClient: qc, meetingId } = deps
  if (e.meetingId !== meetingId) return
  switch (e.event) {
    case 'meet.roster':
      qc.setQueryData<RosterEntry[]>(meetingKeys.roster(meetingId), e.participants)
      deps.onRoster?.(e.participants)
      return
    case 'meet.hands':
      qc.setQueryData<MeetingHand[]>(meetingKeys.hands(meetingId), e.hands)
      return
    case 'meet.settings':
      qc.setQueryData<Meeting>(meetingKeys.detail(meetingId), (m) => withSettings(m, e.settings))
      qc.setQueriesData<Meeting>({ queryKey: meetingKeys.byCodeAll }, (m) =>
        m?.id === meetingId ? withSettings(m, e.settings) : m,
      )
      deps.onSettings?.(e.settings)
      return
    case 'meet.chat':
      qc.setQueryData<MessageListData>(meetingKeys.messages(meetingId), (d) =>
        appendMessage(d, e.message),
      )
      deps.onChat?.(e)
      return
    case 'meet.notes.updated':
      deps.onSharedNoteUpdated?.(e.version, e.updatedBy)
      return
    case 'meet.ended':
      applyMeetingEnded(qc, meetingId, deps.now().toISOString(), false)
      deps.onEnded?.()
      return
    default:
      return
  }
}
