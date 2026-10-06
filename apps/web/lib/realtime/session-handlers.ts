import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { WebRTCSignal } from '@/lib/webrtc/call-manager'
import { useCallStore } from '@/lib/store/call.store'

type Translate = (key: string, values?: Record<string, string | number>) => string

/**
 * WebRTC call signaling on `/user/queue/webrtc`. LiveKit (sfu) call control goes
 * to the call manager, group signals carry a `callId` and route into the mesh
 * manager, legacy 1-on-1 signals (no callId) go to the call manager.
 */
export function handleWebRtcFrame(body: string, tChat: Translate): void {
  let signal: WebRTCSignal
  try {
    signal = JSON.parse(body) as WebRTCSignal
  } catch {
    return
  }

  // Caller is blocked by the callee — show error toast and abort. Reset call
  // state without sending a signal (there is no peer session to clean up).
  if (signal.type === 'call-blocked') {
    toast.error(tChat('callBlocked'))
    useCallStore.getState().reset()
    return
  }

  // LiveKit (sfu) call control: a 1-on-1 ring, ring cancels, declines.
  if (signal.type === 'call-ring' && signal.transport === 'sfu' && signal.kind === 'direct') {
    void import('@/lib/webrtc/call-manager').then((m) => m.callManager.handleSignal(signal))
    return
  }
  if (signal.type === 'call-ring-cancel') {
    const st = useCallStore.getState()
    if (st.incomingGroupCall?.callId === signal.callId) st.setIncomingGroupCall(null)
    else void import('@/lib/webrtc/call-manager').then((m) => m.callManager.handleSignal(signal))
    return
  }
  if (signal.type === 'call-declined') {
    void import('@/lib/webrtc/call-manager').then((m) => m.callManager.handleSignal(signal))
    return
  }

  // A 1-on-1 only rings through call-ring on sfu; a mesh "direct" ring is a
  // stray session from a caller with a stale transport (it cancels itself).
  if (signal.type === 'call-ring' && signal.kind === 'direct') return

  // Group call ring → open the incoming-group-call prompt (ignored while in a call).
  if (signal.type === 'call-ring') {
    const st = useCallStore.getState()
    if (st.groupCallId || st.status !== 'idle') return
    st.setIncomingGroupCall({
      callId: signal.callId ?? '',
      conversationId: signal.conversationId ?? '',
      startedBy: signal.senderId ?? '',
      startedByName: signal.startedByName ?? '',
      media: signal.media ?? 'video',
      aiNotetaker: signal.aiNotetaker ?? false,
      transport: signal.transport,
    })
    return
  }

  // Mesh signaling (offer/answer/ice with a callId).
  if (signal.callId) {
    void import('@/lib/webrtc/group-call-manager').then((m) =>
      m.groupCallManager.handleSignal(signal),
    )
    return
  }

  // Legacy 1-on-1 (offer / answer / ice / end). callManager owns ringing, busy
  // replies and the early-ICE buffer. Lazy-loaded so RTCPeerConnection code stays
  // out of the initial layout bundle; successive signals stay in order because
  // they all chain on the same import() promise.
  void import('@/lib/webrtc/call-manager').then((m) => m.callManager.handleSignal(signal))
}

/**
 * Real-time friend presence on `/topic/presence` — mirror Flutter
 * friends_provider.dart. Offline → remove immediately; online → debounce + refetch.
 */
export function createPresenceHandler(queryClient: QueryClient): {
  handle: (body: string) => void
  dispose: () => void
} {
  let debounce: ReturnType<typeof setTimeout> | null = null
  return {
    handle(body: string) {
      try {
        const { userId, online } = JSON.parse(body) as { userId: string; online: boolean }
        if (online) {
          if (debounce) clearTimeout(debounce)
          debounce = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['onlineFriends'] })
          }, 400)
        } else {
          queryClient.setQueryData<{ id?: string; _id?: string }[]>(['onlineFriends'], (prev) =>
            prev ? prev.filter((u) => (u.id ?? u._id) !== userId) : prev,
          )
        }
      } catch {
        // ignore malformed frames
      }
    },
    dispose() {
      if (debounce) clearTimeout(debounce)
      debounce = null
    },
  }
}
