import { describe, it, expect } from 'vitest'
import type { Meeting } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import {
  canRejoin, initialPhase, isTerminal, phaseAfterJoin, phaseAfterJoinError, phaseAfterPersonalEvent,
  phaseAfterRoomClosed,
} from '@/lib/meetings/room-phase'

const m = (status: Meeting['status']): Meeting => ({ id: 'm1', code: 'abc-defg-hjk', host: { userId: 'h' }, status,
  settings: DEFAULT_MEETING_SETTINGS, viewerRole: 'guest', createdAt: 't' })

describe('room phases', () => {
  it('starts on the pre-join screen, or goes to the details of an ended meeting', () => {
    expect(initialPhase(undefined, null)).toBe('loading')
    expect(initialPhase(m('LIVE'), null)).toBe('prejoin')
    expect(initialPhase(m('SCHEDULED'), null)).toBe('prejoin')
    expect(initialPhase(m('ENDED'), null)).toBe('ended')
    expect(initialPhase(undefined, { status: 404, code: 'MEETING_NOT_FOUND' })).toBe('notFound')
    expect(initialPhase(undefined, { network: true })).toBe('error')
  })

  it('follows the join response', () => {
    expect(phaseAfterJoin({ status: 'waiting' })).toBe('waiting')
    expect(phaseAfterJoin({ status: 'joined', url: 'wss://x', token: 't', role: 'attendee' })).toBe('connecting')
  })

  it.each([
    [{ status: 403, code: 'MEETING_REMOVED' }, 'removed'],
    [{ status: 403, code: 'MEETING_LOCKED' }, 'locked'],
    [{ status: 409, code: 'MEETING_ENDED' }, 'ended'],
    [{ status: 409, code: 'MEETING_FULL' }, 'full'],
    [{ status: 503, code: 'MEETINGS_UNAVAILABLE' }, 'unavailable'],
    [{ status: 503 }, 'unavailable'],
    [{ status: 404, code: 'MEETING_NOT_FOUND' }, 'notFound'],
    [{ network: true }, 'error'],
  ])('join error %o → %s', (info, phase) => {
    expect(phaseAfterJoinError(info)).toBe(phase)
  })

  it('reacts to the waiting room answers only while waiting', () => {
    expect(phaseAfterPersonalEvent('waiting', { event: 'meet.admitted', meetingId: 'm1' })).toBe('rejoin')
    expect(phaseAfterPersonalEvent('inRoom', { event: 'meet.admitted', meetingId: 'm1' })).toBeNull()
    expect(phaseAfterPersonalEvent('waiting', { event: 'meet.denied', meetingId: 'm1' })).toBe('denied')
    expect(phaseAfterPersonalEvent('prejoin', { event: 'meet.denied', meetingId: 'm1' })).toBeNull()
  })

  it('removal and the end win over any live phase, never over a terminal one', () => {
    for (const phase of ['joining', 'waiting', 'connecting', 'inRoom'] as const) {
      expect(phaseAfterPersonalEvent(phase, { event: 'meet.removed', meetingId: 'm1' })).toBe('removed')
    }
    expect(phaseAfterPersonalEvent('prejoin', { event: 'meet.ended', meetingId: 'm1' })).toBe('ended')
    expect(phaseAfterPersonalEvent('waiting', { event: 'meet.cancelled', meetingId: 'm1' })).toBe('ended')
    expect(phaseAfterPersonalEvent('removed', { event: 'meet.ended', meetingId: 'm1' })).toBeNull()
    expect(phaseAfterPersonalEvent('inRoom', { event: 'meet.muted', meetingId: 'm1' })).toBeNull()
  })

  it('tells a dropped connection from a closed room', () => {
    expect(phaseAfterRoomClosed('failed')).toBe('connectionLost')
    expect(phaseAfterRoomClosed('ended')).toBe('verify')
  })

  it('knows which screens offer a way back in', () => {
    expect(isTerminal('removed')).toBe(true)
    expect(isTerminal('left')).toBe(false)
    expect(canRejoin('left')).toBe(true)
    expect(canRejoin('connectionLost')).toBe(true)
    expect(canRejoin('removed')).toBe(false)
    expect(canRejoin('denied')).toBe(false)
  })
})
