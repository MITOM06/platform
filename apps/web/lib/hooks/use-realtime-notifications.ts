'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/lib/store/auth.store'
import { useNotificationPrefs } from '@/lib/store/notification-prefs'
import { stompService } from '@/lib/stomp/client'
import type { WebRTCSignal } from '@/lib/webrtc/call-manager'
import { useCallStore } from '@/lib/store/call.store'
import { humanizeMessagePreview } from '@/lib/system-messages'

interface NotificationPayload {
  type: string
  conversationId: string
  senderName: string
  senderId?: string
  content?: string
  messageType?: string
}

// Owns the whole session-level STOMP realtime pipeline for the authenticated
// layout: notifications toast/OS-notification, WebRTC call signaling, and friend
// presence. Extracted from app/(main)/layout.tsx to keep that file under the
// 400-line limit; behaviour is identical to the inline version.
export function useRealtimeNotifications(): void {
  const router = useRouter()
  const queryClient = useQueryClient()
  // Depend on a STABLE boolean, not the token value: the token is rotated on
  // every ~15-min refresh (and on every 401-refresh), and a value dependency
  // here would tear down + rebuild the STOMP singleton on each rotation — a
  // realtime blip that can also kill WebRTC signaling mid-call. `beforeConnect`
  // already pulls the freshest token, so we only need to (re)connect when the
  // user transitions between authed / unauthed.
  const isAuthed = useAuthStore((s) => !!s.accessToken)
  const t = useTranslations('layout')
  const tChat = useTranslations('chat')

  useEffect(() => {
    const token = useAuthStore.getState().accessToken
    if (!token || stompService.isConnected()) return

    stompService.connect(token).then(() => {
      // NOTE: notification-permission prompting was moved to the post-login /
      // post-register success path (see lib/notifications.ts). It must NOT be
      // requested here — that fired on every authenticated session load.

      stompService.subscribe('/user/queue/notifications', (frame) => {
        try {
          const payload: NotificationPayload = JSON.parse(frame.body)
          // Backend sends RATE_LIMITED to /user/queue/notifications when the
          // message send-rate is exceeded (mirror of Flutter conversations_notifier).
          // Surface it as an error toast so the user knows their message was dropped.
          if (payload.type === 'RATE_LIMITED') {
            toast.error(t('rateLimitError'))
            return
          }
          if (payload.type !== 'NEW_MESSAGE' && payload.type !== 'MENTIONED_YOU') {
            return
          }
          // Refresh the sidebar (last-message preview, timestamp, unread badge)
          // for conversations that aren't currently open — the open one is kept
          // live by the thread's own STOMP subscription. This runs regardless of
          // the notification preference so unread counts stay correct when OFF.
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
          // App-level notification toggle (mirror Flutter notificationsEnabledProvider).
          // When OFF, keep unread counts live (above) but suppress the visible
          // OS notification and in-app toast.
          if (!useNotificationPrefs.getState().enabled) {
            return
          }
          // Don't notify for the conversation already open on screen.
          if (window.location.pathname === `/conversations/${payload.conversationId}`) {
            return
          }

          // Backend sends senderName: "system" (and a raw `system.*` content
          // code) for group system events. Never render either raw — show a
          // generic localized title and humanize the body (rule:
          // no-raw-system-data-in-ui).
          const isSystemEvent =
            payload.senderName === 'system' || (payload.content?.startsWith('system.') ?? false)
          const title = isSystemEvent
            ? t('notificationSystemTitle')
            : t('notificationTitle', { name: payload.senderName })
          const body = isSystemEvent
            ? payload.content
              ? humanizeMessagePreview(payload.content, payload.messageType, tChat, { short: true })
              : t('notificationFallback')
            : payload.messageType && payload.messageType !== 'text'
              ? t('notificationAttachment')
              : payload.content || t('notificationFallback')

          if (
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted' &&
            document.visibilityState === 'hidden'
          ) {
            // Tab in background → OS-level notification.
            const n = new Notification(title, { body })
            n.onclick = () => {
              window.focus()
              router.push(`/conversations/${payload.conversationId}`)
            }
          } else {
            // Tab visible → in-app toast so the user still sees it.
            toast(title, {
              description: body,
              action: {
                label: t('notificationOpen'),
                onClick: () => router.push(`/conversations/${payload.conversationId}`),
              },
            })
          }
        } catch {
          // ignore
        }
      })

      // WebRTC call signaling. Group signals carry a `callId` and route into the
      // mesh manager; legacy 1-on-1 signals (no callId) keep their old path.
      stompService.subscribe('/user/queue/webrtc', (frame) => {
        try {
          const signal: WebRTCSignal = JSON.parse(frame.body)

          // ── Caller is blocked by the callee — show error toast and abort ───
          if (signal.type === 'call-blocked') {
            toast.error(tChat('callBlocked'))
            // Reset call state without sending a signal to the other side
            // (there is no active call session to clean up peer-to-peer).
            useCallStore.getState().reset()
            return
          }

          // ── Group call ring → open the incoming-group-call prompt ───────────
          if (signal.type === 'call-ring') {
            // Ignore a ring while already in any call.
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

          // ── Mesh signaling (offer/answer/ice with a callId) ─────────────────
          if (signal.callId) {
            void import('@/lib/webrtc/group-call-manager').then((m) =>
              m.groupCallManager.handleSignal(signal),
            )
            return
          }

          // ── Legacy 1-on-1 ───────────────────────────────────────────────────
          if (signal.type === 'offer') {
            // Ignore a second offer while already in a call.
            if (useCallStore.getState().status !== 'idle') return
            useCallStore.getState().setIncoming({
              peerId: signal.senderId ?? '',
              peerName: '',
              conversationId: signal.conversationId ?? '',
              sdp: signal.sdp ?? '',
              video: (signal.sdp ?? '').includes('m=video'),
            })
          } else {
            // Lazy-load the WebRTC module only when an active call needs it —
            // keeps RTCPeerConnection code out of the initial layout bundle.
            void import('@/lib/webrtc/call-manager').then((m) =>
              m.callManager.handleSignal(signal),
            )
          }
        } catch {
          // ignore
        }
      })

      // Real-time friend presence — mirror Flutter friends_provider.dart.
      // Offline → remove immediately; Online → debounce + re-fetch (burst protection).
      let presenceDebounce: ReturnType<typeof setTimeout> | null = null
      stompService.subscribe('/topic/presence', (frame) => {
        try {
          const { userId, online } = JSON.parse(frame.body) as { userId: string; online: boolean }
          if (online) {
            if (presenceDebounce) clearTimeout(presenceDebounce)
            presenceDebounce = setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['onlineFriends'] })
            }, 400)
          } else {
            queryClient.setQueryData<{ id?: string; _id?: string }[]>(['onlineFriends'], (prev) =>
              prev ? prev.filter((u) => (u.id ?? u._id) !== userId) : prev,
            )
          }
        } catch {
          // ignore
        }
      })
    }).catch(() => {
      toast.error(t('realtimeError'))
    })

    return () => {
      stompService.disconnect()
    }
    // `router` from next/navigation is stable; only (dis)connect on the
    // authed↔unauthed transition — NOT on token rotation (see isAuthed above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed])
}
