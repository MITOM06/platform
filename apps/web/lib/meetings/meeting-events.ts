import {
  HOST_ACTIONS,
  type HostAction,
  type LobbyEntry,
  type MeetingEvent,
  type MeetingHand,
  type MeetingMessage,
  type MeetingPerson,
  type MeetingRoomRole,
  type MeetingSettings,
  type RosterEntry,
} from '@/lib/api/meeting-types'

/**
 * STOMP meeting frames (`/user/queue/meeting`, `/topic/meeting/{id}`) → typed events.
 *
 * Everything off the wire is `unknown` until it passes here. Junk / unknown events ⇒ null;
 * broken rows inside a list are dropped instead of the whole event.
 */

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
/** A non-empty string, else undefined. */
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
/** Spread helper: `{ [key]: value }` only when value is defined (keeps toEqual exact). */
const opt = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>

function person(v: unknown): MeetingPerson | undefined {
  if (!isObj(v) || typeof v.userId !== 'string' || !v.userId) return undefined
  return {
    userId: v.userId,
    ...opt('displayName', str(v.displayName)),
    ...opt('avatarUrl', str(v.avatarUrl)),
  }
}

function rows<T>(v: unknown, fn: (row: Obj) => T | undefined): T[] {
  if (!Array.isArray(v)) return []
  const out: T[] = []
  for (const row of v) {
    if (!isObj(row) || typeof row.userId !== 'string' || !row.userId) continue
    const parsed = fn(row)
    if (parsed) out.push(parsed)
  }
  return out
}

const ROOM_ROLES: readonly MeetingRoomRole[] = ['host', 'cohost', 'attendee']
const role = (v: unknown): MeetingRoomRole =>
  ROOM_ROLES.includes(v as MeetingRoomRole) ? (v as MeetingRoomRole) : 'attendee'

const rosterRow = (r: Obj): RosterEntry => ({
  userId: r.userId as string,
  ...opt('displayName', str(r.displayName)),
  role: role(r.role),
  joinedAt: str(r.joinedAt) ?? '',
})

const lobbyRow = (r: Obj): LobbyEntry => ({
  userId: r.userId as string,
  ...opt('displayName', str(r.displayName)),
})

const handRow = (r: Obj): MeetingHand => ({
  userId: r.userId as string,
  ...opt('displayName', str(r.displayName)),
  raisedAt: str(r.raisedAt) ?? '',
})

const SETTING_KEYS: readonly (keyof MeetingSettings)[] = [
  'waitingRoom',
  'muteOnEntry',
  'allowAttendeeScreenShare',
  'attendeesCanEditNotes',
  'locked',
]

function settings(v: unknown): MeetingSettings | undefined {
  if (!isObj(v) || !SETTING_KEYS.every((k) => typeof v[k] === 'boolean')) return undefined
  return {
    waitingRoom: v.waitingRoom as boolean,
    muteOnEntry: v.muteOnEntry as boolean,
    allowAttendeeScreenShare: v.allowAttendeeScreenShare as boolean,
    attendeesCanEditNotes: v.attendeesCanEditNotes as boolean,
    locked: v.locked as boolean,
  }
}

function message(v: unknown): MeetingMessage | undefined {
  if (!isObj(v)) return undefined
  const sender = person(v.sender)
  const { id, content, createdAt } = v
  if (!sender || typeof id !== 'string' || typeof content !== 'string') return undefined
  if (typeof createdAt !== 'string') return undefined
  return { id, sender, content, createdAt }
}

function scalarParams(v: unknown): Record<string, string | number> | undefined {
  if (!isObj(v)) return undefined
  const out: Record<string, string | number> = {}
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'string' || typeof val === 'number') out[k] = val
  }
  return Object.keys(out).length ? out : undefined
}

const hostAction = (v: unknown): HostAction | undefined =>
  HOST_ACTIONS.includes(v as HostAction) ? (v as HostAction) : undefined

function parseError(o: Obj): MeetingEvent | null {
  const errorCode = str(o.errorCode)
  if (!errorCode) return null
  return {
    event: 'meet.error',
    ...opt('meetingId', str(o.meetingId)),
    ...opt('action', hostAction(o.action)),
    ...opt('clientId', str(o.clientId)),
    errorCode,
    ...opt('params', scalarParams(o.params)),
  }
}

function parseForMeeting(event: string, meetingId: string, o: Obj): MeetingEvent | null {
  switch (event) {
    case 'meet.roster':
      return { event, meetingId, participants: rows(o.participants, rosterRow) }
    case 'meet.lobby':
      return { event, meetingId, waiting: rows(o.waiting, lobbyRow) }
    case 'meet.hands':
      return { event, meetingId, hands: rows(o.hands, handRow) }
    case 'meet.settings': {
      const s = settings(o.settings)
      return s ? { event, meetingId, settings: s } : null
    }
    case 'meet.chat': {
      const m = message(o.message)
      return m ? { event, meetingId, ...opt('clientId', str(o.clientId)), message: m } : null
    }
    case 'meet.notes.updated':
      if (typeof o.version !== 'number') return null
      return { event, meetingId, version: o.version, ...opt('updatedBy', person(o.updatedBy)) }
    case 'meet.muted':
      return { event, meetingId, ...opt('actor', person(o.actor)) }
    case 'meet.ended':
    case 'meet.admitted':
    case 'meet.denied':
    case 'meet.removed':
      return { event, meetingId }
    case 'meet.cancelled':
      return { event, meetingId, ...opt('title', str(o.title)), ...opt('code', str(o.code)) }
    case 'meet.invited':
    case 'meet.starting': {
      const code = str(o.code)
      if (!code) return null
      const common = {
        meetingId,
        code,
        ...opt('title', str(o.title)),
        ...opt('scheduledStart', str(o.scheduledStart)),
      }
      if (event === 'meet.starting') return { event, ...common }
      return {
        event,
        ...common,
        ...opt('hostId', str(o.hostId)),
        ...opt('hostName', str(o.hostName)),
      }
    }
    default:
      return null
  }
}

export function parseMeetingEvent(body: string): MeetingEvent | null {
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    return null
  }
  if (!isObj(raw) || typeof raw.event !== 'string') return null
  if (raw.event === 'meet.error') return parseError(raw)
  const meetingId = str(raw.meetingId)
  if (!meetingId) return null
  return parseForMeeting(raw.event, meetingId, raw)
}
