import { describe, it, expect } from 'vitest'
import { durationLabel, personName } from '@/lib/meetings/display'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key

describe('personName', () => {
  it('never returns an id', () => {
    expect(personName({ userId: 'u1', displayName: 'An' }, 'X')).toBe('An')
    expect(personName({ userId: 'u1', displayName: 'u1' }, 'X')).toBe('X')
    expect(personName({ userId: 'u1', displayName: '64b0aaaaaaaaaaaaaaaaaaaa' }, 'X')).toBe('X')
    expect(personName({ userId: 'u1' }, 'X')).toBe('X')
    expect(personName(undefined, 'X')).toBe('X')
  })
})

describe('durationLabel', () => {
  it('picks minutes, whole hours or both', () => {
    expect(durationLabel(t, 45)).toBe('durationMinutes(45)')
    expect(durationLabel(t, 120)).toBe('durationHours(2)')
    expect(durationLabel(t, 90)).toBe('durationHoursMinutes(1,30)')
  })
})
