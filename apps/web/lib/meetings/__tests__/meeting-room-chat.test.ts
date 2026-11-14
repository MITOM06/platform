import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MeetingRoomChat, REACTION_LIFETIME_MS } from '@/lib/meetings/meeting-room-chat'
import { encodeReaction, REACTION_TOPIC } from '@/lib/meetings/reactions'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'

const initial = useMeetingRoomStore.getState()
const store = () => useMeetingRoomStore.getState()
let connected: boolean
let n: number
const deps = {
  publish: vi.fn(), isRealtimeConnected: () => connected, now: () => 1000,
  newClientId: () => `cid${++n}`, notify: vi.fn(),
}
const session = { publishData: vi.fn(), peers: () => [{ identity: 'p1', name: 'Pat' }] as never }

beforeEach(() => {
  vi.useFakeTimers()
  useMeetingRoomStore.setState(initial, true)
  connected = true
  n = 0
  deps.publish.mockReset(); deps.notify.mockReset()
})
afterEach(() => vi.useRealTimers())

const chat = () => new MeetingRoomChat('m1', 'me', deps, () => session)

describe('MeetingRoomChat send / retry / discard', () => {
  it('send publishes and keeps a pending line; empty, too long or offline → null', () => {
    const c = chat()
    expect(c.send('  hi  ', 10)).toBe('cid1')
    expect(deps.publish).toHaveBeenCalledWith('/app/meet.chat', { meetingId: 'm1', content: 'hi', clientId: 'cid1' })
    expect(store().pendingChat).toEqual([{ clientId: 'cid1', content: 'hi', sentAt: 1000, error: null }])
    expect(c.send('   ', 10)).toBeNull()
    expect(c.send('x'.repeat(11), 10)).toBeNull()
    connected = false
    expect(c.send('hi', 10)).toBeNull()
  })

  it('an attachment-only line carries the file', () => {
    const c = chat()
    c.send('', 10, { url: 'u', name: 'f.pdf', size: 3 })
    expect(deps.publish).toHaveBeenCalledWith('/app/meet.chat', { meetingId: 'm1', content: '', clientId: 'cid1', attachment: { url: 'u', name: 'f.pdf' } })
    expect(store().pendingChat[0].attachment).toEqual({ url: 'u', name: 'f.pdf', size: 3, contentType: null })
  })

  it('retry re-publishes when online, says offline otherwise; unknown ids are ignored', () => {
    const c = chat()
    c.send('hi', 10)
    deps.publish.mockClear()
    connected = false
    c.retry('cid1')
    expect(deps.notify).toHaveBeenCalledWith('error', { key: 'realtimeOffline' })
    expect(deps.publish).not.toHaveBeenCalled()
    connected = true
    c.retry('cid1')
    expect(deps.publish).toHaveBeenCalledWith('/app/meet.chat', { meetingId: 'm1', content: 'hi', clientId: 'cid1' })
    c.retry('nope')
    expect(deps.publish).toHaveBeenCalledTimes(1)
    c.discard('cid1')
    expect(store().pendingChat).toEqual([])
  })
})

describe('MeetingRoomChat reactions from peers', () => {
  it('shows a named peer reaction and removes it after its lifetime', () => {
    const c = chat()
    c.onData(REACTION_TOPIC, encodeReaction('👍' as never), 'p1')
    expect(store().reactions).toEqual([{ emoji: '👍', name: 'Pat', mine: false, id: 1 }])
    vi.advanceTimersByTime(REACTION_LIFETIME_MS)
    expect(store().reactions).toEqual([])
  })

  it('ignores other topics and invalid payloads; unknown sender has no name', () => {
    const c = chat()
    c.onData('other', encodeReaction('👍' as never), 'p1')
    c.onData(REACTION_TOPIC, new TextEncoder().encode('💣'), 'p1')
    expect(store().reactions).toEqual([])
    c.onData(REACTION_TOPIC, encodeReaction('👍' as never), null)
    expect(store().reactions).toEqual([{ emoji: '👍', mine: false, id: 1 }])
  })

  it('dispose cancels the removal timers', () => {
    const c = chat()
    c.onData(REACTION_TOPIC, encodeReaction('👍' as never), 'p1')
    c.dispose()
    vi.advanceTimersByTime(REACTION_LIFETIME_MS)
    expect(store().reactions).toHaveLength(1)
  })
})
