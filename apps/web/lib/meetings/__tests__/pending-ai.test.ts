import { describe, it, expect } from 'vitest'
import {
  AI_PENDING_TTL_MS,
  addPendingAi,
  aiErrorKey,
  expirePendingAi,
  failPendingAi,
  resolvePendingAi,
} from '@/lib/meetings/pending-ai'

describe('pending AI list', () => {
  it('adds entries in arrival order', () => {
    const l = addPendingAi(addPendingAi([], 'a', 100), 'b', 200)
    expect(l).toEqual([{ requesterId: 'a', startedAt: 100 }, { requesterId: 'b', startedAt: 200 }])
  })

  it('an AI answer removes the oldest entry', () => {
    const l = [{ requesterId: 'a', startedAt: 1 }, { requesterId: 'b', startedAt: 2 }]
    expect(resolvePendingAi(l)).toEqual([{ requesterId: 'b', startedAt: 2 }])
    expect(resolvePendingAi([])).toEqual([])
  })

  it('an error removes the oldest entry of that requester, else the oldest', () => {
    const l = [
      { requesterId: 'a', startedAt: 1 }, { requesterId: 'b', startedAt: 2 }, { requesterId: 'b', startedAt: 3 },
    ]
    expect(failPendingAi(l, 'b')).toEqual([
      { requesterId: 'a', startedAt: 1 }, { requesterId: 'b', startedAt: 3 },
    ])
    expect(failPendingAi(l, 'zzz')).toEqual([
      { requesterId: 'b', startedAt: 2 }, { requesterId: 'b', startedAt: 3 },
    ])
    expect(failPendingAi([], 'a')).toEqual([])
  })

  it('entries expire after 60 s', () => {
    expect(AI_PENDING_TTL_MS).toBe(60_000)
    const l = [{ requesterId: 'a', startedAt: 0 }, { requesterId: 'b', startedAt: 30_000 }]
    expect(expirePendingAi(l, 59_999)).toEqual(l)
    expect(expirePendingAi(l, 60_000)).toEqual([{ requesterId: 'b', startedAt: 30_000 }])
    expect(expirePendingAi(l, 90_000)).toEqual([])
  })

  it('maps error codes to a notice key, never to the raw code', () => {
    expect(aiErrorKey('AI_UNAVAILABLE')).toBe('aiUnavailable')
    expect(aiErrorKey('AI_EMPTY')).toBe('aiFailed')
    expect(aiErrorKey('AI_ERROR')).toBe('aiFailed')
    expect(aiErrorKey(undefined)).toBe('aiFailed')
  })

  it('maps quota and rate-limit codes (wire form and bare form) to their own notices', () => {
    expect(aiErrorKey('AI_QUOTA_EXCEEDED')).toBe('aiQuotaExceeded')
    expect(aiErrorKey('QUOTA_EXCEEDED')).toBe('aiQuotaExceeded')
    expect(aiErrorKey('AI_RATE_LIMITED')).toBe('aiRateLimited')
    expect(aiErrorKey('RATE_LIMITED')).toBe('aiRateLimited')
  })
})
