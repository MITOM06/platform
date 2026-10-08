import {
  DEFAULT_MEETING_SETTINGS,
  MEETING_LIMITS,
  type Meeting,
  type MeetingInput,
  type MeetingPerson,
  type MeetingSettings,
} from '@/lib/api/meeting-types'
import type { MessageKey } from './meeting-errors'
import { buildSchedule, defaultSchedule, scheduleFromMeeting, type LocalSchedule } from './schedule'

/** Create / edit / meet-again form: values, client-side validation, request body. */

export interface MeetingFormValues {
  title: string
  description: string
  invitees: MeetingPerson[]
  /** '' = none */
  departmentId: string
  scheduled: boolean
  schedule: LocalSchedule
  settings: MeetingSettings
}

export type MeetingFormField = 'title' | 'description' | 'invitees' | 'schedule'
export type MeetingFormErrors = Partial<Record<MeetingFormField, MessageKey>>

export function emptyMeetingForm(now: Date): MeetingFormValues {
  return {
    title: '',
    description: '',
    invitees: [],
    departmentId: '',
    scheduled: false,
    schedule: defaultSchedule(now),
    settings: { ...DEFAULT_MEETING_SETTINGS },
  }
}

/** 'edit' keeps the schedule; 'again' copies people/options but starts unscheduled. */
export function formFromMeeting(m: Meeting, mode: 'edit' | 'again', now: Date): MeetingFormValues {
  const stored = mode === 'edit' ? scheduleFromMeeting(m) : null
  return {
    title: m.title ?? '',
    description: m.description ?? '',
    invitees: (m.invitees ?? []).map((p) => ({ ...p })),
    departmentId: m.departmentId ?? '',
    scheduled: !!stored,
    schedule: stored ?? defaultSchedule(now),
    settings: { ...DEFAULT_MEETING_SETTINGS, ...m.settings },
  }
}

const uniqueIds = (people: MeetingPerson[]) => [...new Set(people.map((p) => p.userId))]

/** The UTC schedule the form would send, or null when it sends none / it is invalid. */
function scheduleChange(v: MeetingFormValues, original?: Meeting) {
  if (!v.scheduled || original?.status === 'LIVE') return { send: false as const }
  const built = buildSchedule(v.schedule)
  if (
    built &&
    original?.scheduledStart &&
    Date.parse(built.scheduledStart) === Date.parse(original.scheduledStart) &&
    original.scheduledEnd &&
    Date.parse(built.scheduledEnd) === Date.parse(original.scheduledEnd)
  ) {
    return { send: false as const }
  }
  return { send: true as const, built }
}

/** Client-side limits; schedule checked only when it is new/changed and the meeting is not LIVE. */
export function validateMeetingForm(
  v: MeetingFormValues,
  now: Date,
  original?: Meeting,
): MeetingFormErrors {
  const errors: MeetingFormErrors = {}
  if (v.title.trim().length > MEETING_LIMITS.title) {
    errors.title = { key: 'valTitleTooLong', values: { max: MEETING_LIMITS.title } }
  }
  if (v.description.length > MEETING_LIMITS.description) {
    errors.description = { key: 'valDescriptionTooLong', values: { max: MEETING_LIMITS.description } }
  }
  if (uniqueIds(v.invitees).length > MEETING_LIMITS.invitees) {
    errors.invitees = { key: 'valTooManyInvitees', values: { max: MEETING_LIMITS.invitees } }
  }
  const change = scheduleChange(v, original)
  if (change.send) {
    const d = v.schedule.durationMinutes
    if (!change.built || !(d > 0) || d > MEETING_LIMITS.maxDurationMinutes) {
      errors.schedule = { key: 'valScheduleInvalid' }
    } else if (
      Date.parse(change.built.scheduledStart) <
      now.getTime() - MEETING_LIMITS.startGraceMinutes * 60_000
    ) {
      errors.schedule = { key: 'valStartPast' }
    }
  }
  return errors
}

/**
 * Create (no original) or PATCH body (only what the contract needs; '' clears).
 * `original` must be the meeting as the dialog opened it (its initial values).
 */
export function toMeetingInput(v: MeetingFormValues, original?: Meeting): MeetingInput {
  const title = v.title.trim()
  const description = v.description.trim() ? v.description : ''
  const input: MeetingInput = {}
  const change = scheduleChange(v, original)
  const schedule = change.send ? change.built : null

  if (!original) {
    if (title) input.title = title
    if (description) input.description = description
    const ids = uniqueIds(v.invitees)
    if (ids.length) input.inviteeIds = ids
    if (v.departmentId) input.departmentId = v.departmentId
  } else {
    if (title !== (original.title ?? '')) input.title = title
    if (description !== (original.description ?? '')) input.description = description
    if (v.departmentId !== (original.departmentId ?? '')) input.departmentId = v.departmentId
    input.inviteeIds = uniqueIds(v.invitees)
  }
  if (schedule) {
    input.scheduledStart = schedule.scheduledStart
    input.scheduledEnd = schedule.scheduledEnd
  }
  if (!original) {
    input.settings = { ...v.settings }
  } else {
    const changed = changedSettings(formFromMeeting(original, 'edit', new Date()).settings, v.settings)
    if (changed) input.settings = changed
  }
  return input
}

/**
 * Edit: only the switches the user flipped in this dialog. `initial` is what the dialog
 * opened with — the others may have been changed in the room meanwhile, and re-sending a
 * stale copy would undo that.
 */
function changedSettings(
  initial: MeetingSettings,
  next: MeetingSettings,
): Partial<MeetingSettings> | null {
  const keys = (Object.keys(next) as (keyof MeetingSettings)[]).filter((k) => next[k] !== initial[k])
  if (!keys.length) return null
  return Object.fromEntries(keys.map((k) => [k, next[k]])) as Partial<MeetingSettings>
}
