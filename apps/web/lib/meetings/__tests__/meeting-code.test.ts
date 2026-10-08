import { describe, it, expect } from 'vitest'
import { meetingLink, meetingPath, parseMeetingCodeInput } from '@/lib/meetings/meeting-code'

describe('parseMeetingCodeInput', () => {
  it.each([
    ['abc-defg-hjk', 'abc-defg-hjk'],
    ['ABC-DEFG-HJK', 'abc-defg-hjk'],
    ['abcdefghjk', 'abc-defg-hjk'],
    ['  abc defg hjk ', 'abc-defg-hjk'],
    ['https://pon.example.com/meet/abc-defg-hjk', 'abc-defg-hjk'],
    ['https://pon.example.com/meet/abc-defg-hjk?x=1#y', 'abc-defg-hjk'],
    ['/meet/ABCDEFGHJK', 'abc-defg-hjk'],
  ])('%s → %s', (raw, code) => {
    expect(parseMeetingCodeInput(raw)).toBe(code)
  })

  it.each(['', 'abc', 'abc-defg-hji', 'abc-defg-hjl', 'abc-defg-hjo', 'abc-defg-hj1', 'https://evil.com/x'])(
    'rejects %s', (raw) => {
      expect(parseMeetingCodeInput(raw)).toBeNull()
    })

  it('builds the path and the shareable link', () => {
    expect(meetingPath('abc-defg-hjk')).toBe('/meet/abc-defg-hjk')
    expect(meetingLink('abc-defg-hjk', 'https://pon.example.com')).toBe('https://pon.example.com/meet/abc-defg-hjk')
  })
})
