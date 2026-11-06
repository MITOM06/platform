import { describe, expect, it } from 'vitest'
import { AI_BOT_ID } from '@/lib/constants'
import { expectsAiReply, isDirectAiConversation } from '../ai-trigger'

const direct = { type: 'direct', participants: ['u1', AI_BOT_ID] }
const groupWithBot = { type: 'group', participants: ['u1', 'u2', AI_BOT_ID] }
const human = { type: 'direct', participants: ['u1', 'u2'] }

describe('isDirectAiConversation', () => {
  it('is true only for a 1-1 chat with the AI bot', () => {
    expect(isDirectAiConversation(direct)).toBe(true)
    expect(isDirectAiConversation(groupWithBot)).toBe(false)
    expect(isDirectAiConversation(human)).toBe(false)
    expect(isDirectAiConversation(undefined)).toBe(false)
  })
})

describe('expectsAiReply', () => {
  it('any text in a 1-1 AI chat, without a mention', () => {
    expect(expectsAiReply(direct, 'hello', 'text')).toBe(true)
  })
  it('in a group with the bot, only an explicit mention', () => {
    expect(expectsAiReply(groupWithBot, 'hello team', 'text')).toBe(false)
    expect(expectsAiReply(groupWithBot, '@AI summarise', 'text')).toBe(true)
    expect(expectsAiReply(human, 'hey @ponai', 'text')).toBe(true)
  })
  it('never for non-text messages', () => {
    expect(expectsAiReply(direct, '{"url":"/x"}', 'file')).toBe(false)
  })
})
