'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { Compass, Contact, Plus, MessageSquarePlus, Users } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/lib/store/auth.store'
import { useNotificationPrefs } from '@/lib/store/notification-prefs'
import { Button } from '@/components/ui/button'
import { stompService } from '@/lib/stomp/client'
import type { WebRTCSignal } from '@/lib/webrtc/call-manager'
import { useCallStore } from '@/lib/store/call.store'
import { ConversationList } from '@/components/chat/ConversationList'
import { ActiveFriendsRow } from '@/components/chat/ActiveFriendsRow'
import { AssistantEntry } from '@/components/chat/AssistantEntry'
import { cn } from '@/lib/utils'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { SidebarProfileBar } from '@/components/layout/SidebarProfileBar'
import { SidebarAiHubButton } from '@/components/layout/SidebarAiHubButton'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { useUiStore } from '@/lib/store/ui.store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Code-split the WebRTC call UI (CallOverlay → Voice/VideoCallModal →
// call-manager → RTCPeerConnection). It renders nothing until a call starts,
// so it must NOT ship in the initial authenticated bundle. ssr:false because
// it relies on browser-only WebRTC/media APIs.
const CallOverlay = dynamic(
  () => import('@/components/call/CallOverlay').then((m) => m.CallOverlay),
  { ssr: false },
)

function PonLogo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="ponGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6AC9FF" />
          <stop offset="50%" stopColor="#FBB68B" />
          <stop offset="100%" stopColor="#FF85B3" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 14.52 2.93 16.82 4.46 18.6L3 21L5.8 20.3C7.54 21.37 9.6 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18Z"
        fill="url(#ponGradient)"
      />
      <circle cx="12" cy="12" r="3" fill="url(#ponGradient)" />
    </svg>
  )
}

interface NotificationPayload {
  type: string
  conversationId: string
  senderName: string
  senderId?: string
  content?: string
  messageType?: string
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const accessToken = useAuthStore((s) => s.accessToken)
  const t = useTranslations('layout')

  // The conversation-list sidebar belongs ONLY to the messaging area
  // (/conversations and /conversations/:id). Every other page (AI hub,
  // settings, admin, friends, profile…) renders full-width with no sidebar.
  const isConversationOpen = /^\/conversations\/.+/.test(pathname)
  const isMessagingArea = /^\/conversations(\/|$)/.test(pathname)
  const showSidebar = isMessagingArea
  const showTabBar = !isConversationOpen

  useEffect(() => {
    if (!accessToken || stompService.isConnected()) return

    stompService.connect(accessToken).then(() => {
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

          const title = t('notificationTitle', { name: payload.senderName })
          const body =
            payload.messageType && payload.messageType !== 'text'
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
    // `router` from next/navigation is stable; only re-run on auth change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  const { openNewChat, openPublicChannels } = useUiStore()

  return (
    <div className="h-dvh flex overflow-hidden">
      <CallOverlay />
      {/* Sidebar: only on the messaging area. Full-width on mobile, fixed 288px
          on md+; hidden on mobile when a conversation thread is open. */}
      {showSidebar && (
      <aside
        className={cn(
          'w-full md:w-72 border-r flex-col shrink-0 relative overflow-hidden',
          isConversationOpen ? 'hidden md:flex' : 'flex',
        )}
      >
        {/* Ambient neon glow spheres */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-16 -left-16 size-40 rounded-full bg-pon-cyan blur-[60px] opacity-[0.06] dark:opacity-[0.09]" />
          <div className="absolute -bottom-16 -right-16 size-40 rounded-full bg-pon-peach blur-[60px] opacity-[0.06] dark:opacity-[0.09]" />
        </div>
        <div className="h-16 border-b px-4 flex items-center justify-between shrink-0 bg-background/95 backdrop-blur-md">
          {/* Logo & PON Text */}
          <div className="flex items-center gap-2 select-none">
            <PonLogo className="size-8" />
            <span className="font-bold text-xl tracking-wider bg-gradient-to-r from-pon-cyan via-pon-peach to-pon-pink bg-clip-text text-transparent">
              PON
            </span>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-0.5">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={openPublicChannels}
              title={t('navExplore')}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Compass className="size-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('navCreate')}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <Plus className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={() => openNewChat('direct')}
                  className="cursor-pointer"
                >
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  <span>{t('menuNewChat')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => openNewChat('group')}
                  className="cursor-pointer"
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span>{t('menuNewGroup')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              asChild
              title={t('navContacts')}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Link href="/friends">
                <Contact className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
          <ActiveFriendsRow />
          <AssistantEntry />
          <ConversationList />
        </div>
        {/* Bottom cluster — AI Hub launcher sits directly above the account anchor (desktop). */}
        <SidebarAiHubButton />
        <SidebarProfileBar />
      </aside>
      )}

      {/* Main area. Full-width on every non-messaging page. On the conversation
          LIST (sidebar visible, no thread open) it's hidden on mobile so the
          list owns the screen; everywhere else it's always visible. */}
      <main
        className={cn(
          'flex-1 overflow-hidden flex-col',
          showSidebar && !isConversationOpen ? 'hidden md:flex' : 'flex',
        )}
      >
        {children}
      </main>
      {showTabBar && <MobileTabBar />}
    </div>
  )
}
