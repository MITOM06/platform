import { create } from 'zustand'
import type { HostAction, MeetingRoomRole, ReactionEmoji } from '@/lib/api/meeting-types'
import type { MessageKey } from '@/lib/meetings/meeting-errors'
import type { RemoteNewer } from '@/lib/meetings/note-sync'
import type { RoomPhase } from '@/lib/meetings/room-phase'
import type { LayoutMode } from '@/lib/meetings/stage-layout'
import type { RemotePeer } from '@/lib/rtc/livekit-session'

/**
 * UI state of the open meeting room — only what the server does not keep.
 * Roster, hands, lobby, chat history and notes live in TanStack Query
 * (lib/hooks/use-meetings.ts); MeetingRoomController writes most of this.
 */

export type RoomPanel = 'people' | 'chat' | 'notes' | null

/** A chat line sent but not yet echoed back by the server. */
export interface PendingChat {
  clientId: string
  content: string
  sentAt: number
  error: MessageKey | null
}

export interface FloatingReaction {
  id: number
  emoji: ReactionEmoji
  /** Already safe for display (never an id); absent ⇒ generic label. */
  name?: string
  mine: boolean
}

export interface MeetingRoomData {
  meetingId: string | null
  phase: RoomPhase
  myRole: MeetingRoomRole
  mic: boolean
  camera: boolean
  screen: boolean
  reconnecting: boolean
  poorConnection: boolean
  peers: RemotePeer[]
  localStream: MediaStream | null
  localScreen: MediaStream | null
  /** Sticky: the last remote person who spoke. */
  activeSpeakerId: string | null
  layout: LayoutMode
  pinnedKey: string | null
  panel: RoomPanel
  unreadChat: number
  pendingChat: PendingChat[]
  /** Switch commands sent and not yet confirmed by `meet.settings` (action → sentAt). */
  pendingHost: Partial<Record<HostAction, number>>
  reactions: FloatingReaction[]
  sharedNoteRemote: RemoteNewer | null
  audioOutputId: string | undefined
}

export interface MeetingRoomState extends MeetingRoomData {
  reset(): void
  /** Opening the chat clears the unread count. */
  setPanel(panel: RoomPanel): void
  setLayout(layout: LayoutMode): void
  /** Pinning the pinned tile again unpins it. */
  togglePin(key: string): void
  setAudioOutput(id: string | undefined): void
}

export const initialMeetingRoomData: MeetingRoomData = {
  meetingId: null,
  phase: 'loading',
  myRole: 'attendee',
  mic: false,
  camera: false,
  screen: false,
  reconnecting: false,
  poorConnection: false,
  peers: [],
  localStream: null,
  localScreen: null,
  activeSpeakerId: null,
  layout: 'grid',
  pinnedKey: null,
  panel: null,
  unreadChat: 0,
  pendingChat: [],
  pendingHost: {},
  reactions: [],
  sharedNoteRemote: null,
  audioOutputId: undefined,
}

export const useMeetingRoomStore = create<MeetingRoomState>()((set) => ({
  ...initialMeetingRoomData,
  reset: () => set({ ...initialMeetingRoomData }),
  setPanel: (panel) => set(panel === 'chat' ? { panel, unreadChat: 0 } : { panel }),
  setLayout: (layout) => set({ layout }),
  togglePin: (key) => set((s) => ({ pinnedKey: s.pinnedKey === key ? null : key })),
  setAudioOutput: (audioOutputId) => set({ audioOutputId }),
}))
