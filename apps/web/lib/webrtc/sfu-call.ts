import { stompService } from '@/lib/stomp/client'
import { chatService } from '@/lib/api/chat'
import { callsApi } from '@/lib/api/calls'
import type { CallEvent, CallTransport } from '@/lib/api/types'
import { LiveKitSession, MediaAccessError } from '@/lib/rtc/livekit-session'
import { useCallStore } from '@/lib/store/call.store'
import type { CallEndReason } from './call-end-notice'
import { DISCONNECT_GRACE_MS, RING_TIMEOUT_MS, type WebRTCSignal } from './call-config'
import type { CallHooks } from './call-hooks'
import { refreshCallTransport } from './call-transport'

const DECLINE_REASONS: ReadonlySet<CallEndReason> = new Set(['declined', 'busy', 'media_error'])

const store = () => useCallStore.getState()

/**
 * 1-on-1 calls through LiveKit (server `CALL_TRANSPORT=sfu`). Same UX as the
 * mesh engine — ring, ringback, end reasons, call log — but the server rings
 * and LiveKit carries the media, so calls work across 4G / corporate NAT.
 * Contract: docs/superpowers/plans/2026-10-05-calls-on-livekit.md.
 */
export class SfuDirectCall {
  private session: LiveKitSession | null = null
  private callId: string | null = null
  private ringTimer: ReturnType<typeof setTimeout> | null = null
  /** Our call.accept has gone out: our own answered-elsewhere echo must not end it. */
  private accepting = false
  /** Caller: call.start sent, call.started (with the id) not back yet. */
  private pendingStart: { conversationId: string } | null = null
  /** Caller hung up before the id arrived: cancel with this reason once it does. */
  private cancelledBeforeStart: CallEndReason | null = null
  /** Callee: the mic/camera probe is open — a second Answer must not run. */
  private probing = false
  /** Our own subscription to the call's conversation topic (the thread may be closed). */
  private topicSub: { unsubscribe: () => void } | null = null
  /** The stream last handed to the UI — re-handing the same one restarts playback. */
  private lastRemote: MediaStream | null = null
  /** The other person left the room: end if they are not back within the grace. */
  private peerGoneTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly hooks: CallHooks) {}

  getLocalStream(): MediaStream | null {
    return this.session?.localStream() ?? null
  }

  getRemoteStream(): MediaStream | null {
    const peerId = store().peerId
    return (peerId && this.session?.peer(peerId)?.stream) || null
  }

  async startCall(targetId: string, targetName: string, conversationId: string, video = true): Promise<void> {
    store().setOutgoing({ peerId: targetId, peerName: targetName, conversationId, video, transport: 'sfu' })
    this.pendingStart = { conversationId }
    this.cancelledBeforeStart = null
    this.subscribeTopic(conversationId)
    stompService.publish('/app/call.start', { conversationId, media: video ? 'video' : 'audio' })
    this.ringTimer = setTimeout(() => {
      this.ringTimer = null
      if (store().status === 'outgoing') this.endCall('no_answer')
    }, RING_TIMEOUT_MS)
  }

  /** `call.started` / `call.ended` from the conversation topic (kind direct, sfu). */
  handleCallEvent(event: CallEvent): void {
    if (event.event === 'call.started') this.onStarted(event.callId, event.conversationId, event.transport)
    if (event.event === 'call.ended') this.onEnded(event.callId, (event.reason as CallEndReason) ?? 'hangup')
  }

  handleSignal(signal: WebRTCSignal): void {
    switch (signal.type) {
      case 'call-ring':
        this.onRing(signal)
        break
      case 'call-ring-cancel':
        this.onRingCancel(signal)
        break
      case 'call-declined':
        this.onDeclined(signal)
        break
    }
  }

  async acceptIncoming(): Promise<void> {
    const { status, video } = store()
    const callId = this.callId
    if (!callId || status !== 'incoming' || this.accepting || this.probing) return
    // Check the mic/camera BEFORE answering: once accepted, the server no
    // longer takes a decline, so a refused permission must be said now.
    this.probing = true
    const mediaOk = await canOpenMedia(video)
    this.probing = false
    if (!mediaOk) {
      if (this.callId === callId) this.endCall('media_error')
      return
    }
    if (this.callId !== callId) return // the caller gave up while the prompt was open
    this.accepting = true
    stompService.publish('/app/call.accept', { callId })
    await this.join(video)
  }

  /** Hang up / decline / give up — tells the server, logs the call, explains it locally. */
  endCall(reason: CallEndReason = 'hangup'): void {
    const st = store()
    if (st.status === 'idle') return
    const callId = this.callId
    const conversationId = st.conversationId
    const kind = st.video ? 'video' : 'voice'
    let keepPendingStart = false
    if (st.status === 'incoming' && !this.accepting) {
      if (callId) {
        const why = DECLINE_REASONS.has(reason) ? reason : 'declined'
        stompService.publish('/app/call.decline', { callId, reason: why })
      }
      if (conversationId) this.sendCallLog(conversationId, `system.call.missed:${kind}`)
    } else if (st.status === 'outgoing') {
      if (callId) {
        stompService.publish('/app/call.cancel', { callId, reason: reason === 'no_answer' ? 'no_answer' : 'hangup' })
        // The callee may have answered a moment ago — the server then refuses the
        // cancel, and only a leave ends the call. A no-op if the cancel landed.
        stompService.publish('/app/call.leave', { callId })
        if (conversationId) this.sendCallLog(conversationId, `system.call.missed:${kind}`)
      } else if (this.pendingStart) {
        this.cancelledBeforeStart = reason // the callee never rang: nothing to log
        keepPendingStart = true
      }
    } else if (callId) {
      stompService.publish('/app/call.leave', { callId })
      if (conversationId) {
        this.sendCallLog(
          conversationId,
          st.status === 'connected' ? `system.call.ended:${kind}:${st.durationSeconds}` : `system.call.missed:${kind}`,
        )
      }
    }
    const peerName = st.peerName
    this.teardown(keepPendingStart)
    this.hooks.onEndNotice?.(reason, false, peerName)
  }

  /** The incoming prompt timed out locally. */
  dismissIncoming(): void {
    if (store().status === 'incoming') this.teardown(false)
  }

  toggleMic(on: boolean): void {
    void this.session?.setMic(on)
    store().setMic(on)
  }

  toggleCamera(on: boolean): void {
    void this.session?.setCamera(on)
    store().setCamera(on)
  }

  private onStarted(callId: string, conversationId: string, transport: CallTransport | undefined): void {
    if (!this.pendingStart || this.pendingStart.conversationId !== conversationId) return
    this.pendingStart = null
    if (this.cancelledBeforeStart) {
      const reason = this.cancelledBeforeStart === 'no_answer' ? 'no_answer' : 'hangup'
      this.cancelledBeforeStart = null
      stompService.publish('/app/call.cancel', { callId, reason })
      stompService.publish('/app/call.leave', { callId })
      this.unsubscribeTopic()
      return
    }
    if (transport !== 'sfu') {
      // The server moved back to mesh after we read the config: this session
      // is not one we can join. End it, re-read the transport, let the user retry.
      stompService.publish('/app/call.leave', { callId })
      void refreshCallTransport()
      if (store().status === 'outgoing') this.endCall('failed')
      return
    }
    if (store().status !== 'outgoing') return
    this.callId = callId
    store().setCallId(callId)
    void this.join(store().video)
  }

  private onEnded(callId: string, reason: CallEndReason): void {
    if (!this.callId || callId !== this.callId) return
    const st = store()
    const wasIncoming = st.status === 'incoming' && !this.accepting
    const peerName = st.peerName
    this.teardown(false)
    if (!wasIncoming) this.hooks.onEndNotice?.(reason, true, peerName)
  }

  private onRing(signal: WebRTCSignal): void {
    const { callId, conversationId, senderId } = signal
    if (!callId || !conversationId || !senderId) return
    const st = store()
    if (st.status !== 'idle' || st.groupCallId) {
      if (st.callId !== callId) stompService.publish('/app/call.decline', { callId, reason: 'busy' })
      return
    }
    this.callId = callId
    this.accepting = false
    this.subscribeTopic(conversationId)
    st.setIncoming({
      peerId: senderId,
      peerName: '',
      conversationId,
      video: signal.media === 'video',
      callId,
      transport: 'sfu',
    })
  }

  private onRingCancel(signal: WebRTCSignal): void {
    if (!signal.callId || signal.callId !== this.callId || this.accepting) return
    if (store().status === 'incoming') this.teardown(false)
  }

  private onDeclined(signal: WebRTCSignal): void {
    const st = store()
    if (st.status !== 'outgoing') return
    const sameCall = signal.callId
      ? signal.callId === this.callId
      : !!this.pendingStart && signal.conversationId === st.conversationId
    if (!sameCall) return
    const reason = signal.reason ?? 'declined'
    if (reason === 'busy' && st.conversationId) {
      this.sendCallLog(st.conversationId, `system.call.missed:${st.video ? 'video' : 'voice'}`)
    }
    const peerName = st.peerName
    this.teardown(false)
    this.hooks.onEndNotice?.(reason, true, peerName)
  }

  private async join(video: boolean): Promise<void> {
    const callId = this.callId
    if (!callId) return
    let token: { url: string; token: string }
    try {
      token = await callsApi.getToken(callId)
    } catch {
      if (this.callId === callId) this.endCall('failed')
      return
    }
    if (this.callId !== callId) return // ended while fetching the token
    const session = new LiveKitSession()
    this.session = session
    session.onLocalStream = (s) => this.hooks.onLocalStream?.(s)
    session.onPeersChanged = () => this.onPeers()
    session.onReconnecting = (on) => store().setReconnecting(on)
    session.onLocalPoorConnection = (poor) => store().setPoorConnection(poor)
    session.onDisconnected = (reason) => {
      if (this.session !== session) return
      // The server closing the room means the call is over (the other side
      // hung up) — the same as call.ended, which we may not have received.
      if (reason === 'ended') this.onEnded(callId, 'hangup')
      else this.endCall('failed')
    }
    try {
      await session.connect(token.url, token.token, { video })
    } catch (err) {
      if (this.session !== session) return
      this.endCall(err instanceof MediaAccessError ? 'media_error' : 'failed')
    }
  }

  private onPeers(): void {
    const peerId = store().peerId
    const peer = peerId ? this.session?.peer(peerId) : undefined
    if (!peer) {
      // They left the room without the call ending (crash, lost network, a
      // room the server failed to close): give them the same grace as LiveKit.
      if (store().status === 'connected' && !this.peerGoneTimer) {
        this.peerGoneTimer = setTimeout(() => {
          this.peerGoneTimer = null
          if (store().status === 'connected') this.endCall('failed')
        }, DISCONNECT_GRACE_MS)
      }
      return
    }
    this.clearPeerGoneTimer()
    if (peer.stream !== this.lastRemote) {
      this.lastRemote = peer.stream
      this.hooks.onRemoteStream?.(peer.stream)
    }
    if (store().status !== 'connected') {
      this.clearRingTimer()
      store().setConnected()
    }
  }

  private subscribeTopic(conversationId: string): void {
    this.unsubscribeTopic()
    this.topicSub =
      stompService.subscribe(`/topic/conversation/${conversationId}`, (frame) => {
        try {
          const event = JSON.parse(frame.body) as { event?: string }
          if (event.event === 'call.started' || event.event === 'call.ended') {
            this.handleCallEvent(event as CallEvent)
          }
        } catch {
          // not JSON — ignore
        }
      }) ?? null
  }

  private unsubscribeTopic(): void {
    this.topicSub?.unsubscribe()
    this.topicSub = null
  }

  private clearPeerGoneTimer(): void {
    if (this.peerGoneTimer) clearTimeout(this.peerGoneTimer)
    this.peerGoneTimer = null
  }

  private sendCallLog(conversationId: string, content: string): void {
    chatService.sendMessage(conversationId, content, 'system').catch(() => {
      // best-effort — a failed system message must not block hang-up
    })
  }

  private clearRingTimer(): void {
    if (this.ringTimer) clearTimeout(this.ringTimer)
    this.ringTimer = null
  }

  private teardown(keepPendingStart: boolean): void {
    this.clearRingTimer()
    this.clearPeerGoneTimer()
    this.lastRemote = null
    this.probing = false
    const session = this.session
    this.session = null
    session?.disconnect()
    this.callId = null
    this.accepting = false
    if (!keepPendingStart) {
      this.pendingStart = null
      this.cancelledBeforeStart = null
      this.unsubscribeTopic() // kept while a cancel still waits for its call.started
    }
    this.hooks.onEnded?.()
    store().reset()
  }
}

/** Can the browser open the mic (and camera)? Releases the probe at once. */
async function canOpenMedia(video: boolean): Promise<boolean> {
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video })
    probe.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}
