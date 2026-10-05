import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { WebRTCSignal } from '@/lib/webrtc/call-manager'
import { useCallStore } from '@/lib/store/call.store'

type Translate = (key: string, values?: Record<string, string | number>) => string

/**
 * WebRTC call signaling on `/user/queue/webrtc`. Group signals carry a `callId`
 * and route into the mesh manager; legacy 1-on-1 signals (no callId) keep their
 * old path. (Moved verbatim out of use-realtime-notifications.ts.)
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

  // Legacy 1-on-1.
  if (signal.type === 'offer') {
    if (useCallStore.getState().status !== 'idle') return
    useCallStore.getState().setIncoming({
      peerId: signal.senderId ?? '',
      peerName: '',
      conversationId: signal.conversationId ?? '',
      sdp: signal.sdp ?? '',
      video: (signal.sdp ?? '').includes('m=video'),
    })
  } else {
    // Lazy-load the WebRTC module only when an active call needs it.
    void import('@/lib/webrtc/call-manager').then((m) => m.callManager.handleSignal(signal))
  }
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
