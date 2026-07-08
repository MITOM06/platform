'use client'

import { type CSSProperties } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { Compass, Contact, Plus, MessageSquarePlus, Users } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ConversationList } from '@/components/chat/ConversationList'
import { OfflineBanner } from '@/components/chat/OfflineBanner'
import { ActiveFriendsRow } from '@/components/chat/ActiveFriendsRow'
import { AssistantEntry } from '@/components/chat/AssistantEntry'
import { cn } from '@/lib/utils'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { SidebarProfileBar } from '@/components/layout/SidebarProfileBar'
import { SidebarAiHubButton } from '@/components/layout/SidebarAiHubButton'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { PonLogo } from '@/components/layout/PonLogo'
import { useUiStore } from '@/lib/store/ui.store'
import { useSidebarResize } from '@/lib/hooks/use-sidebar-resize'
import { useRealtimeNotifications } from '@/lib/hooks/use-realtime-notifications'
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

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t = useTranslations('layout')

  // The conversation-list sidebar belongs ONLY to the messaging area
  // (/conversations and /conversations/:id). Every other page (AI hub,
  // settings, admin, friends, profile…) renders full-width with no sidebar.
  const isConversationOpen = /^\/conversations\/.+/.test(pathname)
  const isMessagingArea = /^\/conversations(\/|$)/.test(pathname)
  const showSidebar = isMessagingArea
  // Hide the generic mobile nav across the whole messaging area — the
  // conversation list owns the screen there and has its own bottom tab bar.
  const showTabBar = !isMessagingArea

  // ── Resizable sidebar (desktop only) ──────────────────────────────────────
  // Width lives in the UI store (single source of truth shared with the
  // ConversationHeader collapse toggle) and is applied via a CSS variable so
  // mobile stays full-width (`w-full`) and only `md:w-[var(--sidebar-w)]` picks
  // up the dynamic value. The sidebar content adapts to narrow widths via CSS
  // container queries (`@container` on <aside> + `@[120px]:`/`@[300px]:` variants below).
  const { sidebarWidth, handleDragStart } = useSidebarResize()

  // Session-level STOMP realtime pipeline (notifications, WebRTC signaling,
  // presence) — (dis)connects on the authed↔unauthed transition.
  useRealtimeNotifications()

  const { openNewChat, openPublicChannels } = useUiStore()

  return (
    <div className="h-dvh flex overflow-hidden">
      <CallOverlay />
      {/* Sidebar: only on the messaging area. Full-width on mobile, fixed 288px
          on md+; hidden on mobile when a conversation thread is open. */}
      {showSidebar && (
      <aside
        className={cn(
          'w-full border-r flex-col shrink-0 relative overflow-hidden @container',
          isConversationOpen ? 'hidden md:flex' : 'flex',
          // Desktop: dynamic width driven by the drag handle / collapse toggle.
          'md:w-[var(--sidebar-w)]',
        )}
        style={{ '--sidebar-w': `${sidebarWidth}px` } as CSSProperties}
      >
        {/* Drag handle — right edge, desktop only. 4px hot-zone that tints on
            hover; drag to resize, sidebar content compacts at narrow widths. */}
        <div
          onMouseDown={handleDragStart}
          role="separator"
          aria-orientation="vertical"
          className="hidden md:block absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-20 hover:bg-primary/20 active:bg-primary/40 transition-colors"
        />
        {/* Ambient neon glow spheres */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-16 -left-16 size-40 rounded-full bg-pon-cyan blur-[60px] opacity-[0.06] dark:opacity-[0.09]" />
          <div className="absolute -bottom-16 -right-16 size-40 rounded-full bg-pon-peach blur-[60px] opacity-[0.06] dark:opacity-[0.09]" />
        </div>
        <div className="h-16 border-b px-2 @[200px]:px-4 flex items-center justify-center @[200px]:justify-between shrink-0 bg-background/95 backdrop-blur-md">
          {/* Logo & PON Text — text hides when the rail is compact */}
          <div className="flex items-center gap-2 select-none">
            <PonLogo className="size-8" />
            <span className="hidden @[200px]:inline font-bold text-xl tracking-wider bg-gradient-to-r from-pon-cyan via-pon-peach to-pon-pink bg-clip-text text-transparent">
              PON
            </span>
          </div>

          {/* Action Icons — hidden when the rail is compact (expand to reach them) */}
          <div className="hidden @[200px]:flex items-center gap-0.5">
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
          {/* Banner stack — top of the sidebar body, above all list content, so
              every status banner flows top→down (mirrors the Flutter list screen
              where OfflineBanner is the first child of the body Column). */}
          <OfflineBanner />
          {/* Horizontal presence row doesn't fit the compact rail — hide it. */}
          <div className="hidden @[300px]:block">
            <ActiveFriendsRow />
          </div>
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
