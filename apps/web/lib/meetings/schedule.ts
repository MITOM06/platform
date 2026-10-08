import type { Meeting } from '@/lib/api/meeting-types'

/**
 * Meeting times: the form edits a local wall-clock date + time in the browser's zone
 * plus a length; the server only ever receives ISO UTC with `Z`.
 */

/** What the form edits. */
export interface LocalSchedule {
  /** YYYY-MM-DD, local. */
  date: string
  /** HH:mm, local. */
  time: string
  durationMinutes: number
}

export const DURATION_PRESETS: readonly number[] = [15, 30, 45, 60, 90, 120, 180, 240]
const DEFAULT_DURATION = 30

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

const pad = (n: number) => String(n).padStart(2, '0')
/** Local calendar date — never `toISOString().slice`, which is the UTC date. */
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** A local calendar day as YYYY-MM-DD (for the date picker). */
export const toLocalDateString = localDate

/** YYYY-MM-DD → local midnight, or undefined when malformed. */
export function parseLocalDate(date: string): Date | undefined {
  const m = DATE_RE.exec(date)
  if (!m) return undefined
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return toLocalDateString(d) === date ? d : undefined
}

/** Local wall-clock → UTC ISO with `Z`; null when malformed or not a real local time (Feb 30, DST gap). */
export function localToUtcIso(date: string, time: string): string | null {
  const dm = DATE_RE.exec(date)
  const tm = TIME_RE.exec(time)
  if (!dm || !tm) return null
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])]
  const [h, mi] = [Number(tm[1]), Number(tm[2])]
  const local = new Date(y, mo - 1, d, h, mi)
  const real =
    local.getFullYear() === y &&
    local.getMonth() === mo - 1 &&
    local.getDate() === d &&
    local.getHours() === h &&
    local.getMinutes() === mi
  return real ? local.toISOString() : null
}

export function buildSchedule(
  s: LocalSchedule,
): { scheduledStart: string; scheduledEnd: string } | null {
  const start = localToUtcIso(s.date, s.time)
  if (!start || !Number.isFinite(s.durationMinutes)) return null
  const end = new Date(Date.parse(start) + s.durationMinutes * 60_000)
  return { scheduledStart: start, scheduledEnd: end.toISOString() }
}

export function scheduleFromMeeting(
  m: Pick<Meeting, 'scheduledStart' | 'scheduledEnd'>,
): LocalSchedule | null {
  if (!m.scheduledStart) return null
  const start = new Date(m.scheduledStart)
  if (Number.isNaN(start.getTime())) return null
  const end = m.scheduledEnd ? Date.parse(m.scheduledEnd) : NaN
  const minutes = Number.isNaN(end) ? DEFAULT_DURATION : Math.round((end - start.getTime()) / 60_000)
  return {
    date: localDate(start),
    time: localTime(start),
    durationMinutes: minutes > 0 ? minutes : DEFAULT_DURATION,
  }
}

/** Next :00/:30 strictly after now, 30 minutes. */
export function defaultSchedule(now: Date): LocalSchedule {
  const d = new Date(now.getTime())
  d.setSeconds(0, 0)
  if (d.getMinutes() < 30) d.setMinutes(30)
  else d.setHours(d.getHours() + 1, 0)
  return { date: localDate(d), time: localTime(d), durationMinutes: DEFAULT_DURATION }
}

/** Presets plus `current` when it is not one of them, ascending. */
export function durationOptions(current?: number): number[] {
  const out = [...DURATION_PRESETS]
  if (current !== undefined && current > 0 && !out.includes(current)) out.push(current)
  return out.sort((a, b) => a - b)
}

export function splitDuration(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 }
}

/** "GMT+7" style label of the browser zone at `at`. */
export function timeZoneLabel(locale: string, at: Date): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZoneName: 'shortOffset' }).formatToParts(at)
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  }
}

/** Locale-formatted "date, start – end" or just the start. */
export function formatMeetingRange(locale: string, startIso: string, endIso?: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const start = new Date(startIso)
  if (Number.isNaN(start.getTime())) return ''
  const end = endIso ? new Date(endIso) : null
  if (end && !Number.isNaN(end.getTime()) && end.getTime() >= start.getTime()) {
    return fmt.formatRange(start, end)
  }
  return fmt.format(start)
}
