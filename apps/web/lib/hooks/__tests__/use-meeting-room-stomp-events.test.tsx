/** Topic frames are parsed and routed to the room controller. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { makeQueryWrapper } from '@/test/query-wrapper'
import type { MeetingRoomController } from '@/lib/meetings/meeting-room-controller'
import { meetingKeys } from '@/lib/meetings/cache-updates'

const h = vi.hoisted(() => ({
  handler: null as null | ((f: { body: string }) => void),
  unsubscribe: vi.fn(),
  subscribe: vi.fn(),
}))
vi.mock('@/lib/stomp/use-stomp-connected', () => ({ useStompConnected: () => true }))
vi.mock('@/lib/stomp/client', () => ({ stompService: { subscribe: h.subscribe } }))

import { useMeetingRoomStomp } from '@/lib/hooks/use-meeting-room-stomp'

const controller = {
  onRoster: vi.fn(), onSettings: vi.fn(), onChat: vi.fn(), onAi: vi.fn(),
  onSharedNoteUpdated: vi.fn(), onEnded: vi.fn(), onRealtimeReconnected: vi.fn(async () => {}),
}
const send = (o: object | string) => h.handler!({ body: typeof o === 'string' ? o : JSON.stringify({ meetingId: 'm1', ...o }) })

beforeEach(() => {
  for (const f of Object.values(controller)) f.mockClear()
  h.unsubscribe.mockReset()
  h.subscribe.mockReset().mockImplementation((_d: string, fn: (f: { body: string }) => void) => {
    h.handler = fn
    return { unsubscribe: h.unsubscribe }
  })
})

function mount() {
  const { qc, wrapper } = makeQueryWrapper()
  const r = renderHook(() => useMeetingRoomStomp({
    controller: controller as unknown as MeetingRoomController, meetingId: 'm1', code: 'abc-defg-hjk', active: true,
  }), { wrapper })
  return { ...r, qc }
}

describe('useMeetingRoomStomp — event routing', () => {
  it('subscribes to the meeting topic and unsubscribes on unmount', () => {
    const { unmount, result } = mount()
    expect(h.subscribe).toHaveBeenCalledWith('/topic/meeting/m1', expect.any(Function))
    expect(result.current.realtimeConnected).toBe(true)
    unmount()
    expect(h.unsubscribe).toHaveBeenCalled()
  })

  it('routes roster / settings / chat / ai / notes / ended to the controller', () => {
    const { qc } = mount()
    send({ event: 'meet.roster', participants: [{ userId: 'u1', role: 'host', joinedAt: '2026-01-01T00:00:00Z' }] })
    expect(controller.onRoster).toHaveBeenCalled()
    expect(qc.getQueryData(meetingKeys.roster('m1'))).toHaveLength(1)
    const settings = { waitingRoom: true, muteOnEntry: false, allowAttendeeScreenShare: true, attendeesCanEditNotes: false, locked: false }
    send({ event: 'meet.settings', settings })
    expect(controller.onSettings).toHaveBeenCalledWith({ ...settings, aiNotes: false })
    send({ event: 'meet.chat', message: { id: 'x', content: 'hi', createdAt: '2026-01-01T00:00:00Z', sender: { userId: 'u1' } } })
    expect(controller.onChat).toHaveBeenCalledWith(expect.objectContaining({ event: 'meet.chat' }))
    send({ event: 'meet.ai', state: 'thinking', requesterId: 'u1' })
    expect(controller.onAi).toHaveBeenCalledWith(expect.objectContaining({ state: 'thinking', requesterId: 'u1' }))
    send({ event: 'meet.notes.updated', version: 3 })
    expect(controller.onSharedNoteUpdated).toHaveBeenCalledWith(3, undefined)
    send({ event: 'meet.ended' })
    expect(controller.onEnded).toHaveBeenCalled()
  })

  it('ignores garbage and other meetings', () => {
    mount()
    send('not json')
    h.handler!({ body: JSON.stringify({ event: 'meet.ended', meetingId: 'other' }) })
    expect(controller.onEnded).not.toHaveBeenCalled()
  })
})
