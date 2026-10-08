import type {
  HostAction,
  Meeting,
  MeetingRoomRole,
  MeetingSettings,
  MeetingViewerRole,
  RosterEntry,
} from '@/lib/api/meeting-types'

/**
 * What the UI offers. The server re-checks everything — these only decide which
 * buttons exist (a forbidden request still maps to a localized error).
 */

export function isManager(role: MeetingRoomRole | MeetingViewerRole | undefined): boolean {
  return role === 'host' || role === 'cohost'
}

export interface DetailActions {
  join: boolean
  copyLink: boolean
  edit: boolean
  cancel: boolean
  end: boolean
  meetAgain: boolean
}

export function detailActions(m: Meeting, canHost: boolean): DetailActions {
  const manager = isManager(m.viewerRole)
  if (m.status === 'ENDED') {
    return { join: false, copyLink: false, edit: false, cancel: false, end: false, meetAgain: manager && canHost }
  }
  return {
    join: true,
    copyLink: true,
    edit: manager,
    // Only the host, and only while nobody has ever joined (server: MEETING_NOT_CANCELLABLE).
    cancel: m.viewerRole === 'host' && m.status === 'SCHEDULED' && !m.attendance?.length,
    end: manager && m.status === 'LIVE',
    meetAgain: false,
  }
}

/** Records (notes, chat, attendance) are worth fetching: not a guest. Server still decides (403 handled). */
export function canSeeRecords(m: Meeting): boolean {
  return m.viewerRole !== 'guest'
}

export function canEditSharedNote(
  role: MeetingRoomRole | MeetingViewerRole,
  settings: MeetingSettings,
): boolean {
  if (isManager(role)) return true
  if (role === 'guest') return false
  return settings.attendeesCanEditNotes
}

export type PrejoinIntent = 'join' | 'ask' | 'locked'

export function prejoinIntent(m: Meeting): PrejoinIntent {
  if (m.viewerRole !== 'guest') return 'join'
  if (m.settings.locked) return 'locked'
  return m.settings.waitingRoom ? 'ask' : 'join'
}

/** My current room role: my roster row (roles change mid-meeting), else the join role. */
export function myRoomRole(
  roster: RosterEntry[] | undefined,
  myId: string,
  fallback: MeetingRoomRole,
): MeetingRoomRole {
  return roster?.find((r) => r.userId === myId)?.role ?? fallback
}

export interface PersonTarget {
  userId: string
  role: MeetingRoomRole
  handRaised: boolean
  micOn: boolean
}

/** Host outranks everyone else, a co-host only attendees; nobody outranks themselves. */
function outranks(myRole: MeetingRoomRole, target: MeetingRoomRole): boolean {
  if (myRole === 'host') return target !== 'host'
  return myRole === 'cohost' && target === 'attendee'
}

/** Per-person host menu, in display order. Empty ⇒ no menu. */
export function personActions(myRole: MeetingRoomRole, myId: string, target: PersonTarget): HostAction[] {
  if (!isManager(myRole) || target.userId === myId) return []
  const out: HostAction[] = []
  if (target.micOn) out.push('MUTE_MIC')
  if (target.handRaised) out.push('LOWER_HAND')
  if (myRole === 'host' && target.role === 'attendee') out.push('MAKE_COHOST')
  if (myRole === 'host' && target.role === 'cohost') out.push('REVOKE_COHOST')
  if (outranks(myRole, target.role)) out.push('REMOVE')
  return out
}

export interface RoomControls {
  muteAll: true
  lowerAllHands: boolean
  lock: 'LOCK' | 'UNLOCK'
  waitingRoom: 'WAITING_ROOM_ON' | 'WAITING_ROOM_OFF'
  screenShare: 'ATTENDEE_SCREEN_SHARE_ON' | 'ATTENDEE_SCREEN_SHARE_OFF'
}

/** Room-wide host controls (the command each switch would send now), or null for attendees. */
export function roomControls(
  myRole: MeetingRoomRole,
  settings: MeetingSettings,
  anyHands: boolean,
): RoomControls | null {
  if (!isManager(myRole)) return null
  return {
    muteAll: true,
    lowerAllHands: anyHands,
    lock: settings.locked ? 'UNLOCK' : 'LOCK',
    waitingRoom: settings.waitingRoom ? 'WAITING_ROOM_OFF' : 'WAITING_ROOM_ON',
    screenShare: settings.allowAttendeeScreenShare ? 'ATTENDEE_SCREEN_SHARE_OFF' : 'ATTENDEE_SCREEN_SHARE_ON',
  }
}

export function canShareScreen(myRole: MeetingRoomRole, settings: MeetingSettings): boolean {
  return isManager(myRole) || settings.allowAttendeeScreenShare
}
