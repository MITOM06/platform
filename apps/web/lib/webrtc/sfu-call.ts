import { stompService } from '@/lib/stomp/client'
import type { CallEvent, CallTransport } from '@/lib/api/types'
import { useCallStore } from '@/lib/store/call.store'
import type { CallEndReason, CallNoticeKey } from './call-end-notice'
import { CONNECT_TIMEOUT_MS, RING_TIMEOUT_MS, START_TIMEOUT_MS, type WebRTCSignal } from './call-config'
import { canOpenMedia, sendCallLog, subscribeCallEvents } from './call-topic'
import type { CallHooks } from './call-hooks'
import { refreshCallTransport } from './call-transport'
import { OneShotTimer } from './one-shot-timer'
import { SfuCallRoom } from './sfu-call-room'

const DECLINE_REASONS: ReadonlySet<CallEndReason> = new Set(['declined', 'busy', 'media_error'])

const store = () => useCallStore.getState()

/**
 * 1-on-1 calls through LiveKit (server `CALL_TRANSPORT=sfu`). Same UX as the
 * mesh engine — ring, ringback, end reasons, call log — but the server rings
 * and LiveKit carries the media, so calls work across 4G / corporate NAT.
 * Contract: docs/superpowers/plans/2026-10-05-calls-on-livekit.md.
 * This class runs the call over STOMP; its room lives in SfuCallRoom.
 */
export class SfuDirectCall {
  private callId: string | null = null
  /** Caller: how long the callee rings before the call is given up as unanswered. */
  private readonly ringTimer = new OneShotTimer(RING_TIMEOUT_MS)
  /** Answered (`connecting`): how long the other person has to reach the room. */
  private readonly connectTimer = new OneShotTimer(CONNECT_TIMEOUT_MS)
  /** Caller: call.start waiting for its call.started — then, after a hang-up, the wait to cancel it. */
  private readonly startTimer = new OneShotTimer(START_TIMEOUT_MS)
  /** Our call.accept has gone out: our own answered-elsewhere echo must not end it. */
  private accepting = false
  /** Caller: call.start sent, call.started (with the id) not back yet. */
  private pendingStart: { conversationId: string } | null = null
  /** Caller hung up before the id arrived: cancel with this reason once it does. */
  private cancelledBeforeStart: CallEndReason | null = null
  /** Callee: the mic/camera probe is open — a second Answer must not run. */
  private probing = false
  /** This device was rung for the call (it did not place it). */
  private incoming = false
  /** Our own subscription to the call's conversation topic (the thread may be closed). */
  private topicSub: { unsubscribe: () => void } | null = null
  private readonly room: SfuCallRoom

  constructor(private readonly hooks: CallHooks) {
    this.room = new SfuCallRoom({
      hooks,
      currentCallId: () => this.callId,
      fail: (reason, notice) => this.endCall(reason, notice),
      roomClosed: (callId) => this.onEnded(callId, 'hangup'),
      peerPresent: () => {
        this.ringTimer.clear()
        this.connectTimer.clear()
        store().setConnected()
      },
    })
  }

  getLocalStream(): MediaStream | null {
    return this.room.localStream()
  }

  getRemoteStream(): MediaStream | null {
    return this.room.remoteStream()
  }

  async startCall(targetId: string, targetName: string, conversationId: string, video = true): Promise<void> {
    this.connectTimer.clear() // an earlier attempt never torn down must not end this one
    store().setOutgoing({ peerId: targetId, peerName: targetName, conversationId, video, transport: 'sfu' })
    this.incoming = false
    this.pendingStart = { conversationId }
    this.cancelledBeforeStart = null
    this.subscribeTopic(conversationId)
    // `merge`: we can join a call-merged call when they call us at the same time.
    stompService.publish('/app/call.start', { conversationId, media: video ? 'video' : 'audio', merge: true })
    this.ringTimer.arm(() => {
      if (store().status === 'outgoing') this.endCall('no_answer')
    })
    // A call.start lost on a dropping socket never gets its call.started: say so, don't ring on.
    this.startTimer.arm(() => {
      if (this.pendingStart?.conversationId === conversationId && store().status === 'outgoing') {
        this.endCall('failed', 'errStartTimeout')
      }
    })
  }

  /** `call.started` / `call.ended` from the conversation topic (kind direct, sfu). */
  handleCallEvent(event: CallEvent): void {
    // Their call.started (both tapped Call) is not our start: call-merged follows.
    if (event.event === 'call.started' && event.startedBy !== store().peerId) {
      this.onStarted(event.callId, event.conversationId, event.transport)
    }
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
      case 'call-merged':
        this.onMerged(signal)
        break
      case 'call-accepted':
        this.onAccepted(signal)
        break
      case 'call-blocked':
        this.onBlocked(signal)
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
    this.enterConnecting() // answered: no more prompt, no prompt timeout
    await this.room.join(callId)
  }

  /**
   * Hang up / decline / give up — tells the server, logs the call, explains it
   * locally (`notice`: a precise message instead of the one `reason` implies).
   */
  endCall(reason: CallEndReason = 'hangup', notice?: CallNoticeKey): void {
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
      if (conversationId) sendCallLog(conversationId, `system.call.missed:${kind}`)
    } else if (st.status === 'outgoing') {
      if (callId) {
        stompService.publish('/app/call.cancel', { callId, reason: reason === 'no_answer' ? 'no_answer' : 'hangup' })
        // The callee may have answered a moment ago — the server then refuses the
        // cancel, and only a leave ends the call. A no-op if the cancel landed.
        stompService.publish('/app/call.leave', { callId })
        if (conversationId) sendCallLog(conversationId, `system.call.missed:${kind}`)
      } else if (this.pendingStart) {
        this.cancelledBeforeStart = reason // the callee never rang: nothing to log
        keepPendingStart = true
      }
    } else if (callId) {
      stompService.publish('/app/call.leave', { callId })
      if (conversationId) {
        sendCallLog(
          conversationId,
          st.status === 'connected' ? `system.call.ended:${kind}:${st.durationSeconds}` : `system.call.missed:${kind}`,
        )
      }
    }
    const peerName = st.peerName
    this.teardown(keepPendingStart)
    // Waiting to cancel a call.started that may never come (lost call.start): not forever.
    if (keepPendingStart) this.startTimer.arm(() => this.dropPendingStart())
    this.notifyEnd(reason, false, peerName, notice)
  }

  /** The incoming prompt timed out locally — or the user gave up on a call it answered. */
  dismissIncoming(): void {
    const { status } = store()
    if (!this.incoming || (status !== 'incoming' && status !== 'connecting')) return
    // Already answered: the server counts us in, and only a leave takes us out.
    if (this.accepting && this.callId) stompService.publish('/app/call.leave', { callId: this.callId })
    this.teardown(false)
  }

  toggleMic(on: boolean): void {
    store().setMic(on)
    this.room.setMic(on)
  }

  /** Our camera on/off — in a voice call this publishes it and makes it a video call. */
  toggleCamera(on: boolean): void {
    store().setCamera(on)
    if (on) useCallStore.setState({ video: true })
    this.room.setCamera(on)
  }

  private onStarted(callId: string, conversationId: string, transport: CallTransport | undefined): void {
    if (!this.pendingStart || this.pendingStart.conversationId !== conversationId) return
    this.pendingStart = null
    this.startTimer.clear()
    if (this.cancelledBeforeStart) {
      const reason = this.cancelledBeforeStart === 'no_answer' ? 'no_answer' : 'hangup'
      this.cancelledBeforeStart = null
      stompService.publish('/app/call.cancel', { callId, reason })
      stompService.publish('/app/call.leave', { callId })
      if (store().status === 'idle') this.unsubscribeTopic() // a call ringing us now keeps it
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
    void this.room.join(callId)
  }

  private onEnded(callId: string, reason: CallEndReason): void {
    if (!this.callId || callId !== this.callId) return
    const st = store()
    const wasIncoming = st.status === 'incoming' && !this.accepting
    const peerName = st.peerName
    this.teardown(false)
    if (!wasIncoming) this.notifyEnd(reason, true, peerName)
  }

  private onRing(signal: WebRTCSignal): void {
    const { callId, conversationId, senderId } = signal
    if (!callId || !conversationId || !senderId) return
    const st = store()
    // Calling the person calling us (both tapped Call) is not busy: call-merged follows.
    if (st.status === 'outgoing' && st.peerId === senderId && st.conversationId === conversationId) return
    if (st.status !== 'idle' || st.groupCallId) {
      if (st.callId !== callId) stompService.publish('/app/call.decline', { callId, reason: 'busy' })
      return
    }
    this.callId = callId
    this.accepting = false
    this.incoming = true
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

  /** Both tapped Call: the server accepted us into their call instead of ringing them. */
  private onMerged(signal: WebRTCSignal): void {
    const { callId, conversationId, senderId } = signal
    if (!callId || !conversationId || !senderId) return
    if (this.cancelledBeforeStart && this.pendingStart?.conversationId === conversationId) {
      // We hung up before the server answered: leave the call it put us in.
      this.dropPendingStart()
      stompService.publish('/app/call.leave', { callId })
      return
    }
    const st = store()
    if (st.status !== 'outgoing' || st.peerId !== senderId || st.conversationId !== conversationId) return
    if (this.callId === callId) return // a repeated merge: already joining
    this.pendingStart = null // our own call.start was folded into theirs: no call.started comes
    this.startTimer.clear()
    this.ringTimer.clear()
    this.callId = callId
    this.accepting = true // already accepted by the server: its answered-elsewhere echo is ours
    st.setCallId(callId)
    // The call's media wins, cameras included: a voice call merged into a video one shows video.
    const video = signal.media === 'video'
    if (st.video !== video) useCallStore.setState({ video, cameraEnabled: video, peerCamera: video })
    this.enterConnecting()
    void this.room.join(callId)
  }

  /** The callee answered our call: stop the ring timer and ringback, it is connecting. */
  private onAccepted(signal: WebRTCSignal): void {
    if (!signal.callId || signal.callId !== this.callId || store().status !== 'outgoing') return
    this.ringTimer.clear()
    this.enterConnecting()
  }

  /**
   * Answered, joining the room: no ring timer applies any more, so bound the wait
   * for the other person instead — their app may have died or their join failed.
   */
  private enterConnecting(): void {
    store().setConnecting()
    const callId = this.callId
    this.connectTimer.arm(() => {
      if (this.callId === callId && store().status === 'connecting') this.endCall('failed', 'errPeerNeverJoined')
    })
  }

  /** The server refused our call.start (one of us blocked the other): drop the attempt. */
  private onBlocked(signal: WebRTCSignal): void {
    const pending = this.pendingStart
    if (!pending || (signal.conversationId && signal.conversationId !== pending.conversationId)) return
    if (store().status === 'outgoing' && !this.callId) this.teardown(false)
    else this.dropPendingStart()
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
      sendCallLog(st.conversationId, `system.call.missed:${st.video ? 'video' : 'voice'}`)
    }
    const peerName = st.peerName
    this.teardown(false)
    this.notifyEnd(reason, true, peerName)
  }

  private notifyEnd(reason: CallEndReason, byPeer: boolean, peerName: string, notice?: CallNoticeKey): void {
    if (notice) this.hooks.onEndNotice?.(reason, byPeer, peerName, notice)
    else this.hooks.onEndNotice?.(reason, byPeer, peerName)
  }

  private subscribeTopic(conversationId: string): void {
    this.unsubscribeTopic()
    this.topicSub = subscribeCallEvents(conversationId, (event) => this.handleCallEvent(event))
  }

  private unsubscribeTopic(): void {
    this.topicSub?.unsubscribe()
    this.topicSub = null
  }

  /** Stop waiting for our call.started (cancelled, refused, or it never came). */
  private dropPendingStart(): void {
    this.startTimer.clear()
    this.pendingStart = null
    this.cancelledBeforeStart = null
    if (store().status === 'idle') this.unsubscribeTopic() // a call ringing us now keeps it
  }

  private teardown(keepPendingStart: boolean): void {
    this.ringTimer.clear()
    this.connectTimer.clear()
    this.startTimer.clear()
    this.probing = false
    this.room.close()
    this.callId = null
    this.accepting = false
    this.incoming = false
    if (!keepPendingStart) {
      this.pendingStart = null
      this.cancelledBeforeStart = null
      this.unsubscribeTopic() // kept while a cancel still waits for its call.started
    }
    this.hooks.onEnded?.()
    store().reset()
  }
}
