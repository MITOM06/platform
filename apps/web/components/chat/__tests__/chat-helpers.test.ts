import { describe, it, expect } from 'vitest'
import {
  getInitials, formatTime, formatMuteExpiry, MUTE_OPTIONS, MUTE_FOREVER_MS,
} from '@/components/chat/conversation-item-helpers'
import { splitFit, THEME_CATEGORIES, THEMED_PRESETS, FIT_OPTIONS } from '@/components/chat/wallpaper-presets'

describe('conversation-item-helpers', () => {
  it('getInitials takes the first letter of the first two words, uppercased', () => {
    expect(getInitials('ann bee cee')).toBe('AB')
    expect(getInitials('zed')).toBe('Z')
  })

  it('formatTime: empty for null, time for today, date otherwise', () => {
    expect(formatTime(null, 'en')).toBe('')
    const now = new Date()
    expect(formatTime(now.toISOString(), 'en-GB')).toBe(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    const old = new Date('2020-03-04T10:00:00Z')
    expect(formatTime(old.toISOString(), 'en-GB')).toBe(old.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }))
  })

  it('formatMuteExpiry picks minutes / hours / days and blanks expired', () => {
    const now = 1_000_000
    expect(formatMuteExpiry(now, 'en', now)).toBe('')
    expect(formatMuteExpiry(now - 1, 'en', now)).toBe('')
    expect(formatMuteExpiry(now + 90_000, 'en', now)).toBe('2 min')
    expect(formatMuteExpiry(now + 3 * 3_600_000, 'en', now)).toBe('3 hr')
    expect(formatMuteExpiry(now + 50 * 3_600_000, 'en', now)).toBe('2 days')
    expect(formatMuteExpiry(Date.now() + 120_000)).toBe('2 min')
  })

  it('mute options end with forever (-1) and the forever sentinel is far future', () => {
    expect(MUTE_OPTIONS.map((o) => o.seconds)).toEqual([900, 1800, 3600, 86400, -1])
    expect(MUTE_FOREVER_MS).toBeGreaterThan(Date.parse('9999-01-01'))
  })
})

describe('wallpaper-presets', () => {
  it('splitFit without a hash defaults to cover / 100', () => {
    expect(splitFit('preset:storm')).toEqual({ value: 'preset:storm', fit: 'cover', scale: 100 })
  })

  it('splitFit parses fit and scale, rejecting invalid values', () => {
    expect(splitFit('https://x/a.jpg#fit=contain&scale=150')).toEqual({ value: 'https://x/a.jpg', fit: 'contain', scale: 150 })
    expect(splitFit('u#fit=fill')).toEqual({ value: 'u', fit: 'fill', scale: 100 })
    expect(splitFit('u#fit=stretch&scale=0')).toEqual({ value: 'u', fit: 'cover', scale: 100 })
    expect(splitFit('u#scale=abc')).toEqual({ value: 'u', fit: 'cover', scale: 100 })
  })

  it('catalogue values are unique, prefixed and themed URLs carry no #fit suffix', () => {
    const values = THEME_CATEGORIES.flatMap((c) => c.items.map((i) => i.value))
    expect(new Set(values).size).toBe(values.length)
    expect(values.every((v) => v.startsWith('preset:'))).toBe(true)
    expect(THEME_CATEGORIES.map((c) => c.id)).toEqual(['colors', 'vibrant', 'minimal'])
    expect(THEMED_PRESETS).toHaveLength(8)
    expect(THEMED_PRESETS.every((p) => !p.value.includes('#') && p.value.startsWith('https://images.unsplash.com/'))).toBe(true)
    expect(FIT_OPTIONS).toEqual(['cover', 'contain', 'fill'])
  })
})
