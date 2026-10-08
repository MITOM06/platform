import type { LobbyEntry, Meeting, MeetingEvent, RosterEntry } from '@/lib/api/meeting-types'
import { appendMessage, meetingKeys, rosterFromMeeting, type MessageListData } from './cache-updates'
import { applyMeetingEnded } from './room-events'
import type { MeetingRoomDeps } from './room-session'

/** Cache re-reads / patches of MeetingRoomController that do not touch the room store. */

/**
 * STOMP came back: GET the meeting once and write every cache that shows it
 * (detail, by-code — the room page — and the roster). null when the read failed.
 */
export async function rereadMeeting(
  deps: Pick<MeetingRoomDeps, 'api' | 'queryClient'>,
  meetingId: string,
): Promise<{ meeting: Meeting; roster: RosterEntry[] } | null> {
  try {
    const meeting = await deps.api.get(meetingId)
    const roster = rosterFromMeeting(meeting)
    const qc = deps.queryClient
    qc.setQueryData<Meeting>(meetingKeys.detail(meetingId), meeting)
    // Whatever code spelling the page was opened with: match the cached meeting by id.
    qc.setQueriesData<Meeting>({ queryKey: meetingKeys.byCodeAll }, (m) => (m?.id === meetingId ? meeting : m))
    qc.setQueryData<RosterEntry[]>(meetingKeys.roster(meetingId), roster)
    return { meeting, roster }
  } catch {
    return null
  }
}

/** My own line re-sent to me alone (an idempotent retry): into the history, deduped by id. */
export function appendOwnChat(
  deps: Pick<MeetingRoomDeps, 'queryClient'>,
  e: Extract<MeetingEvent, { event: 'meet.chat' }>,
): void {
  deps.queryClient.setQueryData<MessageListData>(meetingKeys.messages(e.meetingId), (d) =>
    appendMessage(d, e.message),
  )
}

/** Host/co-host: who is waiting right now (a `meet.lobby` may have been missed). */
export async function rereadLobby(
  deps: Pick<MeetingRoomDeps, 'api' | 'queryClient'>,
  meetingId: string,
): Promise<void> {
  try {
    const entries = await deps.api.lobby(meetingId)
    deps.queryClient.setQueryData<LobbyEntry[]>(meetingKeys.lobby(meetingId), entries)
  } catch {
    // the next meet.lobby will bring it
  }
}

/** ENDED everywhere it is cached (detail, by-code, lists), as of now. */
export function markMeetingEnded(deps: Pick<MeetingRoomDeps, 'queryClient' | 'now'>, meetingId: string): void {
  applyMeetingEnded(deps.queryClient, meetingId, new Date(deps.now()).toISOString(), false)
}
