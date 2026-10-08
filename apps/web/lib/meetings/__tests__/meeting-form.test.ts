import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import type { Meeting } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import {
  emptyMeetingForm, formFromMeeting, toMeetingInput, validateMeetingForm, type MeetingFormValues,
} from '@/lib/meetings/meeting-form'

const previousTz = process.env.TZ
beforeAll(() => { process.env.TZ = 'Asia/Ho_Chi_Minh' })
afterAll(() => { process.env.TZ = previousTz })

const NOW = new Date('2026-10-08T02:10:00Z') // 09:10 local

function form(over: Partial<MeetingFormValues> = {}): MeetingFormValues {
  return { ...emptyMeetingForm(NOW), ...over }
}
function meeting(over: Partial<Meeting> = {}): Meeting {
  return { id: 'm1', code: 'abc-defg-hjk', title: 'Weekly', description: 'Agenda',
    host: { userId: 'h' }, invitees: [{ userId: 'a', displayName: 'An' }], departmentId: 'd1',
    scheduledStart: '2026-10-09T02:00:00Z', scheduledEnd: '2026-10-09T03:00:00Z', status: 'SCHEDULED',
    settings: { ...DEFAULT_MEETING_SETTINGS, waitingRoom: false }, viewerRole: 'host',
    createdAt: '2026-10-07T00:00:00Z', ...over }
}

describe('validateMeetingForm', () => {
  it('accepts an empty instant meeting', () => {
    expect(validateMeetingForm(form(), NOW)).toEqual({})
  })

  it('enforces the contract limits', () => {
    const errors = validateMeetingForm(form({
      title: 'x'.repeat(121), description: 'y'.repeat(2001),
      invitees: Array.from({ length: 101 }, (_, i) => ({ userId: `u${i}` })),
    }), NOW)
    expect(errors).toEqual({
      title: { key: 'valTitleTooLong', values: { max: 120 } },
      description: { key: 'valDescriptionTooLong', values: { max: 2000 } },
      invitees: { key: 'valTooManyInvitees', values: { max: 100 } },
    })
    expect(validateMeetingForm(form({ title: `  ${'x'.repeat(120)}  ` }), NOW)).toEqual({})
  })

  it('checks a new schedule but allows the 5-minute grace', () => {
    const at = (time: string) => form({ scheduled: true, schedule: { date: '2026-10-08', time, durationMinutes: 30 } })
    expect(validateMeetingForm(at('09:00'), NOW).schedule).toEqual({ key: 'valStartPast' })
    expect(validateMeetingForm(at('09:06'), NOW)).toEqual({})
    expect(validateMeetingForm(form({ scheduled: true, schedule: { date: '2026-02-30', time: '09:00', durationMinutes: 30 } }), NOW).schedule)
      .toEqual({ key: 'valScheduleInvalid' })
    expect(validateMeetingForm(form({ scheduled: true, schedule: { date: '2026-10-09', time: '09:00', durationMinutes: 1441 } }), NOW).schedule)
      .toEqual({ key: 'valScheduleInvalid' })
  })

  it('does not re-check an unchanged schedule that has already passed, nor a LIVE one', () => {
    const past = meeting({ scheduledStart: '2026-10-08T01:00:00Z', scheduledEnd: '2026-10-08T02:00:00Z' })
    expect(validateMeetingForm(formFromMeeting(past, 'edit', NOW), NOW, past)).toEqual({})
    const live = meeting({ status: 'LIVE' })
    const edited = { ...formFromMeeting(live, 'edit', NOW), schedule: { date: '2026-10-08', time: '08:00', durationMinutes: 30 } }
    expect(validateMeetingForm(edited, NOW, live)).toEqual({})
  })
})

describe('toMeetingInput — create', () => {
  it('sends only the settings for an untouched form', () => {
    expect(toMeetingInput(form())).toEqual({ settings: DEFAULT_MEETING_SETTINGS })
  })

  it('sends a trimmed title, unique invitees, the department and a UTC schedule', () => {
    expect(toMeetingInput(form({
      title: '  Sprint review ', description: 'Demo', departmentId: 'd1',
      invitees: [{ userId: 'a' }, { userId: 'b' }, { userId: 'a' }],
      scheduled: true, schedule: { date: '2026-10-09', time: '14:00', durationMinutes: 60 },
    }))).toEqual({
      title: 'Sprint review', description: 'Demo', inviteeIds: ['a', 'b'], departmentId: 'd1',
      scheduledStart: '2026-10-09T07:00:00.000Z', scheduledEnd: '2026-10-09T08:00:00.000Z',
      settings: DEFAULT_MEETING_SETTINGS,
    })
  })
})

describe('toMeetingInput — edit (PATCH)', () => {
  it('clears fields with empty strings and always replaces invitees', () => {
    const m = meeting()
    const v = { ...formFromMeeting(m, 'edit', NOW), title: '', description: '', departmentId: '', invitees: [] }
    expect(toMeetingInput(v, m)).toEqual({
      title: '', description: '', departmentId: '', inviteeIds: [],
    })
  })

  it('sends only the switches the user changed, never a stale copy of the others', () => {
    const m = meeting({ status: 'LIVE' })
    const untouched = formFromMeeting(m, 'edit', NOW)
    expect(toMeetingInput(untouched, m)).not.toHaveProperty('settings')

    const flipped = { ...untouched, settings: { ...untouched.settings, muteOnEntry: !untouched.settings.muteOnEntry } }
    expect(toMeetingInput(flipped, m).settings).toEqual({ muteOnEntry: !untouched.settings.muteOnEntry })

    const back = { ...flipped, settings: { ...untouched.settings } }
    expect(toMeetingInput(back, m)).not.toHaveProperty('settings')
  })

  it('sends the schedule only when it changed and the meeting is not LIVE', () => {
    const m = meeting()
    const moved = { ...formFromMeeting(m, 'edit', NOW), schedule: { date: '2026-10-09', time: '10:00', durationMinutes: 60 } }
    expect(toMeetingInput(moved, m)).toMatchObject({
      scheduledStart: '2026-10-09T03:00:00.000Z', scheduledEnd: '2026-10-09T04:00:00.000Z',
    })
    expect(toMeetingInput(formFromMeeting(m, 'edit', NOW), m)).not.toHaveProperty('scheduledStart')
    expect(toMeetingInput(moved, meeting({ status: 'LIVE' }))).not.toHaveProperty('scheduledStart')
  })
})

describe('formFromMeeting', () => {
  it('"meet again" copies people and options but starts now', () => {
    const v = formFromMeeting(meeting({ status: 'ENDED' }), 'again', NOW)
    expect(v).toMatchObject({ title: 'Weekly', description: 'Agenda', departmentId: 'd1', scheduled: false,
      invitees: [{ userId: 'a', displayName: 'An' }] })
    expect(v.settings.waitingRoom).toBe(false)
  })

  it('"edit" loads the stored schedule in local time', () => {
    expect(formFromMeeting(meeting(), 'edit', NOW)).toMatchObject({
      scheduled: true, schedule: { date: '2026-10-09', time: '09:00', durationMinutes: 60 },
    })
  })
})
