import type { MeetingEvent } from '@/lib/api/meeting-types'

/**
 * The one meeting room page that is open (set by its controller). The personal
 * queue (`/user/queue/meeting`) forwards room events — lobby, admitted, denied,
 * removed, muted, error, ended — to it when the meeting id matches.
 */
export interface ActiveMeetingRoom {
  meetingId: string
  handle(e: MeetingEvent): void
}

let active: ActiveMeetingRoom | null = null

export function setActiveMeetingRoom(room: ActiveMeetingRoom | null): void {
  active = room
}

export function getActiveMeetingRoom(): ActiveMeetingRoom | null {
  return active
}
