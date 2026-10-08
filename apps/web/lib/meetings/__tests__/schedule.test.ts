import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import {
  buildSchedule, defaultSchedule, durationOptions, formatMeetingRange, localToUtcIso,
  scheduleFromMeeting, splitDuration, timeZoneLabel,
} from '@/lib/meetings/schedule'

const previousTz = process.env.TZ
beforeAll(() => { process.env.TZ = 'Asia/Ho_Chi_Minh' })   // UTC+7, no DST
afterAll(() => { process.env.TZ = previousTz })

describe('local wall clock ⇄ UTC', () => {
  it('sends UTC with Z', () => {
    expect(localToUtcIso('2026-10-08', '09:00')).toBe('2026-10-08T02:00:00.000Z')
    expect(localToUtcIso('2026-10-08', '00:30')).toBe('2026-10-07T17:30:00.000Z')
  })

  it('rejects malformed and impossible dates', () => {
    expect(localToUtcIso('2026-02-30', '09:00')).toBeNull()
    expect(localToUtcIso('2026-10-08', '9:00')).toBeNull()
    expect(localToUtcIso('', '09:00')).toBeNull()
    expect(localToUtcIso('2026-10-08', '24:00')).toBeNull()
  })

  it('builds start and end from a duration', () => {
    expect(buildSchedule({ date: '2026-10-08', time: '09:00', durationMinutes: 90 })).toEqual({
      scheduledStart: '2026-10-08T02:00:00.000Z',
      scheduledEnd: '2026-10-08T03:30:00.000Z',
    })
    expect(buildSchedule({ date: 'x', time: '09:00', durationMinutes: 30 })).toBeNull()
  })

  it('reads a stored schedule back in local time', () => {
    expect(scheduleFromMeeting({ scheduledStart: '2026-10-08T02:00:00Z', scheduledEnd: '2026-10-08T02:45:00Z' }))
      .toEqual({ date: '2026-10-08', time: '09:00', durationMinutes: 45 })
    expect(scheduleFromMeeting({ scheduledStart: '2026-10-08T02:00:00Z' }))
      .toEqual({ date: '2026-10-08', time: '09:00', durationMinutes: 30 })
    expect(scheduleFromMeeting({})).toBeNull()
  })

  it('defaults to the next half hour', () => {
    expect(defaultSchedule(new Date('2026-10-08T02:10:00Z'))).toEqual({ date: '2026-10-08', time: '09:30', durationMinutes: 30 })
    expect(defaultSchedule(new Date('2026-10-08T02:30:00Z'))).toEqual({ date: '2026-10-08', time: '10:00', durationMinutes: 30 })
    expect(defaultSchedule(new Date('2026-10-08T16:50:00Z'))).toEqual({ date: '2026-10-09', time: '00:00', durationMinutes: 30 })
  })

  it('labels the zone with its offset', () => {
    expect(timeZoneLabel('en', new Date('2026-10-08T02:00:00Z'))).toBe('GMT+7')
  })
})

describe('durations', () => {
  it('keeps a custom stored duration selectable', () => {
    expect(durationOptions()).toEqual([15, 30, 45, 60, 90, 120, 180, 240])
    expect(durationOptions(50)).toEqual([15, 30, 45, 50, 60, 90, 120, 180, 240])
    expect(durationOptions(60)).toHaveLength(8)
  })

  it('splits minutes for display', () => {
    expect(splitDuration(90)).toEqual({ hours: 1, minutes: 30 })
    expect(splitDuration(45)).toEqual({ hours: 0, minutes: 45 })
  })
})

describe('formatMeetingRange', () => {
  it('uses the locale and never a hardcoded pattern', () => {
    const en = formatMeetingRange('en', '2026-10-08T02:00:00Z', '2026-10-08T03:00:00Z')
    expect(en).toContain('9:00')
    expect(en).toContain('10:00')
    expect(formatMeetingRange('vi', '2026-10-08T02:00:00Z')).toContain('09:00')
  })
})

describe('date picker helpers', () => {
  it('round-trips a local calendar day', async () => {
    const { parseLocalDate, toLocalDateString } = await import('@/lib/meetings/schedule')
    const d = parseLocalDate('2026-10-08')
    expect(d && toLocalDateString(d)).toBe('2026-10-08')
    expect(d?.getHours()).toBe(0)
    expect(parseLocalDate('2026-02-30')).toBeUndefined()
    expect(parseLocalDate('nope')).toBeUndefined()
  })
})
