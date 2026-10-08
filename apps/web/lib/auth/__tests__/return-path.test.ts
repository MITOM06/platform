import { describe, it, expect } from 'vitest'
import { consumeReturnPath, isSafeReturnPath, RETURN_PATH_COOKIE } from '@/lib/auth/return-path'

describe('isSafeReturnPath', () => {
  it.each(['/meet/abc-defg-hjk', '/meetings', '/meetings/670f1c2ab9e4d21f0c3a9e11'])('allows %s', (p) => {
    expect(isSafeReturnPath(p)).toBe(true)
  })
  it.each(['//evil.com', 'https://evil.com/meet/abc-defg-hjk', '/meet/../admin', '/admin', '/meet/abc-defg-hjk/x',
    '/\\evil.com', '/meetings/a/b', ''])('rejects %s', (p) => {
    expect(isSafeReturnPath(p)).toBe(false)
  })
})

describe('consumeReturnPath', () => {
  it('returns a safe path once and clears the cookie', () => {
    const writes: string[] = []
    let jar = `a=1; ${RETURN_PATH_COOKIE}=${encodeURIComponent('/meet/abc-defg-hjk')}`
    const doc = {
      get cookie() { return jar },
      set cookie(v: string) { writes.push(v); jar = 'a=1' },
    }
    expect(consumeReturnPath(doc)).toBe('/meet/abc-defg-hjk')
    expect(writes[0]).toContain(`${RETURN_PATH_COOKIE}=;`)
    expect(writes[0]).toContain('Max-Age=0')
    expect(consumeReturnPath(doc)).toBeNull()
  })

  it('drops an unsafe value', () => {
    const doc = { cookie: `${RETURN_PATH_COOKIE}=${encodeURIComponent('//evil.com')}` }
    expect(consumeReturnPath(doc)).toBeNull()
  })
})
