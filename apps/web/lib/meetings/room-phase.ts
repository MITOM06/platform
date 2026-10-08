import type { Meeting, MeetingEvent, MeetingJoinResponse } from '@/lib/api/meeting-types'
import type { MeetingErrorInfo } from './meeting-errors'

/** Which screen `/meet/[code]` shows. */
export type RoomPhase =
  | 'loading'
  | 'notFound'
  | 'prejoin'
  | 'joining'
  | 'waiting'
  | 'connecting'
  | 'inRoom'
  | 'denied'
  | 'removed'
  | 'locked'
  | 'full'
  | 'unavailable'
  | 'left'
  | 'connectionLost'
  | 'ended'
  | 'error'

const TERMINAL: ReadonlySet<RoomPhase> = new Set<RoomPhase>(['notFound', 'denied', 'removed', 'ended'])
const REJOINABLE: ReadonlySet<RoomPhase> = new Set<RoomPhase>([
  'left',
  'connectionLost',
  'locked',
  'full',
  'unavailable',
  'error',
])
const LIVE: ReadonlySet<RoomPhase> = new Set<RoomPhase>(['joining', 'waiting', 'connecting', 'inRoom'])

/** No way back in from here (the page offers only "details" / "all meetings"). */
export function isTerminal(phase: RoomPhase): boolean {
  return TERMINAL.has(phase)
}

/** The status screen offers "Rejoin" / "Try again". */
export function canRejoin(phase: RoomPhase): boolean {
  return REJOINABLE.has(phase)
}

/** Phase for a failed `POST /join` (or a failed load by code). */
export function phaseAfterJoinError(info: MeetingErrorInfo): RoomPhase {
  switch (info.code) {
    case 'MEETING_REMOVED':
      return 'removed'
    case 'MEETING_LOCKED':
      return 'locked'
    case 'MEETING_ENDED':
      return 'ended'
    case 'MEETING_FULL':
      return 'full'
    case 'MEETINGS_UNAVAILABLE':
      return 'unavailable'
    case 'MEETING_NOT_FOUND':
      return 'notFound'
  }
  if (info.status === 404) return 'notFound'
  if (info.status === 503) return 'unavailable'
  return 'error'
}

/** First phase once the meeting has (not) loaded by its code. */
export function initialPhase(m: Meeting | undefined, loadError: MeetingErrorInfo | null): RoomPhase {
  if (loadError) return phaseAfterJoinError(loadError)
  if (!m) return 'loading'
  return m.status === 'ENDED' ? 'ended' : 'prejoin'
}

export function phaseAfterJoin(res: MeetingJoinResponse): 'waiting' | 'connecting' {
  return res.status === 'waiting' ? 'waiting' : 'connecting'
}

/** 'rejoin' = call join again now (admitted). null = event does not change the phase. */
export function phaseAfterPersonalEvent(phase: RoomPhase, e: MeetingEvent): RoomPhase | 'rejoin' | null {
  if (isTerminal(phase) || phase === 'loading') return null
  switch (e.event) {
    case 'meet.admitted':
      return phase === 'waiting' ? 'rejoin' : null
    case 'meet.denied':
      return phase === 'waiting' ? 'denied' : null
    case 'meet.removed':
      return LIVE.has(phase) ? 'removed' : null
    case 'meet.ended':
    case 'meet.cancelled':
      return 'ended'
    default:
      return null
  }
}

/** 'verify' = room closed by the server: GET the meeting — ENDED ⇒ 'ended', else 'left'. */
export function phaseAfterRoomClosed(reason: 'failed' | 'ended'): 'connectionLost' | 'verify' {
  return reason === 'failed' ? 'connectionLost' : 'verify'
}
