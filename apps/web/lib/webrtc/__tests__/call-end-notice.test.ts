import { describe, expect, it } from 'vitest'
import { endNoticeKey } from '../call-end-notice'

describe('endNoticeKey', () => {
  it('explains a hang-up caused by the peer', () => {
    expect(endNoticeKey('declined', true)).toBe('declined')
    expect(endNoticeKey('busy', true)).toBe('busy')
    expect(endNoticeKey('media_error', true)).toBe('peerMediaError')
    expect(endNoticeKey('failed', true)).toBe('connectionLost')
    expect(endNoticeKey('hangup', true)).toBe('ended')
    // The caller giving up just makes the incoming prompt disappear.
    expect(endNoticeKey('no_answer', true)).toBeNull()
  })

  it('only explains local endings the user did not choose', () => {
    expect(endNoticeKey('no_answer', false)).toBe('noAnswer')
    expect(endNoticeKey('failed', false)).toBe('connectionLost')
    expect(endNoticeKey('media_error', false)).toBe('mediaError')
    expect(endNoticeKey('hangup', false)).toBeNull()
    expect(endNoticeKey('declined', false)).toBeNull()
  })
})
