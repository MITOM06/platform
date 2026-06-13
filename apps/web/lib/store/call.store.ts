import { create } from 'zustand'

export type CallStatus = 'idle' | 'incoming' | 'outgoing' | 'connected'

interface CallState {
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

  setIncoming: (p: { peerId: string; peerName: string; conversationId: string; sdp: string; video: boolean }) => void
  setOutgoing: (p: { peerId: string; peerName: string; conversationId: string; video: boolean }) => void
  setConnected: () => void
  setDuration: (s: number) => void
  setMic: (on: boolean) => void
  setCamera: (on: boolean) => void
  reset: () => void
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

export const useCallStore = create<CallState>((set) => ({
  ...initial,
  setIncoming: ({ peerId, peerName, conversationId, sdp, video }) =>
    set({ status: 'incoming', peerId, peerName, conversationId, pendingOfferSdp: sdp, video }),
  setOutgoing: ({ peerId, peerName, conversationId, video }) =>
    set({ status: 'outgoing', peerId, peerName, conversationId, pendingOfferSdp: null, video }),
  setConnected: () => set({ status: 'connected', durationSeconds: 0 }),
  setDuration: (s) => set({ durationSeconds: s }),
  setMic: (on) => set({ micEnabled: on }),
  setCamera: (on) => set({ cameraEnabled: on }),
  reset: () => set({ ...initial }),
}))
