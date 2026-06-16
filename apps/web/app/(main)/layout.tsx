'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { LogOut, Moon, Sun, User, Compass, Contact, Settings, Plus, MessageSquarePlus, Users } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/lib/store/auth.store'
import { Button } from '@/components/ui/button'
import { stompService } from '@/lib/stomp/client'
import { callManager, type WebRTCSignal } from '@/lib/webrtc/call-manager'
import { useCallStore } from '@/lib/store/call.store'
import { CallOverlay } from '@/components/call/CallOverlay'
import { ConversationList } from '@/components/chat/ConversationList'
import { ActiveFriendsRow } from '@/components/chat/ActiveFriendsRow'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/lib/store/ui.store'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function getInitials(name?: string): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

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
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const { theme, setTheme } = useTheme()

  const isConversationOpen = /^\/conversations\/.+/.test(pathname)

  useEffect(() => {
    if (!accessToken || stompService.isConnected()) return

    stompService.connect(accessToken).then(() => {
      // NOTE: notification-permission prompting was moved to the post-login /
      // post-register success path (see lib/notifications.ts). It must NOT be
      // requested here — that fired on every authenticated session load.

      stompService.subscribe('/user/queue/notifications', (frame) => {
        try {
          const payload: NotificationPayload = JSON.parse(frame.body)
          if (payload.type !== 'NEW_MESSAGE' && payload.type !== 'MENTIONED_YOU') {
            return
          }
          // Don't notify for the conversation already open on screen.
          if (window.location.pathname === `/conversations/${payload.conversationId}`) {
            return
          }

          const title = `Tin nhắn mới từ ${payload.senderName}`
          const body =
            payload.messageType && payload.messageType !== 'text'
              ? '📎 Đã gửi một tệp đính kèm'
              : payload.content || 'Bạn có tin nhắn mới'

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
                label: 'Mở',
                onClick: () => router.push(`/conversations/${payload.conversationId}`),
              },
            })
          }
        } catch {
          // ignore
        }
      })

      // WebRTC call signaling — incoming offers open the call overlay; other
      // signals (answer/ice/end) are routed into the active peer connection.
      stompService.subscribe('/user/queue/webrtc', (frame) => {
        try {
          const signal: WebRTCSignal = JSON.parse(frame.body)
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
            callManager.handleSignal(signal)
          }
        } catch {
          // ignore
        }
      })
    }).catch(() => {
      toast.error('Không thể kết nối realtime')
    })

    return () => {
      stompService.disconnect()
    }
    // `router` from next/navigation is stable; only re-run on auth change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/clear-cookie', { method: 'POST' })
      stompService.disconnect()
      clearAuth()
      router.push('/login')
    } catch {
      toast.error('Đăng xuất thất bại')
    }
  }

  const { openNewChat, openPublicChannels } = useUiStore()

  return (
    <div className="h-dvh flex overflow-hidden">
      <CallOverlay />
      {/* Sidebar: full-width on mobile, fixed 288px on md+; hidden on mobile when conversation is open */}
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
            <Button
              variant="ghost"
              size="icon"
              onClick={openPublicChannels}
              title="Khám phá"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Compass className="size-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Tạo mới"
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
                  <span>Trò chuyện mới</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => openNewChat('group')}
                  className="cursor-pointer"
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span>Tạo nhóm</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              asChild
              title="Danh bạ"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Link href="/friends">
                <Contact className="size-4" />
              </Link>
            </Button>

            {/* Profile Settings Dropdown */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full ml-1">
                    <Avatar className="h-8 w-8 border border-muted">
                      <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                        {getInitials(user.displayName)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => router.push('/profile')}
                    className="flex w-full items-center cursor-pointer"
                  >
                    <User className="mr-2 h-4 w-4" />
                    <span>Hồ sơ cá nhân</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => router.push('/settings')}
                    className="flex w-full items-center cursor-pointer"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Cài đặt</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="cursor-pointer"
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="mr-2 h-4 w-4" />
                        <span>Giao diện sáng</span>
                      </>
                    ) : (
                      <>
                        <Moon className="mr-2 h-4 w-4" />
                        <span>Giao diện tối</span>
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Đăng xuất</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <ActiveFriendsRow />
          <ConversationList />
        </div>
      </aside>

      {/* Main area: hidden on mobile when no conversation is open */}
      <main
        className={cn(
          'flex-1 overflow-hidden',
          isConversationOpen ? 'flex flex-col' : 'hidden md:flex md:flex-col',
        )}
      >
        {children}
      </main>
    </div>
  )
}
