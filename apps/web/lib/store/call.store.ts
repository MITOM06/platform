import { create } from 'zustand'
import type { CallMedia, CallParticipant } from '@/lib/api/types'

export type CallStatus = 'idle' | 'incoming' | 'outgoing' | 'connected'

/** Incoming group-call ring (Track A §3, `type:'call-ring'`). */
export interface IncomingGroupCall {
  callId: string
  conversationId: string
  startedBy: string
  startedByName: string
  media: CallMedia
  aiNotetaker: boolean
}

interface CallState {
  // ── 1-on-1 legacy call (no callId) ─────────────────────────────────────────
  status: CallStatus
  /** The other party's user id (who we signal to). */
  peerId: string | null
  peerName: string
  conversationId: string | null
  /** SDP of an incoming offer, kept until the user accepts. */
  pendingOfferSdp: string | null
  /** Seconds elapsed once connected (driven by CallOverlay timer). */
  durationSeconds: number
  micEnabled: boolean
  cameraEnabled: boolean
  /** True = two-way video call; false = audio-only voice call. */
  video: boolean

  // ── Group call (mesh) ───────────────────────────────────────────────────────
  /** Non-null while the local user is in a group call. */
  groupCallId: string | null
  groupConversationId: string | null
  groupMedia: CallMedia
  groupAiNotetaker: boolean
  /** True once at least one remote peer is connected. */
  groupActive: boolean
  /** Live roster from `call.roster` (joined + left). */
  roster: CallParticipant[]
  /** Tick incremented whenever a remote stream is added/removed so subscribers re-render. */
  streamsVersion: number
  /** Incoming group-call ring awaiting accept/decline. */
  incomingGroupCall: IncomingGroupCall | null

  // ── 1-on-1 actions ──────────────────────────────────────────────────────────
  setIncoming: (p: { peerId: string; peerName: string; conversationId: string; sdp: string; video: boolean }) => void
  setOutgoing: (p: { peerId: string; peerName: string; conversationId: string; video: boolean }) => void
  setConnected: () => void
  setDuration: (s: number) => void
  setMic: (on: boolean) => void
  setCamera: (on: boolean) => void
  reset: () => void

  // ── Group actions ─────────────────────────────────────────────────────────
  startGroupCall: (p: { callId: string; conversationId: string; media: CallMedia; aiNotetaker: boolean }) => void
  setGroupActive: () => void
  setRoster: (participants: CallParticipant[]) => void
  setAiNotetaker: (on: boolean) => void
  bumpStreams: () => void
  setIncomingGroupCall: (call: IncomingGroupCall | null) => void
  resetGroup: () => void
}

const initial = {
  status: 'idle' as CallStatus,
  peerId: null,
  peerName: '',
  conversationId: null,
  pendingOfferSdp: null,
  durationSeconds: 0,
  micEnabled: true,
  cameraEnabled: true,
  video: true,
}

const initialGroup = {
  groupCallId: null,
  groupConversationId: null,
  groupMedia: 'video' as CallMedia,
  groupAiNotetaker: false,
  groupActive: false,
  roster: [] as CallParticipant[],
  streamsVersion: 0,
  incomingGroupCall: null,
}

export const useCallStore = create<CallState>((set) => ({
  ...initial,
  ...initialGroup,

  // 1-on-1
  setIncoming: ({ peerId, peerName, conversationId, sdp, video }) =>
    set({ status: 'incoming', peerId, peerName, conversationId, pendingOfferSdp: sdp, video }),
  setOutgoing: ({ peerId, peerName, conversationId, video }) =>
    set({ status: 'outgoing', peerId, peerName, conversationId, pendingOfferSdp: null, video }),
  setConnected: () => set({ status: 'connected', durationSeconds: 0 }),
  setDuration: (s) => set({ durationSeconds: s }),
  setMic: (on) => set({ micEnabled: on }),
  setCamera: (on) => set({ cameraEnabled: on }),
  reset: () => set({ ...initial }),

  // group
  startGroupCall: ({ callId, conversationId, media, aiNotetaker }) =>
    set({
      groupCallId: callId,
      groupConversationId: conversationId,
      groupMedia: media,
      groupAiNotetaker: aiNotetaker,
      groupActive: false,
      roster: [],
      streamsVersion: 0,
      durationSeconds: 0,
      micEnabled: true,
      cameraEnabled: media === 'video',
      incomingGroupCall: null,
    }),
  setGroupActive: () => set((s) => (s.groupActive ? s : { groupActive: true, durationSeconds: 0 })),
  setRoster: (participants) => set({ roster: participants }),
  setAiNotetaker: (on) => set({ groupAiNotetaker: on }),
  bumpStreams: () => set((s) => ({ streamsVersion: s.streamsVersion + 1 })),
  setIncomingGroupCall: (call) => set({ incomingGroupCall: call }),
  resetGroup: () => set({ ...initialGroup }),
}))
