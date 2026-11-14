import { describe, it, expect } from 'vitest'
import {
  startLocalStream, applyAiStreamEvent, aiStreamErrorKey, LOCAL_STREAM_KEY,
} from '@/lib/ai/stream-routing'
import { expiryMs, formatActionTime, actionSummaryView } from '@/lib/ai/pending-actions'

describe('stream-routing edges', () => {
  it('startLocalStream keeps an existing placeholder', () => {
    const once = startLocalStream([], 'me')
    expect(startLocalStream(once, 'me')).toBe(once)
    expect(once).toHaveLength(1)
    expect(once[0]).toMatchObject({ key: LOCAL_STREAM_KEY, requesterId: 'me', thinking: true })
  })

  it('a tool call without a name, or a pending action without an id, changes nothing but routing', () => {
    const r1 = applyAiStreamEvent([], { type: 'AI_TOOL_CALL', replyId: 'r1', toolName: '' })
    expect(r1.streams[0]).toMatchObject({ replyId: 'r1', activeTools: [] })
    const r2 = applyAiStreamEvent(r1.streams, { type: 'AI_ACTION_PENDING', replyId: 'r1', action: { id: '' } as never })
    expect(r2.streams[0].pendingActions).toEqual([])
    const r3 = applyAiStreamEvent(r2.streams, { type: 'AI_ACTION_PENDING', replyId: 'r1' })
    expect(r3.streams[0].pendingActions).toEqual([])
    expect(r3.touchedKey).toBe('r1')
  })

  it('an unknown frame type only routes', () => {
    const r = applyAiStreamEvent([], { type: 'SOMETHING_ELSE' as never, replyId: 'r2' })
    expect(r.streams[0]).toMatchObject({ key: 'r2', content: '', thinking: true })
  })

  it('error keys map every code; unknown → aiError', () => {
    expect(aiStreamErrorKey('AI_QUOTA_EXCEEDED')).toBe('aiQuotaExceeded')
    expect(aiStreamErrorKey('AI_RATE_LIMITED')).toBe('aiRateLimited')
    expect(aiStreamErrorKey('AI_FORBIDDEN')).toBe('aiForbidden')
    expect(aiStreamErrorKey('AI_STREAM_INTERRUPTED')).toBe('aiStreamInterrupted')
    expect(aiStreamErrorKey('AI_UNAVAILABLE')).toBe('aiUnavailable')
    expect(aiStreamErrorKey('AI_EMPTY_RESPONSE')).toBe('aiEmptyResponse')
    expect(aiStreamErrorKey(undefined)).toBe('aiError')
  })
})

describe('pending-actions edges', () => {
  it('expiryMs: absent / invalid / valid', () => {
    expect(expiryMs({})).toBeNull()
    expect(expiryMs({ expiresAt: 'nope' })).toBeNull()
    expect(expiryMs({ expiresAt: '2026-01-01T00:00:00Z' })).toBe(Date.parse('2026-01-01T00:00:00Z'))
  })

  it('formatActionTime: date-only in UTC, date-time in the given zone, garbage as is', () => {
    expect(formatActionTime('2026-03-05', 'en-US')).toBe('Mar 5, 2026')
    expect(formatActionTime('2026-03-05T14:30:00Z', 'en-US', 'UTC')).toBe(
      new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date('2026-03-05T14:30:00Z')))
    expect(formatActionTime('tomorrow-ish', 'en-US')).toBe('tomorrow-ish')
  })

  it('page actions show their title', () => {
    const v = actionSummaryView({ kind: 'create_page', title: 'Roadmap' }, 'en')
    expect(v.lines).toEqual([{ labelKey: 'aiActionFieldTitle', value: 'Roadmap' }])
    expect(actionSummaryView({ kind: 'update_page' }, 'en').lines).toEqual([])
  })
})
