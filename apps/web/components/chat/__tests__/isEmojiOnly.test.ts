/**
 * Tests for isEmojiOnly() — decides whether a text message renders "bare"
 * (large, no bubble frame). Covers the edge cases called out in the chat-UX
 * redesign plan: text+emoji, ZWJ sequences, skin-tone modifiers, and length.
 */

import { describe, it, expect } from 'vitest'
import { isEmojiOnly } from '@/components/chat/message-bubble-helpers'

describe('isEmojiOnly', () => {
  it('accepts a single emoji', () => {
    expect(isEmojiOnly('❤️')).toBe(true)
    expect(isEmojiOnly('😂')).toBe(true)
    expect(isEmojiOnly('🔥')).toBe(true)
  })

  it('accepts up to 3 emoji', () => {
    expect(isEmojiOnly('👍👍')).toBe(true)
    expect(isEmojiOnly('😀😂🔥')).toBe(true)
  })

  it('trims surrounding whitespace', () => {
    expect(isEmojiOnly('  ❤️  ')).toBe(true)
  })

  it('accepts a ZWJ sequence as one emoji', () => {
    expect(isEmojiOnly('👨‍👩‍👧')).toBe(true)
  })

  it('accepts skin-tone modified emoji', () => {
    expect(isEmojiOnly('👍🏽')).toBe(true)
  })

  it('rejects text mixed with emoji', () => {
    expect(isEmojiOnly('hello ❤️')).toBe(false)
    expect(isEmojiOnly('❤️ hi')).toBe(false)
  })

  it('rejects plain text', () => {
    expect(isEmojiOnly('hello')).toBe(false)
    expect(isEmojiOnly('123')).toBe(false)
  })

  it('rejects more than 3 emoji', () => {
    expect(isEmojiOnly('😀😂🔥👍')).toBe(false)
  })

  it('rejects empty / whitespace-only content', () => {
    expect(isEmojiOnly('')).toBe(false)
    expect(isEmojiOnly('   ')).toBe(false)
  })
})
