import { stompService } from '@/lib/stomp/client'
import { callsApi } from '@/lib/api/calls'
import type { CallMedia, CallParticipant } from '@/lib/api/types'
import { LiveKitSession } from '@/lib/rtc/livekit-session'
import { useCallStore } from '@/lib/store/call.store'
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

  toggleMic(on: boolean): void {
    void this.session?.setMic(on)
    store().setMic(on)
  }

  toggleCamera(on: boolean): void {
    void this.session?.setCamera(on)
    store().setCamera(on)
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
    } catch {
      if (this.callId === callId) this.leave()
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
    session.onDisconnected = () => {
      if (this.session === session) this.leave()
    }
    try {
      await session.connect(token.url, token.token, { video: media === 'video' })
    } catch {
      if (this.session === session) this.leave()
    }
  }

  private teardown(): void {
    const session = this.session
    this.session = null
    session?.disconnect()
    this.callId = null
    this.pendingStart = false
    this.hooks.onLocalStream = null
    this.hooks.onEnded?.()
    store().resetGroup()
  }
}
