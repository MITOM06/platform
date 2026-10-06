/**
 * Only real messages may be appended to a thread. A KB_STATUS_UPDATE frame used
 * to be appended as a message and crash MessageBubble (no `content`).
 */

import { describe, it, expect } from 'vitest'
import { isMessageFrame, isStompEvent } from '@/lib/realtime/message-frames'

const message = {
  id: 'm1',
  conversationId: 'c1',
  senderId: 'u1',
  content: 'hello',
  type: 'text',
  createdAt: '2026-10-05T10:00:00Z',
}

describe('topic frame classification', () => {
  it('recognises events, including KB status and AI action events', () => {
    for (const type of ['KB_STATUS_UPDATE', 'AI_ACTION_PENDING', 'MESSAGE_UPDATED', 'CONVERSATION_UPDATED']) {
      expect(isStompEvent({ type })).toBe(true)
    }
    expect(isStompEvent({ type: 'text' })).toBe(false)
  })

  it('accepts a persisted message for this conversation', () => {
    expect(isMessageFrame(message, 'c1')).toBe(true)
    expect(isMessageFrame({ ...message, conversationId: undefined }, 'c1')).toBe(true)
  })

  it('rejects frames that are not messages', () => {
    expect(isMessageFrame({ type: 'KB_STATUS_UPDATE', documentId: 'd1', status: 'done' }, 'c1')).toBe(false)
    expect(isMessageFrame({ type: 'SOME_FUTURE_EVENT', id: 'x' }, 'c1')).toBe(false)
    expect(isMessageFrame({ ...message, content: undefined }, 'c1')).toBe(false)
    expect(isMessageFrame({ ...message, type: 'unknown_type' }, 'c1')).toBe(false)
    expect(isMessageFrame({ ...message, conversationId: 'other' }, 'c1')).toBe(false)
    expect(isMessageFrame({ ...message, id: '' }, 'c1')).toBe(false)
  })
})
