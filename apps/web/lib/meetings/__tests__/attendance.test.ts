import { describe, it, expect } from 'vitest'
import { summarizeAttendance } from '@/lib/meetings/attendance'

const NOW = new Date('2026-10-08T03:00:00Z')

describe('summarizeAttendance', () => {
  it('merges sessions per person and sums their time', () => {
    const out = summarizeAttendance([
      { userId: 'a', displayName: 'An', role: 'host', joinedAt: '2026-10-08T02:00:00Z', leftAt: '2026-10-08T02:10:00Z' },
      { userId: 'b', role: 'attendee', joinedAt: '2026-10-08T02:05:00Z', leftAt: '2026-10-08T02:06:00Z' },
      { userId: 'a', displayName: 'An', role: 'host', joinedAt: '2026-10-08T02:20:00Z', leftAt: '2026-10-08T02:30:00Z' },
    ], NOW)
    expect(out).toEqual([
      { userId: 'a', displayName: 'An', role: 'host', firstJoinedAt: '2026-10-08T02:00:00Z',
        lastLeftAt: '2026-10-08T02:30:00Z', totalSeconds: 1200, sessions: 2, inside: false },
      { userId: 'b', role: 'attendee', firstJoinedAt: '2026-10-08T02:05:00Z',
        lastLeftAt: '2026-10-08T02:06:00Z', totalSeconds: 60, sessions: 1, inside: false },
    ])
  })

  it('counts overlapping sessions from two devices once', () => {
    const [a] = summarizeAttendance([
      { userId: 'a', role: 'attendee', joinedAt: '2026-10-08T02:00:00Z', leftAt: '2026-10-08T02:30:00Z' },
      { userId: 'a', role: 'attendee', joinedAt: '2026-10-08T02:10:00Z', leftAt: '2026-10-08T02:20:00Z' },
    ], NOW)
    expect(a.totalSeconds).toBe(1800)
  })

  it('runs an open session until the end of the meeting, or now', () => {
    const rows = [{ userId: 'a', role: 'cohost' as const, joinedAt: '2026-10-08T02:50:00Z' }]
    expect(summarizeAttendance(rows, NOW)[0]).toMatchObject({ totalSeconds: 600, inside: true })
    expect(summarizeAttendance(rows, NOW, '2026-10-08T02:55:00Z')[0]).toMatchObject({ totalSeconds: 300, inside: false })
  })

  it('keeps the highest role and the latest name', () => {
    const [a] = summarizeAttendance([
      { userId: 'a', role: 'attendee', joinedAt: '2026-10-08T02:00:00Z', leftAt: '2026-10-08T02:01:00Z' },
      { userId: 'a', displayName: 'An', role: 'cohost', joinedAt: '2026-10-08T02:02:00Z', leftAt: '2026-10-08T02:03:00Z' },
    ], NOW)
    expect(a).toMatchObject({ role: 'cohost', displayName: 'An' })
    expect(summarizeAttendance(undefined, NOW)).toEqual([])
  })
})
