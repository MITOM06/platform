import { create } from 'zustand'
import type { HostAction, MeetingAttachment, MeetingRoomRole, ReactionEmoji } from '@/lib/api/meeting-types'
import type { MessageKey } from '@/lib/meetings/meeting-errors'
import type { AiErrorKey, PendingAi } from '@/lib/meetings/pending-ai'
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
  /** Kept so a retry re-sends the file and the optimistic line shows its card. */
  attachment?: MeetingAttachment
  sentAt: number
  error: MessageKey | null
}

/** A local, non-persisted notice line in the chat: my `@AI` question got no answer. */
export interface AiNotice {
  id: number
  key: AiErrorKey
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
  /** `@AI` questions in the room still unanswered (lib/meetings/pending-ai.ts). */
  pendingAi: PendingAi[]
  aiNotices: AiNotice[]
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
  pendingAi: [],
  aiNotices: [],
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
