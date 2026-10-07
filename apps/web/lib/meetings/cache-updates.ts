import type { InfiniteData } from '@tanstack/react-query'
import {
  DEFAULT_MEETING_SETTINGS,
  type Meeting,
  type MeetingEvent,
  type MeetingListScope,
  type MeetingMessage,
  type MeetingMessagePage,
  type MeetingPage,
  type MeetingRoomRole,
  type MeetingSettings,
  type NoteScope,
  type RosterEntry,
} from '@/lib/api/meeting-types'

/**
 * TanStack Query keys for meetings + pure cache patches. STOMP events and mutations
 * patch the cache with these (setQueryData) instead of refetching. Every function
 * returns new objects and never mutates its input.
 */

export type MeetingListData = InfiniteData<MeetingPage, string | undefined>
export type MessageListData = InfiniteData<MeetingMessagePage, string | undefined>

export const meetingKeys = {
  all: ['meetings'] as const,
  list: (scope: MeetingListScope) => ['meetings', scope] as const,
  detail: (id: string) => ['meeting', id] as const,
  byCodeAll: ['meeting-code'] as const,
  byCode: (code: string) => ['meeting-code', code] as const,
  roster: (id: string) => ['meeting-roster', id] as const,
  hands: (id: string) => ['meeting-hands', id] as const,
  lobby: (id: string) => ['meeting-lobby', id] as const,
  messages: (id: string) => ['meeting-messages', id] as const,
  note: (id: string, scope: NoteScope) => ['meeting-note', id, scope] as const,
  myDepartments: ['meeting-my-departments'] as const,
}

/** Sort key the server uses: scheduledStart ?? createdAt. */
export function meetingSortAt(m: Pick<Meeting, 'scheduledStart' | 'createdAt'>): string {
  return m.scheduledStart ?? m.createdAt
}

const sortTime = (m: Meeting) => Date.parse(meetingSortAt(m))

function mapPages(
  data: MeetingListData,
  fn: (content: Meeting[], index: number) => Meeting[],
): MeetingListData {
  return { ...data, pages: data.pages.map((p, i) => ({ ...p, content: fn(p.content, i) })) }
}

const hasRow = (data: MeetingListData, id: string) =>
  data.pages.some((p) => p.content.some((m) => m.id === id))

/** Replace a row in place only if present (past list / any list). */
export function replaceInList(
  data: MeetingListData | undefined,
  m: Meeting,
): MeetingListData | undefined {
  if (!data || !hasRow(data, m.id)) return data
  return mapPages(data, (content) => content.map((row) => (row.id === m.id ? m : row)))
}

export function removeFromList(
  data: MeetingListData | undefined,
  id: string,
): MeetingListData | undefined {
  if (!data || !hasRow(data, id)) return data
  return mapPages(data, (content) => content.filter((row) => row.id !== id))
}

/** Replace the row with the same id, or insert it in ascending sortAt order. */
export function upsertUpcoming(
  data: MeetingListData | undefined,
  m: Meeting,
): MeetingListData | undefined {
  if (!data) return undefined
  if (hasRow(data, m.id)) return replaceInList(data, m)
  const at = sortTime(m)
  for (let pi = 0; pi < data.pages.length; pi++) {
    const idx = data.pages[pi].content.findIndex((row) => sortTime(row) > at)
    if (idx >= 0) {
      return mapPages(data, (content, i) =>
        i === pi ? [...content.slice(0, idx), m, ...content.slice(idx)] : content,
      )
    }
  }
  const lastIndex = data.pages.length - 1
  if (lastIndex < 0) {
    const page: MeetingPage = { content: [m], page: 0, size: 20, totalElements: 1, hasNext: false }
    return { pages: [page], pageParams: [undefined] }
  }
  // Later than every loaded row: it belongs here only when nothing is left to load —
  // otherwise the next page brings it in the right place.
  if (data.pages[lastIndex].hasNext) return data
  return mapPages(data, (content, i) => (i === lastIndex ? [...content, m] : content))
}

/** A list row built from meet.invited (status SCHEDULED, viewerRole invited, default settings). */
export function invitedPlaceholder(
  e: Extract<MeetingEvent, { event: 'meet.invited' }>,
  nowIso: string,
): Meeting {
  return {
    id: e.meetingId,
    code: e.code,
    ...(e.title ? { title: e.title } : {}),
    host: { userId: e.hostId ?? '', ...(e.hostName ? { displayName: e.hostName } : {}) },
    ...(e.scheduledStart ? { scheduledStart: e.scheduledStart } : {}),
    status: 'SCHEDULED',
    settings: { ...DEFAULT_MEETING_SETTINGS },
    viewerRole: 'invited',
    createdAt: nowIso,
  }
}

export function markEnded(
  m: Meeting | undefined,
  atIso: string,
  cancelled: boolean,
): Meeting | undefined {
  if (!m) return undefined
  if (m.status === 'ENDED') return m
  return cancelled
    ? { ...m, status: 'ENDED', cancelledAt: atIso }
    : { ...m, status: 'ENDED', endedAt: atIso }
}

export function withSettings(
  m: Meeting | undefined,
  settings: MeetingSettings,
): Meeting | undefined {
  return m ? { ...m, settings } : undefined
}

/** Open attendance rows → roster (current role from host/coHosts; one row per user, latest joinedAt). */
export function rosterFromMeeting(m: Meeting): RosterEntry[] {
  const cohosts = new Set((m.coHosts ?? []).map((p) => p.userId))
  const roleOf = (userId: string): MeetingRoomRole =>
    userId === m.host.userId ? 'host' : cohosts.has(userId) ? 'cohost' : 'attendee'
  const byUser = new Map<string, RosterEntry>()
  for (const row of m.attendance ?? []) {
    if (row.leftAt) continue
    const prev = byUser.get(row.userId)
    if (prev && Date.parse(prev.joinedAt) >= Date.parse(row.joinedAt)) continue
    byUser.set(row.userId, {
      userId: row.userId,
      ...(row.displayName ? { displayName: row.displayName } : {}),
      role: roleOf(row.userId),
      joinedAt: row.joinedAt,
    })
  }
  return [...byUser.values()]
}

/** Prepend a live chat line to the newest page; no-op if the id is already cached anywhere. */
export function appendMessage(
  data: MessageListData | undefined,
  msg: MeetingMessage,
): MessageListData {
  if (!data || data.pages.length === 0) {
    const page: MeetingMessagePage = { content: [msg], page: 0, size: 50, totalElements: 1, hasNext: false }
    return { pages: [page], pageParams: [undefined] }
  }
  if (data.pages.some((p) => p.content.some((m) => m.id === msg.id))) return data
  return {
    ...data,
    pages: data.pages.map((p, i) => (i === 0 ? { ...p, content: [msg, ...p.content] } : p)),
  }
}

/** All cached lines oldest → newest (pages are newest-first). */
export function flattenMessages(data: Pick<MessageListData, 'pages'> | undefined): MeetingMessage[] {
  if (!data) return []
  return data.pages.flatMap((p) => p.content).reverse()
}
