import { vi } from 'vitest'
import type { LocalMediaState, RemotePeer } from '@/lib/rtc/livekit-session'
import type { RoomSession } from '@/lib/meetings/meeting-room-controller'

/** Test double of LiveKitSession for MeetingRoomController tests. */

type Cb<A extends unknown[]> = ((...args: A) => void) | null

export class FakeSession implements RoomSession {
  onLocalStream: Cb<[MediaStream]> = null
  onPeersChanged: Cb<[RemotePeer[]]> = null
  onReconnecting: Cb<[boolean]> = null
  onLocalPoorConnection: Cb<[boolean]> = null
  onDisconnected: Cb<['failed' | 'ended']> = null
  onLocalMediaChanged: Cb<[LocalMediaState]> = null
  onData: Cb<[string, Uint8Array, string | null]> = null
  connect = vi.fn<(url: string, token: string, opts: unknown) => Promise<void>>(async () => undefined)
  setMic = vi.fn<(on: boolean) => Promise<void>>(async () => undefined)
  setCamera = vi.fn<(on: boolean) => Promise<void>>(async () => undefined)
  setScreenShare = vi.fn<(on: boolean) => Promise<void>>(async () => undefined)
  switchDevice = vi.fn<(kind: 'audioinput' | 'videoinput', id: string) => Promise<void>>(async () => undefined)
  publishData = vi.fn<(topic: string, payload: Uint8Array, reliable: boolean) => void>(() => undefined)
  setPeerVideoEnabled = vi.fn<(id: string, on: boolean) => void>(() => undefined)
  disconnect = vi.fn(() => undefined)
  peers = () => [] as RemotePeer[]
  localStream = () => null
  localScreenStream = () => null
  localMedia = () => ({ mic: true, camera: false, screen: false })
}
