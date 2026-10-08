import { create } from 'zustand'
import type { CallMedia, CallParticipant, CallTransport } from '@/lib/api/types'

export type CallStatus = 'idle' | 'incoming' | 'outgoing' | 'connected'

/** Incoming group-call ring (Track A §3, `type:'call-ring'`). */
export interface IncomingGroupCall {
  callId: string
  conversationId: string
  startedBy: string
  startedByName: string
  media: CallMedia
  aiNotetaker: boolean
  /** Media path of the call (absent from older servers = mesh). */
  transport?: CallTransport
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
  /** Media path of this call: mesh (P2P) or sfu (LiveKit). */
  transport: CallTransport
  /** sfu only: the server's call id (mesh 1-on-1 calls have none). */
  callId: string | null
  /** sfu: LiveKit is re-establishing the connection. */
  reconnecting: boolean
  /** Our own connection is poor (sfu: LiveKit's measure; mesh: see call-network.ts). */
  poorConnection: boolean
  /** The other person's connection is poor. */
  peerPoor: boolean
  /** The other person's camera is on (Messenger-style: video while either is). */
  peerCamera: boolean
  /** Our camera could not be sent (the other side's app cannot take video mid-call). */
  videoUnavailable: boolean
  /** Someone dropped: whose connection the call is waiting for, until `reconnectDeadline`. */
  reconnectWait: 'self' | 'peer' | null
  /** Epoch ms when the reconnect window ends the call. */
  reconnectDeadline: number | null

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
  /** Media path of the current group call. */
  groupTransport: CallTransport
  /** sfu: identities currently speaking (active-speaker ring). */
  speakingIds: string[]

  // ── 1-on-1 actions ──────────────────────────────────────────────────────────
  setIncoming: (p: {
    peerId: string
    peerName: string
    conversationId: string
    /** mesh: the offer SDP. sfu rings carry no SDP. */
    sdp?: string
    video: boolean
    callId?: string
    transport?: CallTransport
  }) => void
  setOutgoing: (p: {
    peerId: string
    peerName: string
    conversationId: string
    video: boolean
    transport?: CallTransport
  }) => void
  setCallId: (callId: string) => void
  setReconnecting: (on: boolean) => void
  setPoorConnection: (on: boolean) => void
  setPeerPoor: (on: boolean) => void
  setPeerCamera: (on: boolean) => void
  setVideoUnavailable: (on: boolean) => void
  setReconnectWait: (who: 'self' | 'peer' | null, deadline: number | null) => void
  setPeerName: (name: string) => void
  setConnected: () => void
  setDuration: (s: number) => void
  setMic: (on: boolean) => void
  setCamera: (on: boolean) => void
  reset: () => void

  // ── Group actions ─────────────────────────────────────────────────────────
  startGroupCall: (p: {
    callId: string
    conversationId: string
    media: CallMedia
    aiNotetaker: boolean
    transport?: CallTransport
  }) => void
  setSpeaking: (ids: string[]) => void
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
  transport: 'mesh' as CallTransport,
  callId: null as string | null,
  reconnecting: false,
  poorConnection: false,
  peerPoor: false,
  peerCamera: false,
  videoUnavailable: false,
  reconnectWait: null as 'self' | 'peer' | null,
  reconnectDeadline: null as number | null,
}

const initialGroup = {
  groupCallId: null,
  groupConversationId: null,
  groupMedia: 'video' as CallMedia,
  groupAiNotetaker: false,
  groupActive: false,
  roster: [] as CallParticipant[],
  streamsVersion: 0,
  incomingGroupCall: null as IncomingGroupCall | null,
  groupTransport: 'mesh' as CallTransport,
  speakingIds: [] as string[],
}

/** A new 1-on-1: cameras follow the call kind, nothing is poor or waiting yet. */
function callMedia(video: boolean) {
  return {
    video,
    cameraEnabled: video,
    peerCamera: video,
    reconnecting: false,
    poorConnection: false,
    peerPoor: false,
    videoUnavailable: false,
    reconnectWait: null,
    reconnectDeadline: null,
  }
}

export const useCallStore = create<CallState>((set) => ({
  ...initial,
  ...initialGroup,

  // 1-on-1
  setIncoming: ({ peerId, peerName, conversationId, sdp, video, callId, transport }) =>
    set({
      status: 'incoming',
      peerId,
      peerName,
      conversationId,
      pendingOfferSdp: sdp ?? null,
      callId: callId ?? null,
      transport: transport ?? 'mesh',
      ...callMedia(video),
    }),
  setOutgoing: ({ peerId, peerName, conversationId, video, transport }) =>
    set({
      status: 'outgoing',
      peerId,
      peerName,
      conversationId,
      pendingOfferSdp: null,
      callId: null,
      transport: transport ?? 'mesh',
      ...callMedia(video),
    }),
  setCallId: (callId) => set({ callId }),
  setReconnecting: (reconnecting) => set({ reconnecting }),
  setPoorConnection: (poorConnection) => set({ poorConnection }),
  setPeerPoor: (peerPoor) => set({ peerPoor }),
  setPeerCamera: (peerCamera) => set({ peerCamera }),
  setVideoUnavailable: (videoUnavailable) => set({ videoUnavailable }),
  setReconnectWait: (reconnectWait, reconnectDeadline) => set({ reconnectWait, reconnectDeadline }),
  setPeerName: (peerName) => set({ peerName }),
  // A mid-call renegotiation or reconnect must not restart the call timer.
  setConnected: () => set((s) => (s.status === 'connected' ? s : { status: 'connected', durationSeconds: 0 })),
  setDuration: (s) => set({ durationSeconds: s }),
  setMic: (on) => set({ micEnabled: on }),
  setCamera: (on) => set({ cameraEnabled: on }),
  reset: () => set({ ...initial }),

  // group
  startGroupCall: ({ callId, conversationId, media, aiNotetaker, transport }) =>
    set({
      groupTransport: transport ?? 'mesh',
      speakingIds: [],
      reconnecting: false,
      poorConnection: false,
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
  setSpeaking: (speakingIds) => set({ speakingIds }),
  resetGroup: () => set({ ...initialGroup }),
}))
