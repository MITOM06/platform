'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth.store'
import { Button } from '@/components/ui/button'
import { stompService } from '@/lib/stomp/client'
import { ConversationList } from '@/components/chat/ConversationList'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!accessToken || stompService.isConnected()) return
    stompService.connect(accessToken).catch(() => {
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
      <aside className="w-72 border-r flex flex-col shrink-0">
        <div className="h-14 border-b px-4 flex items-center justify-between shrink-0">
          <span className="font-semibold">Platform</span>
          <div className="flex items-center gap-2">
            {user && (
              <span className="text-xs text-muted-foreground hidden lg:block truncate max-w-28">
                {user.displayName}
              </span>
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

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
