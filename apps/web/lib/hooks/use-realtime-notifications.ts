'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useLocale, useTranslations } from 'next-intl'
import { useAuthStore } from '@/lib/store/auth.store'
import { useNotificationPrefs } from '@/lib/store/notification-prefs'
import { stompService } from '@/lib/stomp/client'
import { refreshClaims } from '@/lib/realtime/claims'
import { CONVERSATIONS_KEY } from '@/lib/realtime/conversation-cache'
import { createPresenceHandler, handleWebRtcFrame } from '@/lib/realtime/session-handlers'
import { presentNotice } from '@/lib/realtime/present-notice'
import { handleMeetingQueueEvent, type MeetingQueueContext } from '@/lib/realtime/meeting-queue'
import { parseMeetingEvent } from '@/lib/meetings/meeting-events'
import { getActiveMeetingRoom } from '@/lib/meetings/active-room'
import {
  handleUserQueueEvent,
  parseUserQueueEvent,
  type IncomingNotification,
  type UserQueueContext,
} from '@/lib/realtime/user-queue'

const conversationPath = (id: string) => `/conversations/${id}`

// Owns the whole session-level STOMP realtime pipeline for the authenticated
// layout: user-queue events (message banners, per-user CONVERSATION_UPDATED,
// MESSAGE_REJECTED, CLAIMS_CHANGED), WebRTC call signaling and friend presence.
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
  const currentUserId = useAuthStore((s) => s.user?.id)
  const t = useTranslations('layout')
  const tChat = useTranslations('chat')
  const tMeeting = useTranslations('meeting')
  const locale = useLocale()

  // Latest context for the durable subscriptions, which are registered once per
  // session and must never run with stale closures (translations, user id…).
  const contextRef = useRef<UserQueueContext | null>(null)
  const meetingCtxRef = useRef<MeetingQueueContext | null>(null)
  useEffect(() => {
    // Tab in background → OS-level notification; visible → in-app toast.
    const showNotification = ({ conversationId, title, body }: IncomingNotification) =>
      presentNotice(title, body, () => router.push(conversationPath(conversationId)), t('notificationOpen'))
    contextRef.current = {
      queryClient,
      currentUserId,
      t,
      tChat,
      notificationsEnabled: () => useNotificationPrefs.getState().enabled,
      isViewingConversation: (id) => window.location.pathname === conversationPath(id),
      showNotification,
      showError: (message) => toast.error(message),
      onRemovedFromConversation: (id) => {
        if (window.location.pathname !== conversationPath(id)) return
        toast.info(tChat('removedFromConversation'), { id: `removed-${id}` })
        router.replace('/conversations')
      },
      onClaimsChanged: () => void refreshClaims(queryClient),
    }
    meetingCtxRef.current = {
      queryClient,
      t: tMeeting,
      locale,
      now: () => new Date(),
      notificationsEnabled: () => useNotificationPrefs.getState().enabled,
      notify: ({ title, body, href }) =>
        presentNotice(title, body, () => router.push(href), tMeeting('notifOpen')),
      toastInfo: (message) => toast.info(message),
      activeRoom: getActiveMeetingRoom,
    }
  })

  // Connection lifecycle: connect on the unauthed → authed transition only.
  useEffect(() => {
    const token = useAuthStore.getState().accessToken
    if (!token) return
    if (!stompService.isConnected()) {
      // NOTE: notification-permission prompting lives on the post-login success
      // path (lib/notifications.ts) — never here, it would fire on every load.
      stompService.connect(token).catch(() => toast.error(t('realtimeError')))
    }
    return () => {
      stompService.disconnect()
    }
    // `t` is read once for the error toast; only (dis)connect on the
    // authed↔unauthed transition — NOT on token rotation (see isAuthed above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed])

  // Session subscriptions. Durable: the STOMP client re-attaches them after every
  // reconnect — they used to be subscribed once in `connect().then`, so the first
  // dropped socket silently ended notifications, previews and incoming calls.
  useEffect(() => {
    if (!isAuthed) return
    const presence = createPresenceHandler(queryClient)
    const offNotifications = stompService.subscribeDurable('/user/queue/notifications', (frame) => {
      const event = parseUserQueueEvent(frame.body)
      const ctx = contextRef.current
      if (event && ctx) handleUserQueueEvent(event, ctx)
    })
    // Meeting invitations, reminders, cancellations and room events (lobby, admitted…).
    const offMeeting = stompService.subscribeDurable('/user/queue/meeting', (frame) => {
      const event = parseMeetingEvent(frame.body)
      const mctx = meetingCtxRef.current
      if (event && mctx) handleMeetingQueueEvent(event, mctx)
    })
    const offWebRtc = stompService.subscribeDurable('/user/queue/webrtc', (frame) => {
      const ctx = contextRef.current
      if (ctx) handleWebRtcFrame(frame.body, ctx.tChat)
    })
    const offPresence = stompService.subscribeDurable('/topic/presence', (frame) =>
      presence.handle(frame.body),
    )

    // After a reconnect, catch the sidebar up on whatever happened while the
    // socket was down (new chats, previews, unread counts, notifications).
    // The first connect is not a gap — the initial queries are already loading.
    let wasConnected = stompService.isConnected()
    let connectedBefore = wasConnected
    // Which media path new calls take (mesh / LiveKit) — re-read on every
    // (re)connect, so a server switching CALL_TRANSPORT is picked up after its
    // restart.
    const refreshTransport = () =>
      void import('@/lib/webrtc/call-transport').then((m) => m.refreshCallTransport())
    if (wasConnected) refreshTransport()
    const offState = stompService.onStateChange((connected) => {
      if (connected) refreshTransport()
      if (connected && !wasConnected && connectedBefore) {
        queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      }
      if (connected) connectedBefore = true
      wasConnected = connected
    })

    return () => {
      offState()
      offNotifications()
      offMeeting()
      offWebRtc()
      offPresence()
      presence.dispose()
    }
  }, [isAuthed, queryClient])
}
