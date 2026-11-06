/**
 * "PON AI is answering…" bookkeeping for the in-meeting chat — pure, no timers.
 * Flutter mirrors this as `pending_ai.dart` with the same rules.
 *
 * A list of `{requesterId, startedAt}` per meeting room, oldest first:
 *  - `meet.ai thinking`        → add (requesterId, now)
 *  - `meet.chat` from AI bot   → remove the oldest
 *  - `meet.ai error`           → remove the oldest of that requester, else the oldest
 *  - every entry expires 60 s after it started
 * The indicator shows while the list is non-empty.
 */

export const AI_PENDING_TTL_MS = 60_000

export interface PendingAi {
  requesterId: string
  startedAt: number
}

/** i18n key (namespace `meeting`) of the line shown to the requester on error. */
export type AiErrorKey = 'aiUnavailable' | 'aiFailed'

export const addPendingAi = (list: PendingAi[], requesterId: string, now: number): PendingAi[] => [
  ...list,
  { requesterId, startedAt: now },
]

export const resolvePendingAi = (list: PendingAi[]): PendingAi[] => list.slice(1)

export function failPendingAi(list: PendingAi[], requesterId: string): PendingAi[] {
  const own = list.findIndex((p) => p.requesterId === requesterId)
  const at = own >= 0 ? own : 0
  return list.filter((_, i) => i !== at)
}

export const expirePendingAi = (list: PendingAi[], now: number): PendingAi[] =>
  list.filter((p) => now - p.startedAt < AI_PENDING_TTL_MS)

/** Never the raw code: AI_UNAVAILABLE → unavailable; AI_EMPTY, anything else, none → couldn't answer. */
export const aiErrorKey = (code: string | undefined): AiErrorKey =>
  code === 'AI_UNAVAILABLE' ? 'aiUnavailable' : 'aiFailed'
