import {
  MEETING_LIMITS,
  type HostAction,
  type LobbyEntry,
  type Meeting,
  type MeetingEvent,
  type MeetingJoinResponse,
  type MeetingPerson,
  type MeetingSettings,
  type ReactionEmoji,
  type RosterEntry,
} from '@/lib/api/meeting-types'
import { MediaAccessError, ScreenShareError } from '@/lib/rtc/livekit-session'
import { useMeetingRoomStore, type MeetingRoomData } from '@/lib/store/meeting.store'
import { setActiveMeetingRoom, getActiveMeetingRoom, type ActiveMeetingRoom } from './active-room'
import { meetingKeys } from './cache-updates'
import { meetingErrorKey, meetingEventErrorKey, parseMeetingError } from './meeting-errors'
import { MeetingRoomChat } from './meeting-room-chat'
import { canShareScreen, isManager } from './permissions'
import {
  SWITCH_ACTIONS, answerLobby, flushNotes, hostCommandBody, initialRoomRole, mutedNotice, roleChange, withoutPending,
} from './room-host'
import { wireRoomSession, type JoinMedia, type MeetingRoomDeps, type RoomSession } from './room-session'
import { appendOwnChat, markMeetingEnded, rereadLobby, rereadMeeting } from './room-sync'
import { phaseAfterJoinError, phaseAfterPersonalEvent, phaseAfterRoomClosed } from './room-phase'

/**
 * Drives one open meeting room (not React, like SfuGroupCall): REST join / lobby / end, `/app/meet.*`
 * commands, the shared LiveKitSession, and personal-queue events. Writes UI state to meeting.store;
 * server data stays in TanStack Query. Tokens never carry roomAdmin — host actions go via `/app/meet.host`.
 */

export type { JoinMedia, MeetingRoomDeps, RoomSession }

const store = () => useMeetingRoomStore.getState()
const set = (patch: Partial<MeetingRoomData>) => useMeetingRoomStore.setState(patch)

export class MeetingRoomController implements ActiveMeetingRoom {
  readonly meetingId: string
  private session: RoomSession | null = null
  /** What a (re)join publishes: the pre-join choice, then every in-room toggle / server mute. */
  private media: JoinMedia = { mic: true, camera: true }
  private settings: MeetingSettings
  /** Bumped by every join / leave / dispose: answers of an older run are dropped. */
  private epoch = 0
  private readonly chat: MeetingRoomChat
  private notesFlush: (() => Promise<void>) | null = null

  constructor(
    private readonly meeting: Meeting,
    private readonly myId: string,
    private readonly deps: MeetingRoomDeps,
  ) {
    this.meetingId = meeting.id
    this.settings = meeting.settings
    this.chat = new MeetingRoomChat(meeting.id, myId, deps, () => this.session)
  }

  activate(): void {
    store().reset()
    set({ meetingId: this.meetingId, phase: 'prejoin', myRole: initialRoomRole(this.meeting) })
    setActiveMeetingRoom(this)
  }

  dispose(): void {
    if (store().phase === 'waiting') void this.deps.api.leaveLobby(this.meetingId).catch(() => undefined)
    this.epoch++
    this.closeSession()
    this.chat.dispose()
    if (getActiveMeetingRoom() === this) setActiveMeetingRoom(null)
    store().reset()
  }

  // ── Joining ──────────────────────────────────────────────────────────────

  async join(media: JoinMedia): Promise<void> {
    this.media = media
    await this.enter(true)
  }

  /** My last mic/camera state in the room (not the pre-join choice), fresh token. */
  async rejoin(): Promise<void> {
    await this.enter(store().phase !== 'waiting')
  }

  /**
   * `quiet`: a background re-ask from the lobby (STOMP reconnect) — a network
   * glitch keeps the waiting screen instead of replacing it with an error.
   */
  private async enter(showJoining: boolean, quiet = false): Promise<void> {
    const run = ++this.epoch
    this.closeSession()
    if (showJoining) set({ phase: 'joining' })
    let res: MeetingJoinResponse
    try {
      res = await this.deps.api.join(this.meetingId)
    } catch (err) {
      if (run !== this.epoch) return
      const phase = phaseAfterJoinError(parseMeetingError(err))
      if (!(quiet && (phase === 'error' || phase === 'unavailable'))) set({ phase })
      return
    }
    if (run !== this.epoch) return
    if (res.status === 'waiting') {
      set({ phase: 'waiting' })
      return
    }
    await this.connect(res, run)
  }

  private async connect(res: Extract<MeetingJoinResponse, { status: 'joined' }>, run: number): Promise<void> {
    set({ phase: 'connecting' })
    const session = this.deps.createSession()
    this.session = session
    this.wire(session)
    const { mic, camera, audioDeviceId, videoDeviceId } = this.media
    let media = { mic, camera }
    try {
      await session.connect(res.url, res.token, { video: camera, audio: mic, audioDeviceId, videoDeviceId })
    } catch (err) {
      if (!this.isCurrent(session, run)) return
      if (!(err instanceof MediaAccessError)) return this.lost(session)
      this.deps.notify('error', { key: 'mediaFailed' })
      media = { mic: false, camera: false }
      try {
        await session.connect(res.url, res.token, { video: false, audio: false })
      } catch {
        if (this.isCurrent(session, run)) this.lost(session)
        return
      }
    }
    if (!this.isCurrent(session, run)) {
      session.disconnect()
      return
    }
    this.media = { ...this.media, ...media }
    set({
      phase: 'inRoom',
      myRole: res.role,
      ...media,
      screen: false,
      peers: session.peers().map((p) => ({ ...p })),
      localStream: session.localStream(),
    })
  }

  private isCurrent(session: RoomSession, run: number): boolean {
    return this.session === session && this.epoch === run
  }

  private lost(session: RoomSession): void {
    session.disconnect()
    this.session = null
    set({ phase: 'connectionLost', reconnecting: false })
  }

  private wire(session: RoomSession): void {
    wireRoomSession(session, {
      isCurrent: () => this.session === session,
      onData: (topic, payload, from) => this.chat.onData(topic, payload, from),
      onClosed: (reason) => {
        this.session = null
        if (phaseAfterRoomClosed(reason) === 'connectionLost') set({ phase: 'connectionLost' })
        else void this.verifyClosed(this.epoch)
      },
    })
  }

  /** The server closed the room: ended for everyone, or just me out (→ left). */
  private async verifyClosed(run: number): Promise<void> {
    const ended = (await rereadMeeting(this.deps, this.meetingId))?.meeting.status === 'ENDED'
    if (run !== this.epoch) return
    if (ended) markMeetingEnded(this.deps, this.meetingId)
    set({ phase: ended ? 'ended' : 'left' })
  }


  /** `pagehide` while waiting: the request must outlive the page (keepalive). */
  leaveLobbyOnExit(): void {
    if (store().phase === 'waiting') this.deps.api.leaveLobbyOnExit(this.meetingId)
  }

  async cancelWaiting(): Promise<void> {
    this.epoch++
    try {
      await this.deps.api.leaveLobby(this.meetingId)
    } catch {
      // the lobby entry expires on its own
    }
    set({ phase: 'prejoin' })
  }

  /** NotesPanel hands over its save-now (null on unmount); leaving / ending calls it. */
  registerNotesFlush(flush: (() => Promise<void>) | null): void {
    this.notesFlush = flush
  }

  leave(): void {
    flushNotes(this.notesFlush)
    this.epoch++
    this.closeSession()
    set({ phase: 'left', pendingChat: [], screen: false, reconnecting: false })
  }

  async endForAll(): Promise<void> {
    flushNotes(this.notesFlush)
    try {
      await this.deps.api.end(this.meetingId)
    } catch (err) {
      this.deps.notify('error', meetingErrorKey(parseMeetingError(err)))
      return
    }
    markMeetingEnded(this.deps, this.meetingId)
    this.close('ended')
  }

  private close(phase: 'ended' | 'removed'): void {
    this.epoch++
    this.closeSession()
    set({ phase, pendingChat: [], screen: false, reconnecting: false })
  }

  private closeSession(): void {
    const session = this.session
    this.session = null
    session?.disconnect()
  }

  // ── Media ────────────────────────────────────────────────────────────────

  private async toggle(key: 'mic' | 'camera', apply: (s: RoomSession, on: boolean) => Promise<void>) {
    const session = this.session
    if (!session || store().phase !== 'inRoom') return
    const next = !store()[key]
    set({ [key]: next })
    try {
      await apply(session, next)
      if (this.session === session) this.media = { ...this.media, [key]: next }
    } catch {
      if (this.session === session) set({ [key]: !next })
      this.deps.notify('error', { key: 'mediaFailed' })
    }
  }

  toggleMic(): Promise<void> {
    return this.toggle('mic', (s, on) => s.setMic(on))
  }

  toggleCamera(): Promise<void> {
    return this.toggle('camera', (s, on) => s.setCamera(on))
  }

  async toggleScreenShare(): Promise<void> {
    const session = this.session
    if (!session || store().phase !== 'inRoom') return
    const next = !store().screen
    if (next && !canShareScreen(store().myRole, this.settings)) return
    set({ screen: next })
    try {
      await session.setScreenShare(next)
    } catch (err) {
      if (this.session === session) set({ screen: !next })
      if (!(err instanceof ScreenShareError)) this.deps.notify('error', { key: 'shareFailed' })
    }
  }

  async switchDevice(kind: 'audioinput' | 'videoinput', deviceId: string): Promise<void> {
    this.media = { ...this.media, [kind === 'audioinput' ? 'audioDeviceId' : 'videoDeviceId']: deviceId }
    try {
      await this.session?.switchDevice(kind, deviceId)
    } catch {
      this.deps.notify('error', { key: 'mediaFailed' })
    }
  }

  setPeerVideoEnabled(identity: string, enabled: boolean): void {
    this.session?.setPeerVideoEnabled(identity, enabled)
  }

  // ── Realtime commands ────────────────────────────────────────────────────

  private online(): boolean {
    if (this.deps.isRealtimeConnected()) return true
    this.deps.notify('error', { key: 'realtimeOffline' })
    return false
  }

  setHand(raised: boolean): void {
    if (this.online()) this.deps.publish('/app/meet.hand', { meetingId: this.meetingId, raised })
  }

  sendChat(content: string): string | null {
    return store().phase === 'inRoom' ? this.chat.send(content, MEETING_LIMITS.chat) : null
  }

  retryChat(clientId: string): void {
    this.chat.retry(clientId)
  }

  discardChat(clientId: string): void {
    this.chat.discard(clientId)
  }

  sendReaction(emoji: ReactionEmoji): boolean {
    return store().phase === 'inRoom' && this.chat.sendReaction(emoji)
  }

  hostCommand(action: HostAction, targetId?: string): void {
    if (!this.online()) return
    this.deps.publish('/app/meet.host', hostCommandBody(this.meetingId, action, targetId))
    if (SWITCH_ACTIONS.has(action)) set({ pendingHost: { ...store().pendingHost, [action]: this.deps.now() } })
  }

  admit(userId: string): Promise<void> {
    return answerLobby(this.deps, this.meetingId, userId, () => this.deps.api.admit(this.meetingId, userId))
  }

  deny(userId: string): Promise<void> {
    return answerLobby(this.deps, this.meetingId, userId, () => this.deps.api.deny(this.meetingId, userId))
  }

  // ── Events ───────────────────────────────────────────────────────────────

  /** Personal-queue events for this meeting (ActiveMeetingRoom). */
  handle(e: MeetingEvent): void {
    if (e.event === 'meet.muted') return this.onMuted(e.actor)
    if (e.event === 'meet.error') return this.onError(e)
    if (e.event === 'meet.chat') {
      appendOwnChat(this.deps, e) // my own line re-sent to me alone (an idempotent retry): never unread
      return this.chat.onEcho(e, false)
    }
    const next = phaseAfterPersonalEvent(store().phase, e)
    if (next === null) return
    if (next === 'rejoin') void this.rejoin()
    else if (next === 'removed' || next === 'ended') this.close(next)
    else set({ phase: next })
  }

  private onMuted(actor: MeetingPerson | undefined): void {
    this.media = { ...this.media, mic: false }
    if (store().phase === 'inRoom') set({ mic: false })
    this.deps.notify('info', mutedNotice(actor))
  }

  private onError(e: Extract<MeetingEvent, { event: 'meet.error' }>): void {
    if (e.clientId) return this.chat.fail(e.clientId, meetingEventErrorKey(e.errorCode, e.params, 'chat'))
    if (e.action) set({ pendingHost: withoutPending(store().pendingHost, e.action) })
    this.deps.notify('error', meetingEventErrorKey(e.errorCode, e.params))
  }

  onRoster(roster: RosterEntry[]): void {
    const change = roleChange(roster, this.myId, store().myRole)
    if (!change) return
    set({ myRole: change.role })
    if (change.lostLobby) this.deps.queryClient.setQueryData<LobbyEntry[]>(meetingKeys.lobby(this.meetingId), [])
    if (change.notice) this.deps.notify('info', change.notice)
  }

  onSettings(settings: MeetingSettings): void {
    this.settings = settings
    set({ pendingHost: {} })
    const s = store()
    if (s.screen && !canShareScreen(s.myRole, settings)) {
      set({ screen: false })
      void this.session?.setScreenShare(false).catch(() => undefined)
      this.deps.notify('info', { key: 'shareRevoked' })
    }
  }

  onChat(e: Extract<MeetingEvent, { event: 'meet.chat' }>): void {
    this.chat.onEcho(e)
  }

  onSharedNoteUpdated(version: number, updatedBy?: MeetingPerson): void {
    set({ sharedNoteRemote: updatedBy ? { version, updatedBy } : { version } })
  }

  onEnded(): void {
    if (store().phase !== 'ended') this.close('ended')
  }

  /** STOMP came back: re-ask while waiting (missed `meet.admitted`); in the room re-read and apply what changed. */
  async onRealtimeReconnected(): Promise<void> {
    const phase = store().phase
    if (phase === 'waiting') return this.enter(false, true)
    if (phase !== 'inRoom' && phase !== 'connecting') return
    const run = this.epoch
    const fresh = await rereadMeeting(this.deps, this.meetingId)
    if (run !== this.epoch) return
    if (fresh?.meeting.status === 'ENDED') {
      markMeetingEnded(this.deps, this.meetingId)
      return this.onEnded()
    }
    if (fresh) {
      this.onRoster(fresh.roster)
      this.onSettings(fresh.meeting.settings)
    }
    if (store().phase === 'inRoom' && isManager(store().myRole)) await rereadLobby(this.deps, this.meetingId)
  }
}
