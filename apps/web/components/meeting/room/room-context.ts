'use client'

import { createContext, useContext } from 'react'
import type { Meeting } from '@/lib/api/meeting-types'
import type { MeetingRoomController } from '@/lib/meetings/meeting-room-controller'

/** What every in-room component needs; UI state itself lives in meeting.store. */
export interface RoomContextValue {
  /** Current meeting (settings follow `meet.settings` through the byCode cache). */
  meeting: Meeting
  controller: MeetingRoomController
  myId: string
  /** Already humanized ('' when unknown — never an id). */
  myName: string
  myAvatarUrl?: string
  /** STOMP up: hands, chat and host commands work. */
  realtimeConnected: boolean
}

export const RoomContext = createContext<RoomContextValue | null>(null)

export function useRoom(): RoomContextValue {
  const value = useContext(RoomContext)
  if (!value) throw new Error('useRoom() outside <MeetingRoom>')
  return value
}
