'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { LogOut, Moon, Sun, User } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/lib/store/auth.store'
import { Button } from '@/components/ui/button'
import { stompService } from '@/lib/stomp/client'
import { ConversationList } from '@/components/chat/ConversationList'
import { cn } from '@/lib/utils'

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

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar: full-width on mobile, fixed 288px on md+; hidden on mobile when conversation is open */}
      <aside
        className={cn(
          'w-full md:w-72 border-r flex-col shrink-0',
          isConversationOpen ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="h-14 border-b px-4 flex items-center justify-between shrink-0">
          <span className="font-semibold">Platform</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Chuyển chủ đề"
              className="shrink-0"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            {user && (
              <Link href="/profile">
                <Button variant="ghost" size="icon" title="Hồ sơ cá nhân" className="shrink-0">
                  <User className="size-4" />
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Đăng xuất"
              className="shrink-0"
            >
              <LogOut className="size-4" />
            </Button>
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
