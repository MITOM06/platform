import type { MeetingEvent, ReactionEmoji } from '@/lib/api/meeting-types'
import { safeDisplayName } from '@/lib/chat/names'
import type { RemotePeer } from '@/lib/rtc/livekit-session'
import { useMeetingRoomStore, type FloatingReaction, type PendingChat } from '@/lib/store/meeting.store'
import type { MessageKey } from './meeting-errors'
import { REACTION_TOPIC, createReactionThrottle, decodeReaction, encodeReaction } from './reactions'

/**
 * The chatty half of MeetingRoomController: optimistic chat lines (matched to
 * their echo by `clientId`) and peer-to-peer reactions. Writes meeting.store only.
 */

interface ChatDeps {
  publish(destination: string, body: object): void
  isRealtimeConnected(): boolean
  now(): number
  newClientId(): string
  notify(level: 'info' | 'error', msg: MessageKey): void
}

interface DataSession {
  publishData(topic: string, payload: Uint8Array, reliable: boolean): void
  peers(): RemotePeer[]
}

/** Reactions on screen at once; older ones are dropped first. */
const MAX_REACTIONS = 30
export const REACTION_LIFETIME_MS = 4000

const store = () => useMeetingRoomStore.getState()
const setPending = (fn: (list: PendingChat[]) => PendingChat[]) =>
  useMeetingRoomStore.setState((s) => ({ pendingChat: fn(s.pendingChat) }))

export class MeetingRoomChat {
  private readonly allowReaction = createReactionThrottle()
  private readonly timers = new Set<ReturnType<typeof setTimeout>>()
  private nextReactionId = 1

  constructor(
    private readonly meetingId: string,
    private readonly myId: string,
    private readonly deps: ChatDeps,
    private readonly session: () => DataSession | null,
  ) {}

  /** Returns the clientId, or null when the line cannot be sent (empty, too long, offline). */
  send(content: string, max: number): string | null {
    const text = content.trim()
    if (!text || text.length > max || !this.deps.isRealtimeConnected()) return null
    const clientId = this.deps.newClientId()
    this.deps.publish('/app/meet.chat', { meetingId: this.meetingId, content: text, clientId })
    setPending((list) => [...list, { clientId, content: text, sentAt: this.deps.now(), error: null }])
    return clientId
  }

  retry(clientId: string): void {
    const line = store().pendingChat.find((p) => p.clientId === clientId)
    if (!line) return
    if (!this.deps.isRealtimeConnected()) {
      this.deps.notify('error', { key: 'realtimeOffline' })
      return
    }
    this.deps.publish('/app/meet.chat', { meetingId: this.meetingId, content: line.content, clientId })
    setPending((list) =>
      list.map((p) => (p.clientId === clientId ? { ...p, sentAt: this.deps.now(), error: null } : p)),
    )
  }

  discard(clientId: string): void {
    setPending((list) => list.filter((p) => p.clientId !== clientId))
  }

  /** `meet.error` for one of my lines. */
  fail(clientId: string, error: MessageKey): void {
    setPending((list) => list.map((p) => (p.clientId === clientId ? { ...p, error } : p)))
  }

  /** `meet.chat` echo: settles my pending line; counts others' lines while the panel is closed. */
  onEcho(e: Extract<MeetingEvent, { event: 'meet.chat' }>): void {
    if (e.clientId) this.discard(e.clientId)
    if (e.message.sender.userId !== this.myId && store().panel !== 'chat') {
      useMeetingRoomStore.setState((s) => ({ unreadChat: s.unreadChat + 1 }))
    }
  }

  sendReaction(emoji: ReactionEmoji): boolean {
    const session = this.session()
    if (!session || !this.allowReaction(this.deps.now())) return false
    session.publishData(REACTION_TOPIC, encodeReaction(emoji), false)
    this.show({ emoji, mine: true })
    return true
  }

  /** Data channel payloads from peers — untrusted: only the six emoji pass. */
  onData(topic: string, payload: Uint8Array, from: string | null): void {
    if (topic !== REACTION_TOPIC) return
    const emoji = decodeReaction(payload)
    if (!emoji) return
    const peer = from ? this.session()?.peers().find((p) => p.identity === from) : undefined
    const name = safeDisplayName(peer?.name, from)
    this.show(name ? { emoji, name, mine: false } : { emoji, mine: false })
  }

  private show(r: Omit<FloatingReaction, 'id'>): void {
    const id = this.nextReactionId++
    useMeetingRoomStore.setState((s) => ({ reactions: [...s.reactions, { ...r, id }].slice(-MAX_REACTIONS) }))
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      useMeetingRoomStore.setState((s) => ({ reactions: s.reactions.filter((x) => x.id !== id) }))
    }, REACTION_LIFETIME_MS)
    this.timers.add(timer)
  }

  dispose(): void {
    this.timers.forEach((t) => clearTimeout(t))
    this.timers.clear()
  }
}
