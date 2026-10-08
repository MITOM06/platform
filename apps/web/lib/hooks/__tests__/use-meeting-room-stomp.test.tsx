import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { meetingKeys } from '@/lib/meetings/cache-updates'
import type { MeetingRoomController } from '@/lib/meetings/meeting-room-controller'

const stomp = vi.hoisted(() => ({ connected: true }))
vi.mock('@/lib/stomp/use-stomp-connected', () => ({ useStompConnected: () => stomp.connected }))
vi.mock('@/lib/stomp/client', () => ({
  stompService: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
}))

import { useMeetingRoomStomp } from '@/lib/hooks/use-meeting-room-stomp'

let qc: QueryClient
let controller: { onRealtimeReconnected: ReturnType<typeof vi.fn> }

beforeEach(() => {
  qc = new QueryClient()
  controller = { onRealtimeReconnected: vi.fn(async () => undefined) }
})

function render(active: boolean) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return renderHook(
    (p: { active: boolean }) =>
      useMeetingRoomStomp({
        controller: controller as unknown as MeetingRoomController,
        meetingId: 'm1',
        code: 'abc-defg-hjk',
        active: p.active,
      }),
    { wrapper, initialProps: { active } },
  )
}

describe('useMeetingRoomStomp — re-subscribe', () => {
  it('re-reads the room on every re-subscribe: the controller re-reads meeting + roster, the rest is invalidated', () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const hook = render(true)
    expect(controller.onRealtimeReconnected).not.toHaveBeenCalled()

    hook.rerender({ active: false })
    hook.rerender({ active: true })
    expect(controller.onRealtimeReconnected).toHaveBeenCalledTimes(1)
    const keys = invalidate.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))
    expect(keys).toEqual(expect.arrayContaining([
      JSON.stringify(meetingKeys.hands('m1')),
      JSON.stringify(meetingKeys.messages('m1')),
      JSON.stringify(meetingKeys.note('m1', 'shared')),
    ]))
    // GET /{id} once (by the controller), never again through the roster / detail queries.
    expect(keys).not.toContain(JSON.stringify(meetingKeys.roster('m1')))
    expect(keys).not.toContain(JSON.stringify(meetingKeys.detail('m1')))
  })
})
