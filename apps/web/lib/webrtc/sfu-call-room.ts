import { callsApi } from '@/lib/api/calls'
import { LiveKitSession, MediaAccessError } from '@/lib/rtc/livekit-session'
import { useCallStore } from '@/lib/store/call.store'
import type { CallEndReason, CallNoticeKey } from './call-end-notice'
import { callErrorNotice } from './call-errors'
import type { CallHooks } from './call-hooks'
import { refreshCallTransport } from './call-transport'
import { ReconnectWatch } from './reconnect-watch'

const store = () => useCallStore.getState()

/** What the room needs from the 1-on-1 call it carries (SfuDirectCall). */
export interface SfuRoomOwner {
  readonly hooks: CallHooks
  /** The call being made right now — a join for a call that ended meanwhile stops. */
  currentCallId(): string | null
  /** Give the call up: tell the server, log it, explain it (`endCall`). */
  fail(reason: CallEndReason, notice?: CallNoticeKey): void
  /** The server closed the room: the other side hung up (same as `call.ended`). */
  roomClosed(callId: string): void
  /** The other person is in the room: the call is connected. */
  peerPresent(): void
}

/** Best-effort media change: a refused device must not become an unhandled rejection. */
function quietly(change: Promise<void>): void {
  change.catch(() => undefined)
}

/**
 * The LiveKit room of a 1-on-1 sfu call: joining it with the user's own mic /
 * camera choice, re-joining it for up to a minute after the connection is lost,
 * and following the other person (stream, camera, weak network, leaving).
 * Ringing, answering and the server protocol stay in SfuDirectCall.
 */
export class SfuCallRoom {
  private session: LiveKitSession | null = null
  /** The session whose connect() finished. Mic / camera changes before that wait in the store. */
  private joined: LiveKitSession | null = null
  /** The stream last handed to the UI — re-handing the same one restarts playback. */
  private lastRemote: MediaStream | null = null
  /** Someone dropped: the one-minute "waiting to reconnect" window; a rejoin in flight. */
  private readonly watch = new ReconnectWatch()
  private rejoining = false

  constructor(private readonly owner: SfuRoomOwner) {}

  localStream(): MediaStream | null {
    return this.session?.localStream() ?? null
  }

  remoteStream(): MediaStream | null {
    const peerId = store().peerId
    return (peerId && this.session?.peer(peerId)?.stream) || null
  }

  /** Our mic: sent to the room once joined; until then the join applies the store's value. */
  setMic(on: boolean): void {
    if (this.joined) quietly(this.joined.setMic(on))
  }

  setCamera(on: boolean): void {
    if (this.joined) quietly(this.joined.setCamera(on))
  }

  /** Join (or, `rejoin`, re-join after losing) the call's room. A failed rejoin is retried. */
  async join(callId: string, rejoin = false): Promise<void> {
    let token: { url: string; token: string }
    try {
      token = await callsApi.getToken(callId)
    } catch (err) {
      if (rejoin || this.owner.currentCallId() !== callId) return
      const notice = callErrorNotice(err)
      if (notice === 'errNotSfu') void refreshCallTransport() // the server moved back to mesh
      this.owner.fail('failed', notice)
      return
    }
    if (this.owner.currentCallId() !== callId) return // ended while fetching the token
    // Never two room sessions per identity; detach first so its onDisconnected is moot.
    this.detach()
    const session = new LiveKitSession()
    this.session = session
    this.wire(session, callId)
    // Join with what the user chose so far (muted while ringing stays muted)…
    const asked = { mic: store().micEnabled, camera: store().cameraEnabled }
    try {
      await session.connect(token.url, token.token, { video: asked.camera, audio: asked.mic })
    } catch (err) {
      if (rejoin || this.session !== session) return
      if (err instanceof MediaAccessError) this.owner.fail('media_error')
      else this.owner.fail('failed', 'errFailed')
      return
    }
    if (this.session !== session) return
    this.joined = session
    // …and apply what they changed while it connected.
    const { micEnabled, cameraEnabled } = store()
    if (micEnabled !== asked.mic) quietly(session.setMic(micEnabled))
    if (cameraEnabled !== asked.camera) quietly(session.setCamera(cameraEnabled))
    if (rejoin) this.rejoined()
  }

  /** Leave the room locally (the owner tells the server) and stop every wait. */
  close(): void {
    this.watch.end()
    this.rejoining = false
    this.lastRemote = null
    this.detach()
  }

  private detach(): void {
    const session = this.session
    this.session = null
    this.joined = null
    session?.disconnect()
  }

  private wire(session: LiveKitSession, callId: string): void {
    session.onLocalStream = (s) => this.owner.hooks.onLocalStream?.(s)
    session.onPeersChanged = () => this.onPeers()
    session.onReconnecting = (on) => {
      store().setReconnecting(on)
      if (on) this.watch.beginAfterBlip('self', () => this.owner.fail('failed'))
      else this.onPeers() // resumed: ends the wait, or waits for them if they left meanwhile
    }
    session.onLocalPoorConnection = (poor) => store().setPoorConnection(poor)
    session.onDisconnected = (reason) => {
      if (this.session !== session) return
      // The server closing the room means the call is over (the other side
      // hung up) — the same as call.ended, which we may not have received.
      if (reason === 'ended') this.owner.roomClosed(callId)
      else this.lostRoom(callId)
    }
  }

  /** LiveKit could not resume: keep the call screen and re-join for up to a minute. */
  private lostRoom(callId: string): void {
    this.joined = null
    this.watch.begin('self', () => this.owner.fail('failed'), () => void this.rejoin(callId))
  }

  private async rejoin(callId: string): Promise<void> {
    if (this.rejoining || this.owner.currentCallId() !== callId) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return // wait for a network
    this.rejoining = true
    try {
      await this.join(callId, true)
    } finally {
      this.rejoining = false
    }
  }

  /** Back in the room: stop re-joining (that would tear this room down), see whether they are here. */
  private rejoined(): void {
    this.watch.stopRetrying()
    store().setReconnecting(false)
    this.onPeers()
  }

  private onPeers(): void {
    const peerId = store().peerId
    const peer = peerId ? this.session?.peer(peerId) : undefined
    if (!peer) {
      // They left without the call ending (crash, lost network): wait a minute, as the server
      // does. LiveKit only reports them gone once their own reconnect gives up (~15-20 s), so
      // this minute starts later than theirs; the server's, which ends the call, starts with ours.
      if (store().status === 'connected') this.watch.begin('peer', () => this.owner.fail('failed'))
      else this.watch.end()
      return
    }
    if (!store().reconnecting) this.watch.end()
    store().setPeerPoor(peer.poorConnection)
    // Their camera: known once they publish video; until then the call kind stands.
    if (peer.stream.getVideoTracks().length > 0) {
      store().setPeerCamera(!peer.camMuted)
      if (!peer.camMuted) useCallStore.setState({ video: true })
    }
    if (peer.stream !== this.lastRemote) {
      this.lastRemote = peer.stream
      this.owner.hooks.onRemoteStream?.(peer.stream)
    }
    if (store().status !== 'connected') this.owner.peerPresent()
  }
}
