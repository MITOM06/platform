// ─── Meetings (docs/api-spec.md § Meetings) ──────────────────────────────────
// Contract types for the chat-service meetings REST API and its STOMP events.
// Re-exported from ./types.ts. Network data stays `unknown` until it has been
// through a parser (lib/meetings/meeting-events.ts) or comes from a typed REST call.

export type MeetingStatus = 'SCHEDULED' | 'LIVE' | 'ENDED'
export type MeetingViewerRole = 'host' | 'cohost' | 'invited' | 'guest'
export type MeetingRoomRole = 'host' | 'cohost' | 'attendee'
export type MeetingListScope = 'upcoming' | 'past'
export type NoteScope = 'shared' | 'private'

/** A person next to a meeting. displayName/avatarUrl absent ⇒ generic label, never the id. */
export interface MeetingPerson {
  userId: string
  displayName?: string
  avatarUrl?: string
}

export interface MeetingSettings {
  waitingRoom: boolean
  muteOnEntry: boolean
  allowAttendeeScreenShare: boolean
  attendeesCanEditNotes: boolean
  locked: boolean
  /** AI takes notes of the meeting; everyone in the room is told. */
  aiNotes: boolean
}

export interface MeetingAttendance {
  userId: string
  displayName?: string
  role: MeetingRoomRole
  joinedAt: string
  leftAt?: string
}

export interface Meeting {
  id: string
  code: string
  title?: string
  description?: string
  host: MeetingPerson
  coHosts?: MeetingPerson[]
  invitees?: MeetingPerson[]
  departmentId?: string
  scheduledStart?: string
  scheduledEnd?: string
  status: MeetingStatus
  settings: MeetingSettings
  attendance?: MeetingAttendance[]
  /** host/co-host only — raw ids for matching, NEVER rendered. */
  removedIds?: string[]
  viewerRole: MeetingViewerRole
  createdAt: string
  /** Sticky: AI notes were on at some point (gates the recap UI). */
  aiNotesEverEnabled?: boolean
  startedAt?: string
  endedAt?: string
  cancelledAt?: string
  /** AI summary state; absent = never asked (AI notes were never on). */
  summaryState?: MeetingSummaryState
  /** The group chat made for the meeting; only open it when `GET .../summary` says `inGroup`. */
  groupConversationId?: string
}

export type MeetingSummaryState = 'PENDING' | 'DONE' | 'EMPTY' | 'FAILED'

/** `GET /api/meetings/{id}/summary` — `summary` is the raw MeetingSummary (normalize before use). */
export interface MeetingSummaryResponse {
  state: MeetingSummaryState | null
  summary?: unknown
  createdAt?: string
  groupConversationId?: string
  inGroup: boolean
}

export interface MeetingPage {
  content: Meeting[]
  page: number
  size: number
  totalElements: number
  hasNext: boolean
}

/** POST/PATCH body. PATCH: absent = unchanged, '' clears title/description/departmentId. */
export interface MeetingInput {
  title?: string
  description?: string
  inviteeIds?: string[]
  departmentId?: string
  scheduledStart?: string
  scheduledEnd?: string
  settings?: Partial<MeetingSettings>
}

export type MeetingJoinResponse =
  | { status: 'joined'; url: string; token: string; role: MeetingRoomRole }
  | { status: 'waiting' }

export interface MeetingMessage {
  id: string
  sender: MeetingPerson
  content: string
  createdAt: string
}

export interface MeetingMessagePage {
  content: MeetingMessage[]
  page: number
  size: number
  totalElements: number
  hasNext: boolean
}

export interface MeetingNote {
  scope: NoteScope
  content: string
  version: number
  updatedBy?: MeetingPerson
  updatedAt?: string
}

export interface MeetingNoteInput {
  content: string
  version: number
}

export interface MeetingHand {
  userId: string
  displayName?: string
  raisedAt: string
}

export interface LobbyEntry {
  userId: string
  displayName?: string
}

export interface RosterEntry {
  userId: string
  displayName?: string
  role: MeetingRoomRole
  joinedAt: string
}

/** A department the caller may attach a meeting to (auth-service `GET /api/users/me/departments`). */
export interface DepartmentOption {
  id: string
  name: string
}

export const HOST_ACTIONS = [
  'MUTE_MIC',
  'MUTE_ALL',
  'REMOVE',
  'LOWER_HAND',
  'LOWER_ALL_HANDS',
  'LOCK',
  'UNLOCK',
  'WAITING_ROOM_ON',
  'WAITING_ROOM_OFF',
  'ATTENDEE_SCREEN_SHARE_ON',
  'ATTENDEE_SCREEN_SHARE_OFF',
  'AI_NOTES_ON',
  'AI_NOTES_OFF',
  'MAKE_COHOST',
  'REVOKE_COHOST',
] as const
export type HostAction = (typeof HOST_ACTIONS)[number]

/** Actions that need a `targetId` (server ignores it for the others). */
export const TARGETED_HOST_ACTIONS: ReadonlySet<HostAction> = new Set<HostAction>([
  'MUTE_MIC',
  'REMOVE',
  'LOWER_HAND',
  'MAKE_COHOST',
  'REVOKE_COHOST',
])

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🎉'] as const
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

export const MEETING_LIMITS = {
  title: 120,
  description: 2000,
  invitees: 100,
  chat: 2000,
  note: 50_000,
  participants: 25,
  maxDurationMinutes: 24 * 60,
  startGraceMinutes: 5,
} as const

/** Server defaults (api-spec CreateMeetingRequest). */
export const DEFAULT_MEETING_SETTINGS: MeetingSettings = {
  waitingRoom: true,
  muteOnEntry: false,
  allowAttendeeScreenShare: true,
  attendeesCanEditNotes: true,
  locked: false,
  aiNotes: false,
}

/** Every STOMP meeting payload, after parseMeetingEvent (lib/meetings/meeting-events.ts). */
export type MeetingEvent =
  | { event: 'meet.roster'; meetingId: string; participants: RosterEntry[] }
  | { event: 'meet.settings'; meetingId: string; settings: MeetingSettings }
  | { event: 'meet.ended'; meetingId: string }
  | { event: 'meet.hands'; meetingId: string; hands: MeetingHand[] }
  | { event: 'meet.chat'; meetingId: string; clientId?: string; message: MeetingMessage }
  /** AI is answering an `@AI` line (`thinking`) or gave up (`error`; `code` = AI error code, not a meeting code). */
  | { event: 'meet.ai'; meetingId: string; state: 'thinking' | 'error'; requesterId: string; code?: string }
  | { event: 'meet.notes.updated'; meetingId: string; version: number; updatedBy?: MeetingPerson }
  | { event: 'meet.lobby'; meetingId: string; waiting: LobbyEntry[] }
  | { event: 'meet.admitted' | 'meet.denied' | 'meet.removed'; meetingId: string }
  /** title/code ride along since gap B3 — absent on older servers. */
  | { event: 'meet.cancelled'; meetingId: string; title?: string; code?: string }
  | { event: 'meet.muted'; meetingId: string; actor?: MeetingPerson }
  | {
      event: 'meet.error'
      meetingId?: string
      action?: HostAction
      clientId?: string
      errorCode: string
      params?: Record<string, string | number>
    }
  /** hostId: identity only (placeholder row) — never rendered. */
  | {
      event: 'meet.invited'
      meetingId: string
      code: string
      title?: string
      hostId?: string
      hostName?: string
      scheduledStart?: string
    }
  | { event: 'meet.starting'; meetingId: string; code: string; title?: string; scheduledStart?: string }
  | {
      event: 'meet.summary.ready'
      meetingId: string
      summaryState: Exclude<MeetingSummaryState, 'PENDING'>
      groupConversationId?: string
    }

export type MeetingEventName = MeetingEvent['event']
