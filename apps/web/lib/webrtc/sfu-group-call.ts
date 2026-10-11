import { stompService } from '@/lib/stomp/client'
import { callsApi } from '@/lib/api/calls'
import type { CallMedia, CallParticipant } from '@/lib/api/types'
import { LiveKitSession, MediaAccessError } from '@/lib/rtc/livekit-session'
import { useCallStore } from '@/lib/store/call.store'
import type { CallNoticeKey } from './call-end-notice'
import { callErrorNotice } from './call-errors'
import type { GroupCallHooks } from './call-hooks'

const store = () => useCallStore.getState()

/**
 * Group calls through LiveKit (server `CALL_TRANSPORT=sfu`): same Zalo-style
 * flow — everyone rings, late joiners use the banner — but one upload per
 * person instead of a mesh, so it holds up past 4–6 people. The roster still
 * comes from the server (fed by LiveKit webhooks); streams come from the room.
 */
export class SfuGroupCall {
  private session: LiveKitSession | null = null
  /** The session whose connect() finished: mic / camera changes before that wait in the store. */
  private joined: LiveKitSession | null = null
  private callId: string | null = null
  private pendingStart = false

  constructor(private readonly hooks: GroupCallHooks) {}

  isActive(): boolean {
    return this.callId !== null
  }

  getLocalStream(): MediaStream | null {
    return this.session?.localStream() ?? null
  }

  getRemoteStream(peerId: string): MediaStream | null {
    return this.session?.peer(peerId)?.stream ?? null
  }

  async startCall(conversationId: string, _localUserId: string, media: CallMedia, aiNotetaker: boolean): Promise<void> {
    this.pendingStart = true
    stompService.publish('/app/call.start', { conversationId, media, aiNotetaker })
  }

  /** Our own `call.started`: the server already counts us in — just enter the room. */
  async confirmStarted(
    callId: string,
    conversationId: string,
    _localUserId: string,
    media: CallMedia,
    aiNotetaker: boolean,
  ): Promise<void> {
    if (!this.pendingStart || this.callId) return
    this.pendingStart = false
    await this.enter(callId, conversationId, media, aiNotetaker)
  }

  /** Join from a ring or the banner: answer, then enter the room. */
  async join(
    callId: string,
    conversationId: string,
    _localUserId: string,
    media: CallMedia,
    aiNotetaker: boolean,
  ): Promise<void> {
    if (this.callId === callId) return
    stompService.publish('/app/call.accept', { callId })
    await this.enter(callId, conversationId, media, aiNotetaker)
  }

  applyRoster(participants: CallParticipant[]): void {
    if (this.callId) store().setRoster(participants)
  }

  /** Sent to the room once joined; until then the join applies the store's value. */
  toggleMic(on: boolean): void {
    store().setMic(on)
    if (this.joined) this.joined.setMic(on).catch(() => undefined)
  }

  toggleCamera(on: boolean): void {
    store().setCamera(on)
    if (this.joined) this.joined.setCamera(on).catch(() => undefined)
  }

  leave(): void {
    if (this.callId) stompService.publish('/app/call.leave', { callId: this.callId })
    this.teardown()
  }

  /** Server-driven end (`call.ended`). */
  handleEnded(callId: string): void {
    if (this.callId === callId) this.teardown()
  }

  private async enter(callId: string, conversationId: string, media: CallMedia, aiNotetaker: boolean): Promise<void> {
    this.callId = callId
    store().startGroupCall({ callId, conversationId, media, aiNotetaker, transport: 'sfu' })
    let token: { url: string; token: string }
    try {
      token = await callsApi.getToken(callId)
    } catch (err) {
      if (this.callId === callId) this.failJoin(callErrorNotice(err))
      return
    }
    if (this.callId !== callId) return
    const session = new LiveKitSession()
    this.session = session
    session.onLocalStream = (s) => this.hooks.onLocalStream?.(s)
    session.onPeersChanged = (peers) => {
      if (peers.length > 0) store().setGroupActive()
      store().setSpeaking(peers.filter((p) => p.speaking).map((p) => p.identity))
      store().bumpStreams()
    }
    session.onReconnecting = (on) => store().setReconnecting(on)
    session.onLocalPoorConnection = (poor) => store().setPoorConnection(poor)
    session.onDisconnected = (reason) => {
      if (this.session !== session) return
      if (reason === 'ended') this.teardown() // the server closed the room: nothing to tell it
      else this.leave()
    }
    // Join with the user's choice so far; one changed while connecting is applied after.
    const asked = { mic: store().micEnabled, camera: store().cameraEnabled }
    try {
      await session.connect(token.url, token.token, { video: asked.camera, audio: asked.mic })
    } catch (err) {
      if (this.session === session) this.failJoin(err instanceof MediaAccessError ? 'mediaError' : 'errFailed')
      return
    }
    if (this.session !== session) return
    this.joined = session
    const { micEnabled, cameraEnabled } = store()
    if (micEnabled !== asked.mic) session.setMic(micEnabled).catch(() => undefined)
    if (cameraEnabled !== asked.camera) session.setCamera(cameraEnabled).catch(() => undefined)
  }

  /** The room could not be joined: say why (localized), then leave the call. */
  private failJoin(notice: CallNoticeKey): void {
    this.hooks.onJoinError?.(notice)
    this.leave()
  }

  private teardown(): void {
    const session = this.session
    this.session = null
    this.joined = null
    session?.disconnect()
    this.callId = null
    this.pendingStart = false
    this.hooks.onLocalStream = null
    this.hooks.onEnded?.()
    // reconnecting / poorConnection are shared with 1-on-1 calls: never carry them over.
    store().setReconnecting(false)
    store().setPoorConnection(false)
    store().resetGroup()
  }
}
