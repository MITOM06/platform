import { describe, it, expect } from 'vitest'
import { createReactionThrottle, decodeReaction, encodeReaction } from '@/lib/meetings/reactions'

describe('reactions', () => {
  it('round-trips the six allowed emoji', () => {
    for (const e of ['👍', '❤️', '😂', '😮', '👏', '🎉'] as const) {
      expect(decodeReaction(encodeReaction(e))).toBe(e)
    }
    expect(new TextDecoder().decode(encodeReaction('👍'))).toBe('{"e":"👍"}')
  })

  it('drops anything else a peer could send', () => {
    const enc = (s: string) => new TextEncoder().encode(s)
    expect(decodeReaction(enc('{"e":"💩"}'))).toBeNull()
    expect(decodeReaction(enc('{"e":"<img src=x>"}'))).toBeNull()
    expect(decodeReaction(enc('not json'))).toBeNull()
    expect(decodeReaction(enc(`{"e":"👍","pad":"${'x'.repeat(200)}"}`))).toBeNull()
  })

  it('allows at most one reaction per second', () => {
    const allow = createReactionThrottle()
    expect(allow(1000)).toBe(true)
    expect(allow(1500)).toBe(false)
    expect(allow(1999)).toBe(false)
    expect(allow(2000)).toBe(true)
  })
})
