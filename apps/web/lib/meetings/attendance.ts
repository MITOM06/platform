import type { MeetingAttendance, MeetingRoomRole } from '@/lib/api/meeting-types'

/** Attendance rows (one per join) → one summary per person for the detail page. */

export interface AttendanceSummary {
  userId: string
  displayName?: string
  role: MeetingRoomRole
  firstJoinedAt: string
  lastLeftAt?: string
  totalSeconds: number
  sessions: number
  inside: boolean
}

const RANK: Record<MeetingRoomRole, number> = { attendee: 0, cohost: 1, host: 2 }

/** Total length of the union of [start, end) intervals, in ms. */
function unionLength(intervals: [number, number][]): number {
  const sorted = intervals.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0])
  let total = 0
  let cur: [number, number] | null = null
  for (const [s, e] of sorted) {
    if (cur && s <= cur[1]) {
      cur[1] = Math.max(cur[1], e)
    } else {
      if (cur) total += cur[1] - cur[0]
      cur = [s, e]
    }
  }
  return cur ? total + (cur[1] - cur[0]) : total
}

/** One row per person: overlapping sessions (two devices) counted once; open rows run until endedAt ?? now. */
export function summarizeAttendance(
  rows: MeetingAttendance[] | undefined,
  now: Date,
  endedAt?: string,
): AttendanceSummary[] {
  if (!rows?.length) return []
  const endCap = endedAt ? Date.parse(endedAt) : now.getTime()
  const byUser = new Map<string, MeetingAttendance[]>()
  for (const row of rows) {
    const list = byUser.get(row.userId)
    if (list) list.push(row)
    else byUser.set(row.userId, [row])
  }
  const out: AttendanceSummary[] = []
  for (const [userId, list] of byUser) {
    const byJoin = [...list].sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt))
    const named = [...byJoin].reverse().find((r) => r.displayName)
    const lefts = byJoin.map((r) => r.leftAt).filter((v): v is string => !!v)
    const lastLeftAt = lefts.sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1)
    const role = byJoin.reduce<MeetingRoomRole>((best, r) => (RANK[r.role] > RANK[best] ? r.role : best), 'attendee')
    const ms = unionLength(
      byJoin.map((r) => [Date.parse(r.joinedAt), r.leftAt ? Date.parse(r.leftAt) : endCap]),
    )
    out.push({
      userId,
      ...(named?.displayName ? { displayName: named.displayName } : {}),
      role,
      firstJoinedAt: byJoin[0].joinedAt,
      ...(lastLeftAt ? { lastLeftAt } : {}),
      totalSeconds: Math.round(ms / 1000),
      sessions: byJoin.length,
      inside: !endedAt && byJoin.some((r) => !r.leftAt),
    })
  }
  return out.sort((a, b) => Date.parse(a.firstJoinedAt) - Date.parse(b.firstJoinedAt))
}
