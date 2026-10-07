import type { QueryClient } from '@tanstack/react-query'
import {
  TARGETED_HOST_ACTIONS,
  type HostAction,
  type LobbyEntry,
  type Meeting,
  type MeetingPerson,
  type MeetingRoomRole,
} from '@/lib/api/meeting-types'
import { safeDisplayName } from '@/lib/chat/names'
import { meetingKeys } from './cache-updates'
import { meetingErrorKey, parseMeetingError, type MessageKey } from './meeting-errors'

/** Small pure helpers of MeetingRoomController (host commands, notices, roles). */

/** Switch commands — pending until `meet.settings` confirms them. */
export const SWITCH_ACTIONS: ReadonlySet<HostAction> = new Set<HostAction>([
  'LOCK',
  'UNLOCK',
  'WAITING_ROOM_ON',
  'WAITING_ROOM_OFF',
  'ATTENDEE_SCREEN_SHARE_ON',
  'ATTENDEE_SCREEN_SHARE_OFF',
])

/** `/app/meet.host` body — `targetId` only for the person actions. */
export function hostCommandBody(meetingId: string, action: HostAction, targetId?: string) {
  const target = TARGETED_HOST_ACTIONS.has(action) && targetId ? { targetId } : {}
  return { meetingId, action, ...target }
}

/** "{name} muted your microphone" — never the actor's id. */
export function mutedNotice(actor: MeetingPerson | undefined): MessageKey {
  const name = safeDisplayName(actor?.displayName, actor?.userId)
  return name ? { key: 'mutedBy', values: { name } } : { key: 'mutedByUnknown' }
}

/** Room role before the join answer / first roster: host/co-host from the meeting, else attendee. */
export function initialRoomRole(m: Pick<Meeting, 'viewerRole'>): MeetingRoomRole {
  return m.viewerRole === 'host' || m.viewerRole === 'cohost' ? m.viewerRole : 'attendee'
}

/** Admit / deny one waiting person: drop them from the cached lobby, or say why it failed. */
export async function answerLobby(
  deps: { queryClient: QueryClient; notify(level: 'info' | 'error', msg: MessageKey): void },
  meetingId: string,
  userId: string,
  call: () => Promise<void>,
): Promise<void> {
  try {
    await call()
    deps.queryClient.setQueryData<LobbyEntry[]>(meetingKeys.lobby(meetingId), (list) =>
      list?.filter((e) => e.userId !== userId),
    )
  } catch (err) {
    deps.notify('error', meetingErrorKey(parseMeetingError(err)))
  }
}

/** Best-effort save of unsaved notes; never throws, never waits. */
export function flushNotes(flush: (() => Promise<void>) | null): void {
  void flush?.().catch(() => undefined)
}
