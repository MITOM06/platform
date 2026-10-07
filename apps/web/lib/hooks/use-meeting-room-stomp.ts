'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { meetingKeys } from '@/lib/meetings/cache-updates'
import { parseMeetingEvent } from '@/lib/meetings/meeting-events'
import type { MeetingRoomController } from '@/lib/meetings/meeting-room-controller'
import { applyRoomEvent, type RoomEventDeps } from '@/lib/meetings/room-events'
import { stompService } from '@/lib/stomp/client'
import { useStompConnected } from '@/lib/stomp/use-stomp-connected'

/**
 * `/topic/meeting/{id}` while the room is connecting / open. Events patch the
 * TanStack cache (applyRoomEvent) and reach the controller. Never subscribed while
 * waiting in the lobby (the server refuses that subscription).
 *
 * Subscribe first, read after: on every re-subscribe after the first one (STOMP came
 * back, or a rejoin) the room data is re-read — deliberately, to cover the gap in which
 * events were missed — and the controller re-reads the meeting, roster and lobby.
 */
export function useMeetingRoomStomp(args: {
  controller: MeetingRoomController
  meetingId: string
  code: string
  /** phase ∈ connecting | inRoom */
  active: boolean
}): { realtimeConnected: boolean } {
  const { controller, meetingId, code, active } = args
  const connected = useStompConnected()
  const queryClient = useQueryClient()
  const subscribedOnce = useRef(false)

  useEffect(() => {
    if (!connected || !active) return
    const deps: RoomEventDeps = {
      queryClient,
      meetingId,
      code,
      now: () => new Date(),
      onRoster: (r) => controller.onRoster(r),
      onSettings: (s) => controller.onSettings(s),
      onChat: (e) => controller.onChat(e),
      onSharedNoteUpdated: (v, by) => controller.onSharedNoteUpdated(v, by),
      onEnded: () => controller.onEnded(),
    }
    const sub = stompService.subscribe(`/topic/meeting/${meetingId}`, (frame) => {
      const e = parseMeetingEvent(frame.body)
      if (e) applyRoomEvent(e, deps)
    })
    if (sub && subscribedOnce.current) {
      // The meeting itself (detail, by-code = this page, roster) is re-read by the controller,
      // which also applies the settings / my role / the end that it may have missed.
      for (const queryKey of [
        meetingKeys.hands(meetingId),
        meetingKeys.messages(meetingId),
        meetingKeys.note(meetingId, 'shared'),
      ]) {
        void queryClient.invalidateQueries({ queryKey })
      }
      void controller.onRealtimeReconnected()
    }
    if (sub) subscribedOnce.current = true
    return () => sub?.unsubscribe()
  }, [connected, active, meetingId, code, controller, queryClient])

  // In the lobby there is no topic: a STOMP comeback alone must re-ask, or a
  // `meet.admitted` sent while offline is lost and the guest waits forever.
  const wasConnected = useRef(connected)
  useEffect(() => {
    const back = connected && !wasConnected.current
    wasConnected.current = connected
    if (back && !active) void controller.onRealtimeReconnected()
  }, [connected, active, controller])

  return { realtimeConnected: connected }
}
