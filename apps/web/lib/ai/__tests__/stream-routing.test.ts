import { describe, it, expect } from 'vitest'
import {
  LEGACY_STREAM_KEY,
  LOCAL_STREAM_KEY,
  aiStreamErrorKey,
  applyAiStreamEvent,
  dropLocalStream,
  finishReplyStream,
  startLocalStream,
  type AiStreamEntry,
  type AiStreamEvent,
} from '@/lib/ai/stream-routing'

const ME = 'me'
const BOB = 'bob'

function run(streams: AiStreamEntry[], events: AiStreamEvent[], me = ME) {
  let s = streams
  const toasts: boolean[] = []
  for (const e of events) {
    const r = applyAiStreamEvent(s, e, me)
    s = r.streams
    if (e.type === 'AI_STREAM_ERROR') toasts.push(r.notifyError)
  }
  return { streams: s, toasts }
}

describe('AI stream routing by replyId', () => {
  it('keeps two concurrent replies in separate bubbles', () => {
    const { streams } = run([], [
      { type: 'AI_STREAM_CHUNK', replyId: 'r1', requesterId: BOB, chunk: 'Hello ' },
      { type: 'AI_STREAM_CHUNK', replyId: 'r2', requesterId: 'carol', chunk: 'Bonjour ' },
      { type: 'AI_STREAM_CHUNK', replyId: 'r1', requesterId: BOB, chunk: 'Bob' },
      { type: 'AI_STREAM_CHUNK', replyId: 'r2', requesterId: 'carol', chunk: 'Carol' },
    ])
    expect(streams.map((s) => [s.replyId, s.content])).toEqual([
      ['r1', 'Hello Bob'],
      ['r2', 'Bonjour Carol'],
    ])
  })

  it('my send placeholder is adopted by the first event of MY request only', () => {
    const local = startLocalStream([], ME)
    expect(local).toHaveLength(1)
    // Someone else's reply starts while mine is still thinking: a new bubble.
    let { streams } = run(local, [
      { type: 'AI_STREAM_CHUNK', replyId: 'rB', requesterId: BOB, chunk: 'for bob' },
    ])
    expect(streams.map((s) => s.key)).toEqual([LOCAL_STREAM_KEY, 'rB'])
    // My reply's first frame takes over the placeholder (same bubble key).
    ;({ streams } = run(streams, [
      { type: 'AI_TOOL_CALL', replyId: 'rMe', requesterId: ME, toolName: 'web_search' },
      { type: 'AI_STREAM_CHUNK', replyId: 'rMe', requesterId: ME, chunk: 'for me' },
    ]))
    const mine = streams.find((s) => s.replyId === 'rMe')!
    expect(mine.key).toBe(LOCAL_STREAM_KEY)
    expect(mine.content).toBe('for me')
    expect(mine.activeTools).toEqual(['web_search'])
    expect(streams).toHaveLength(2)
  })

  it('DONE ends only its own bubble', () => {
    const { streams } = run([], [
      { type: 'AI_STREAM_CHUNK', replyId: 'r1', requesterId: BOB, chunk: 'a' },
      { type: 'AI_STREAM_CHUNK', replyId: 'r2', requesterId: ME, chunk: 'b' },
      { type: 'AI_STREAM_DONE', replyId: 'r1', requesterId: BOB },
    ])
    expect(streams.map((s) => s.replyId)).toEqual(['r2'])
  })

  it('only the requester gets the error toast; the bubble ends for everyone', () => {
    const base = run([], [
      { type: 'AI_STREAM_CHUNK', replyId: 'r1', requesterId: BOB, chunk: 'a' },
    ]).streams
    const mineView = run(base, [{ type: 'AI_STREAM_ERROR', replyId: 'r1', requesterId: BOB }], ME)
    expect(mineView.toasts).toEqual([false])
    expect(mineView.streams).toEqual([])
    const bobView = run(base, [{ type: 'AI_STREAM_ERROR', replyId: 'r1', requesterId: BOB }], BOB)
    expect(bobView.toasts).toEqual([true])
  })

  it('an error before any chunk clears my placeholder', () => {
    const { streams, toasts } = run(startLocalStream([], ME), [
      { type: 'AI_STREAM_ERROR', replyId: 'rMe', requesterId: ME, code: 'AI_EMPTY_RESPONSE' },
    ])
    expect(streams).toEqual([])
    expect(toasts).toEqual([true])
  })

  it('legacy frames without ids still stream into one bubble and toast', () => {
    const { streams } = run([], [
      { type: 'AI_STREAM_CHUNK', chunk: 'x' },
      { type: 'AI_STREAM_CHUNK', chunk: 'y' },
    ])
    expect(streams).toHaveLength(1)
    expect(streams[0]!.key).toBe(LEGACY_STREAM_KEY)
    expect(streams[0]!.content).toBe('xy')
    const end = run(streams, [{ type: 'AI_STREAM_ERROR' }])
    expect(end.streams).toEqual([])
    expect(end.toasts).toEqual([true])
  })

  it('AI_ACTION_PENDING adds a card to its reply, deduped by action id', () => {
    const action = { id: 'a1', status: 'pending' as const, expiresAt: '2026-10-05T10:10:00Z' }
    const { streams } = run([], [
      { type: 'AI_ACTION_PENDING', replyId: 'r1', requesterId: ME, action },
      { type: 'AI_ACTION_PENDING', replyId: 'r1', requesterId: ME, action },
    ])
    expect(streams[0]!.pendingActions).toEqual([{ ...action, requesterId: ME }])
  })

  it('the saved message (aiReplyId) replaces exactly its own bubble', () => {
    const { streams } = run([], [
      { type: 'AI_STREAM_CHUNK', replyId: 'r1', requesterId: BOB, chunk: 'a' },
      { type: 'AI_STREAM_CHUNK', replyId: 'r2', requesterId: ME, chunk: 'b' },
    ])
    const r = finishReplyStream(streams, 'r2')
    expect(r.streams.map((s) => s.replyId)).toEqual(['r1'])
    expect(r.removedKeys).toEqual(['r2'])
    expect(finishReplyStream(streams, undefined).streams).toBe(streams)
  })

  it('dropLocalStream removes only the placeholder', () => {
    const s = run(startLocalStream([], ME), [
      { type: 'AI_STREAM_CHUNK', replyId: 'rB', requesterId: BOB, chunk: 'x' },
    ]).streams
    expect(dropLocalStream(s).map((e) => e.key)).toEqual(['rB'])
  })

  it('maps error codes to localized keys, AI_EMPTY_RESPONSE included', () => {
    expect(aiStreamErrorKey('AI_EMPTY_RESPONSE')).toBe('aiEmptyResponse')
    expect(aiStreamErrorKey('AI_QUOTA_EXCEEDED')).toBe('aiQuotaExceeded')
    expect(aiStreamErrorKey('SOMETHING_NEW')).toBe('aiError')
    expect(aiStreamErrorKey(undefined)).toBe('aiError')
  })
})
