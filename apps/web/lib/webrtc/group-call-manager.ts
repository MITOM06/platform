import { stompService } from '@/lib/stomp/client'
import type { CallMedia, CallParticipant, CallTransport } from '@/lib/api/types'
import { useCallStore, type IncomingGroupCall } from '@/lib/store/call.store'
import type { WebRTCSignal } from './call-config'
import type { GroupCallHooks } from './call-hooks'
import { getCallTransport } from './call-transport'
import { MeshGroupCallManager } from './mesh-group-call-manager'
import { SfuGroupCall } from './sfu-group-call'

type Engine = MeshGroupCallManager | SfuGroupCall

/**
 * The one entry point for group calls. Components set the UI callbacks here;
 * each call runs on the engine matching the media path the server chose for
 * it (mesh / sfu), read from `transport` on the ring or `call.started`.
 */
class GroupCallManager implements GroupCallHooks {
  onLocalStream: ((s: MediaStream) => void) | null = null
  onEnded: (() => void) | null = null

  private readonly mesh = new MeshGroupCallManager(this)
  private readonly sfu = new SfuGroupCall(this)

  private engineFor(transport: CallTransport | undefined): Engine {
    return transport === 'sfu' ? this.sfu : this.mesh
  }

  /** The engine running the current call. */
  private get active(): Engine {
    return this.engineFor(useCallStore.getState().groupTransport)
  }

  getLocalStream(): MediaStream | null {
    return this.active.getLocalStream()
  }

  getRemoteStream(peerId: string): MediaStream | null {
    return this.active.getRemoteStream(peerId)
  }

  isActive(): boolean {
    return this.mesh.isActive() || this.sfu.isActive()
  }

  startCall(conversationId: string, localUserId: string, media: CallMedia, aiNotetaker: boolean): Promise<void> {
    return this.engineFor(getCallTransport()).startCall(conversationId, localUserId, media, aiNotetaker)
  }

  confirmStarted(
    callId: string,
    conversationId: string,
    localUserId: string,
    media: CallMedia,
    aiNotetaker: boolean,
    transport?: CallTransport,
  ): Promise<void> {
    return this.engineFor(transport).confirmStarted(callId, conversationId, localUserId, media, aiNotetaker)
  }

  join(
    callId: string,
    conversationId: string,
    localUserId: string,
    media: CallMedia,
    aiNotetaker: boolean,
    transport?: CallTransport,
  ): Promise<void> {
    return this.engineFor(transport).join(callId, conversationId, localUserId, media, aiNotetaker)
  }

  async applyRoster(participants: CallParticipant[]): Promise<void> {
    await this.active.applyRoster(participants)
  }

  /** Mesh signaling only — sfu calls exchange no SDP. */
  handleSignal(signal: WebRTCSignal): void {
    this.mesh.handleSignal(signal)
  }

  toggleMic(on: boolean): void {
    this.active.toggleMic(on)
  }

  toggleCamera(on: boolean): void {
    this.active.toggleCamera(on)
  }

  leave(): void {
    this.active.leave()
  }

  handleEnded(callId: string): void {
    this.mesh.handleEnded(callId)
    this.sfu.handleEnded(callId)
  }

  /** Dismiss a group ring. On sfu the server is told so the user's other devices stop ringing. */
  declineRing(call: IncomingGroupCall): void {
    if (call.transport === 'sfu') {
      stompService.publish('/app/call.decline', { callId: call.callId, reason: 'declined' })
    }
    useCallStore.getState().setIncomingGroupCall(null)
  }
}

export const groupCallManager = new GroupCallManager()
