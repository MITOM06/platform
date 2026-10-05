import type { CallEndReason } from './call-end-notice'
import type { WebRTCSignal } from './call-config'
import type { CallHooks } from './call-hooks'
import { MeshCallManager } from './mesh-call-manager'

export type { CallEndReason } from './call-end-notice'
export {
  DISCONNECT_GRACE_MS,
  INCOMING_RING_TIMEOUT_MS,
  RING_TIMEOUT_MS,
  type WebRTCSignal,
} from './call-config'

/**
 * The one entry point for 1-on-1 calls. Components set the UI callbacks here
 * and call the methods below; each call is run by the engine matching the
 * media path the server chose for it (spec 2026-10-05 calls-and-meetings).
 */
class CallManager implements CallHooks {
  onLocalStream: ((s: MediaStream) => void) | null = null
  onRemoteStream: ((s: MediaStream) => void) | null = null
  onEnded: (() => void) | null = null
  onEndNotice: ((reason: CallEndReason, byPeer: boolean, peerName: string) => void) | null = null

  private readonly mesh = new MeshCallManager(this)

  /** The engine running the current call. */
  private get active(): MeshCallManager {
    return this.mesh
  }

  getLocalStream(): MediaStream | null {
    return this.active.getLocalStream()
  }

  getRemoteStream(): MediaStream | null {
    return this.active.getRemoteStream()
  }

  startCall(targetId: string, targetName: string, conversationId: string, video = true): Promise<void> {
    return this.mesh.startCall(targetId, targetName, conversationId, video)
  }

  acceptIncoming(): Promise<void> {
    return this.active.acceptIncoming()
  }

  handleSignal(signal: WebRTCSignal): void {
    this.mesh.handleSignal(signal)
  }

  endCall(reason: CallEndReason = 'hangup'): void {
    this.active.endCall(reason)
  }

  dismissIncoming(): void {
    this.active.dismissIncoming()
  }

  toggleMic(on: boolean): void {
    this.active.toggleMic(on)
  }

  toggleCamera(on: boolean): void {
    this.active.toggleCamera(on)
  }
}

export const callManager = new CallManager()
