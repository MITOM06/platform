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

  setIncoming: (p: { peerId: string; peerName: string; conversationId: string; sdp: string }) => void
  setOutgoing: (p: { peerId: string; peerName: string; conversationId: string }) => void
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
}

export const useCallStore = create<CallState>((set) => ({
  ...initial,
  setIncoming: ({ peerId, peerName, conversationId, sdp }) =>
    set({ status: 'incoming', peerId, peerName, conversationId, pendingOfferSdp: sdp }),
  setOutgoing: ({ peerId, peerName, conversationId }) =>
    set({ status: 'outgoing', peerId, peerName, conversationId, pendingOfferSdp: null }),
  setConnected: () => set({ status: 'connected', durationSeconds: 0 }),
  setDuration: (s) => set({ durationSeconds: s }),
  setMic: (on) => set({ micEnabled: on }),
  setCamera: (on) => set({ cameraEnabled: on }),
  reset: () => set({ ...initial }),
}))
