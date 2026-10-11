import { stompService } from '@/lib/stomp/client'
import { useCallStore } from '@/lib/store/call.store'
import type { CallEvent } from '@/lib/api/types'
import type { CallEndReason } from './call-end-notice'
import type { WebRTCSignal } from './call-config'
import type { CallHooks } from './call-hooks'
import { getCallTransport } from './call-transport'
import { MeshCallManager } from './mesh-call-manager'
import { SfuDirectCall } from './sfu-call'

export type { CallEndReason } from './call-end-notice'
export {
  DISCONNECT_GRACE_MS,
  INCOMING_RING_TIMEOUT_MS,
  RING_TIMEOUT_MS,
  type WebRTCSignal,
} from './call-config'

/** LiveKit call control that may arrive without a `transport` field. */
const SFU_CONTROL: ReadonlySet<WebRTCSignal['type']> = new Set<WebRTCSignal['type']>([
  'call-ring-cancel',
  'call-declined',
  'call-merged',
  'call-accepted',
])

/**
 * The one entry point for 1-on-1 calls. Components set the UI callbacks here
 * and call the methods below; each call is run by the engine matching the
 * media path the server chose for it (spec 2026-10-05 calls-and-meetings).
 */
class CallManager implements CallHooks {
  onLocalStream: ((s: MediaStream) => void) | null = null
  onRemoteStream: ((s: MediaStream) => void) | null = null
  onEnded: (() => void) | null = null
  onEndNotice: CallHooks['onEndNotice'] = null

  private readonly mesh = new MeshCallManager(this)
  private readonly sfu = new SfuDirectCall(this)

  /** The engine running the current call (idle → mesh, which is a no-op then). */
  private get active(): MeshCallManager | SfuDirectCall {
    return useCallStore.getState().transport === 'sfu' ? this.sfu : this.mesh
  }

  getLocalStream(): MediaStream | null {
    return this.active.getLocalStream()
  }

  getRemoteStream(): MediaStream | null {
    return this.active.getRemoteStream()
  }

  startCall(targetId: string, targetName: string, conversationId: string, video = true): Promise<void> {
    const st = useCallStore.getState()
    // Tapping Call on the person who is ringing us answers their call.
    if (st.status === 'incoming' && st.peerId === targetId && st.conversationId === conversationId) {
      return this.acceptIncoming()
    }
    if (st.status !== 'idle' || st.groupCallId) return Promise.resolve() // already in a call
    const engine = getCallTransport() === 'sfu' ? this.sfu : this.mesh
    return engine.startCall(targetId, targetName, conversationId, video)
  }

  acceptIncoming(): Promise<void> {
    return this.active.acceptIncoming()
  }

  /** Inbound `/user/queue/webrtc` signal for a 1-on-1 call. */
  handleSignal(signal: WebRTCSignal): void {
    if (signal.type === 'call-blocked') {
      this.sfu.handleSignal(signal) // our call.start was refused: drop that attempt
      // Not an sfu attempt (an older server refusing a peer-to-peer call): just close its screen.
      const st = useCallStore.getState()
      if (st.transport !== 'sfu' && st.status === 'outgoing') st.reset()
      return
    }
    if (signal.transport === 'sfu' || SFU_CONTROL.has(signal.type)) {
      this.sfu.handleSignal(signal)
      return
    }
    const st = useCallStore.getState()
    if (st.transport === 'sfu' && st.status !== 'idle') {
      // A peer-to-peer call while we are on LiveKit (e.g. a mesh-only app): we
      // are busy. Its other signals must never reach — and reset — our call.
      if (signal.type === 'offer' && signal.senderId && signal.conversationId) {
        stompService.publish('/app/call.end', {
          targetId: signal.senderId,
          conversationId: signal.conversationId,
          type: 'end',
          reason: 'busy',
          duration: 0,
        })
      }
      return
    }
    this.mesh.handleSignal(signal)
  }

  /** `call.started` / `call.ended` of a direct sfu call, from the conversation topic. */
  handleCallEvent(event: CallEvent): void {
    this.sfu.handleCallEvent(event)
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
