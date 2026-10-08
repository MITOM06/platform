import { stompService } from '@/lib/stomp/client'
import { useCallStore } from '@/lib/store/call.store'
import type { CallEndReason } from './call-end-notice'
import type { WebRTCSignal } from './call-config'
import { attributeQuality, type ReceiveQuality } from './call-network'
import type { MeshNegotiator } from './mesh-negotiator'
import { QualityMonitor } from './quality-monitor'
import { ReconnectWatch, type ReconnectWho } from './reconnect-watch'

/** What the in-call logic needs from the peer-to-peer call it serves. */
export interface InCallLink {
  pc(): RTCPeerConnection | null
  localStream(): MediaStream | null
  isCaller(): boolean
  target(): { peerId: string; conversationId: string } | null
  onLocalStream(stream: MediaStream): void
  endCall(reason: CallEndReason): void
}

/**
 * Everything a peer-to-peer 1-on-1 does once connected: switching between
 * voice and video, exchanging `call.state` (camera, receive quality, restart
 * requests), telling whose network is weak, and the one-minute reconnect
 * window after a drop. The connection itself stays in MeshCallManager.
 */
export class MeshInCall {
  private readonly reconnect = new ReconnectWatch()
  private readonly quality = new QualityMonitor((q) => this.onMyQuality(q))
  /** How well we receive them, and (from their call.state) how well they receive us. */
  private myReceive: ReceiveQuality = 'good'
  private peerReceive: ReceiveQuality | null = null

  constructor(
    private readonly link: InCallLink,
    private readonly negotiator: MeshNegotiator,
  ) {}

  /** Media flows (again): stop waiting, measure the connection. */
  connected(pc: RTCPeerConnection): void {
    this.reconnect.end()
    this.quality.start(pc)
  }

  reset(): void {
    this.reconnect.end()
    this.quality.stop()
    this.myReceive = 'good'
    this.peerReceive = null
  }

  /** Turn our camera on/off — in a voice call this switches it to video. */
  toggleCamera(on: boolean): void {
    const tracks = this.link.localStream()?.getVideoTracks() ?? []
    if (on && tracks.length === 0) {
      void this.addCamera()
      return
    }
    tracks.forEach((t) => (t.enabled = on))
    this.cameraChanged(on)
  }

  /** A voice call's first camera: the caller renegotiates, the callee asks it to. */
  private async addCamera(): Promise<void> {
    const pc = this.link.pc()
    const stream = this.link.localStream()
    if (!pc || !stream) return
    let track: MediaStreamTrack | undefined
    try {
      track = (await navigator.mediaDevices.getUserMedia({ video: true })).getVideoTracks()[0]
    } catch {
      return // camera refused: the call stays voice
    }
    if (!track) return
    if (this.link.pc() !== pc) {
      track.stop()
      return
    }
    stream.addTrack?.(track)
    this.link.onLocalStream(stream)
    if (this.link.isCaller()) {
      pc.addTrack(track, stream)
      void this.negotiator.offer()
    } else {
      this.negotiator.holdCamera(track, stream)
    }
    this.cameraChanged(true, !this.link.isCaller())
  }

  private cameraChanged(on: boolean, askForOffer = false): void {
    useCallStore.getState().setCamera(on)
    if (on) useCallStore.setState({ video: true }) // logged as a video call
    this.sendState(askForOffer ? { video: on, restart: true } : { video: on })
  }

  /** In-call state from the other person: camera, receive quality, restart requests. */
  handleState(signal: WebRTCSignal): void {
    const st = useCallStore.getState()
    if (!this.link.pc() || !signal.senderId || signal.senderId !== st.peerId) return
    if (typeof signal.video === 'boolean') {
      st.setPeerCamera(signal.video)
      if (signal.video) useCallStore.setState({ video: true })
    }
    if (signal.quality === 'good' || signal.quality === 'poor') {
      this.peerReceive = signal.quality
      this.applyQuality()
    }
    if (signal.restart && this.link.isCaller()) {
      void this.negotiator.offer({ iceRestart: this.reconnect.active, videoLine: signal.video === true })
    }
  }

  private onMyQuality(quality: ReceiveQuality): void {
    this.myReceive = quality
    this.sendState({ quality })
    this.applyQuality()
  }

  private applyQuality(): void {
    const { selfPoor, peerPoor } = attributeQuality(this.myReceive, this.peerReceive)
    useCallStore.getState().setPoorConnection(selfPoor)
    useCallStore.getState().setPeerPoor(peerPoor)
  }

  private sendState(state: { video?: boolean; quality?: ReceiveQuality; restart?: boolean }): void {
    const target = this.link.target()
    if (!target) return
    stompService.publish('/app/call.state', {
      targetId: target.peerId,
      conversationId: target.conversationId,
      type: 'state',
      ...state,
    })
  }

  /** The connection dropped mid-call: wait a minute, recovering on a beat. */
  dropped(): void {
    const expire = () => this.link.endCall('failed')
    const recover = () => {
      this.reconnect.begin(whoDropped(), expire) // only updates whose connection it is
      if (this.link.isCaller()) void this.negotiator.offer({ iceRestart: true })
      else this.sendState({ restart: true })
    }
    this.reconnect.begin(whoDropped(), expire, recover)
  }
}

/** Who the call waits for: us when this device is offline or lost the server. */
function whoDropped(): ReconnectWho {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  return offline || !stompService.isConnected() ? 'self' : 'peer'
}
