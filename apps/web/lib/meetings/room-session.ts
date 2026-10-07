import type { QueryClient } from '@tanstack/react-query'
import type { meetingsApi } from '@/lib/api/meetings'
import type { LiveKitSession, RemotePeer } from '@/lib/rtc/livekit-session'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import type { MessageKey } from './meeting-errors'

/** Types shared by MeetingRoomController + the LiveKit callback → store wiring. */

export type RoomSession = Pick<
  LiveKitSession,
  | 'onLocalStream' | 'onPeersChanged' | 'onReconnecting' | 'onLocalPoorConnection' | 'onDisconnected'
  | 'onLocalMediaChanged' | 'onData' | 'connect' | 'setMic' | 'setCamera' | 'setScreenShare' | 'switchDevice'
  | 'publishData' | 'setPeerVideoEnabled' | 'disconnect' | 'peers' | 'localStream' | 'localScreenStream' | 'localMedia'
>

export interface JoinMedia {
  mic: boolean
  camera: boolean
  audioDeviceId?: string
  videoDeviceId?: string
}

export interface MeetingRoomDeps {
  api: Pick<typeof meetingsApi, 'join' | 'leaveLobby' | 'get' | 'end' | 'admit' | 'deny' | 'lobby'>
  queryClient: QueryClient
  publish(destination: string, body: object): void
  isRealtimeConnected(): boolean
  createSession(): RoomSession
  now(): number
  newClientId(): string
  /** The page localizes with t(`meeting.${key}`). */
  notify(level: 'info' | 'error', msg: MessageKey): void
}

const set = useMeetingRoomStore.setState

/** Copies peers (the session mutates them in place) and keeps the last remote speaker sticky. */
export function peersPatch(peers: RemotePeer[], prevSpeaker: string | null) {
  const speaking = peers.find((p) => p.speaking)?.identity
  const stillHere = prevSpeaker && peers.some((p) => p.identity === prevSpeaker) ? prevSpeaker : null
  return { peers: peers.map((p) => ({ ...p })), activeSpeakerId: speaking ?? stillHere }
}

export interface WireHandlers {
  /** False once the controller moved on to another session (late callbacks are dropped). */
  isCurrent(): boolean
  onData(topic: string, payload: Uint8Array, from: string | null): void
  /** The room went away on its own (never after our own disconnect). */
  onClosed(reason: 'failed' | 'ended'): void
}

/** LiveKit session callbacks → meeting.store. */
export function wireRoomSession(session: RoomSession, h: WireHandlers): void {
  session.onLocalStream = (s) => {
    if (h.isCurrent()) set({ localStream: s, localScreen: session.localScreenStream() })
  }
  session.onPeersChanged = (peers) => {
    if (h.isCurrent()) set(peersPatch(peers, useMeetingRoomStore.getState().activeSpeakerId))
  }
  session.onReconnecting = (on) => {
    if (h.isCurrent()) set({ reconnecting: on })
  }
  session.onLocalPoorConnection = (poor) => {
    if (h.isCurrent()) set({ poorConnection: poor })
  }
  session.onLocalMediaChanged = (s) => {
    if (h.isCurrent()) set({ ...s, localScreen: session.localScreenStream() })
  }
  session.onData = (topic, payload, from) => {
    if (h.isCurrent()) h.onData(topic, payload, from)
  }
  session.onDisconnected = (reason) => {
    if (!h.isCurrent()) return
    set({ reconnecting: false, screen: false })
    h.onClosed(reason)
  }
}
