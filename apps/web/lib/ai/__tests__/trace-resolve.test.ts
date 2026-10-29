import { describe, it, expect } from 'vitest'
import { resolvedToolCallStatuses } from '@/lib/ai/trace'

const AWAITING = 'Awaiting user confirmation'

describe('resolvedToolCallStatuses', () => {
  it('a held call takes the outcome of its confirmation card', () => {
    const calls = [
      { toolName: 'mcp__notion__search_pages', resultSummary: '3 pages' },
      { toolName: 'mcp__notion__create_page', resultSummary: AWAITING },
    ]
    expect(
      resolvedToolCallStatuses(calls, [{ toolName: 'mcp__notion__create_page', status: 'cancelled' }]),
    ).toEqual(['done', 'cancelled'])
    expect(
      resolvedToolCallStatuses(calls, [{ toolName: 'mcp__notion__create_page', status: 'confirmed' }]),
    ).toEqual(['done', 'done'])
    expect(
      resolvedToolCallStatuses(calls, [{ toolName: 'mcp__notion__create_page', status: 'expired' }]),
    ).toEqual(['done', 'expired'])
  })

  it('a still-pending, unmatched or card-less call stays awaiting', () => {
    const calls = [{ toolName: 'mcp__calendar__create_event', resultSummary: AWAITING }]
    expect(resolvedToolCallStatuses(calls, [{ toolName: 'mcp__calendar__create_event', status: 'pending' }])).toEqual([
      'awaiting',
    ])
    expect(resolvedToolCallStatuses(calls, [{ toolName: 'mcp__gmail__send_email', status: 'cancelled' }])).toEqual([
      'awaiting',
    ])
    expect(resolvedToolCallStatuses(calls, undefined)).toEqual(['awaiting'])
  })

  it('two held calls of the same tool match their cards in order', () => {
    const calls = [
      { toolName: 'mcp__gmail__send_email', resultSummary: AWAITING },
      { toolName: 'mcp__gmail__send_email', resultSummary: AWAITING },
    ]
    expect(
      resolvedToolCallStatuses(calls, [
        { toolName: 'mcp__gmail__send_email', status: 'confirmed' },
        { toolName: 'mcp__gmail__send_email', status: 'cancelled' },
      ]),
    ).toEqual(['done', 'cancelled'])
  })
})
