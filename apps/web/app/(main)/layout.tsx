'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { LogOut, Moon, Sun, User, Compass, MessageSquarePlus, Users, Contact } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/lib/store/auth.store'
import { Button } from '@/components/ui/button'
import { stompService } from '@/lib/stomp/client'
import { ConversationList } from '@/components/chat/ConversationList'
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
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission()
      }

      stompService.subscribe('/user/queue/notifications', (frame) => {
        try {
          const payload: NotificationPayload = JSON.parse(frame.body)
          if (
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted' &&
            document.visibilityState === 'hidden'
          ) {
            new Notification(`Tin nhắn mới từ ${payload.senderName}`, {
              body: 'Bạn có tin nhắn mới',
            })
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
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar: full-width on mobile, fixed 288px on md+; hidden on mobile when conversation is open */}
      <aside
        className={cn(
          'w-full md:w-72 border-r flex-col shrink-0',
          isConversationOpen ? 'hidden md:flex' : 'flex',
        )}
      >
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
              title="Khám phá kênh"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Compass className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openNewChat('direct')}
              title="Trò chuyện mới"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <MessageSquarePlus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openNewChat('group')}
              title="Tạo nhóm"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Users className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toast.info('Danh sách liên hệ đang được phát triển')}
              title="Danh bạ"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Contact className="size-4" />
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
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex w-full items-center cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Hồ sơ cá nhân</span>
                    </Link>
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
        <div className="flex-1 overflow-hidden">
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
