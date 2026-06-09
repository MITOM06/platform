'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import {
  ArrowLeft,
  User,
  Sun,
  Moon,
  Monitor,
  Lock,
  LogOut,
  Loader2,
  ChevronRight,
  Archive,
  Bell,
  Coins,
  BrainCircuit,
  Hash,
} from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/auth.store'
import { stompService } from '@/lib/stomp/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChangePasswordDialog } from '@/components/chat/ChangePasswordDialog'

function getInitials(name?: string): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

interface SettingsCardProps {
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle?: string
  onClick: () => void
  destructive?: boolean
}

function SettingsCard({ icon, iconBg, title, subtitle, onClick, destructive }: SettingsCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full group relative rounded-xl border bg-card p-0 transition-all duration-200 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] text-left overflow-hidden ${
        destructive ? 'hover:border-destructive/30' : 'hover:border-primary/30'
      }`}
    >
      {/* Subtle glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 50%, ${
            destructive ? 'rgba(239,68,68,0.04)' : 'rgba(106,201,255,0.06)'
          }, transparent 70%)`,
        }}
      />

      <div className="relative flex items-center gap-4 px-5 py-4">
        <div
          className="size-10 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${
              destructive ? 'text-destructive' : 'text-foreground'
            }`}
          >
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <ChevronRight
          className={`size-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${
            destructive ? 'text-destructive/40' : 'text-muted-foreground/40'
          }`}
        />
      </div>
    </button>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { theme, setTheme } = useTheme()
  const [loggingOut, setLoggingOut] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/clear-cookie', { method: 'POST' })
      stompService.disconnect()
      clearAuth()
      router.push('/login')
    } catch {
      toast.error('Đăng xuất thất bại')
      setLoggingOut(false)
    }
  }

  const cycleTheme = () => {
    const order: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system']
    const current = theme as typeof order[number]
    const idx = order.indexOf(current)
    const next = order[(idx + 1) % order.length]
    setTheme(next)
    toast.success(`Đã chuyển sang giao diện ${
      next === 'light' ? 'sáng' : next === 'dark' ? 'tối' : 'hệ thống'
    }`)
  }

  const themeIcon = () => {
    switch (theme) {
      case 'dark': return <Moon className="size-5 text-primary" />
      case 'light': return <Sun className="size-5 text-amber-500" />
      default: return <Monitor className="size-5 text-primary" />
    }
  }

  const themeLabel = () => {
    switch (theme) {
      case 'dark': return 'Giao diện tối'
      case 'light': return 'Giao diện sáng'
      default: return 'Theo hệ thống'
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
        <Link
          href="/conversations"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">Cài đặt</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Background glow effects */}
        <div className="relative">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-pon-cyan/5 blur-3xl pointer-events-none dark:bg-pon-cyan/8" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-pon-peach/5 blur-3xl pointer-events-none dark:bg-pon-peach/8" />

          <div className="relative max-w-md mx-auto px-6 py-8">
            {/* User info section */}
            <div className="flex flex-col items-center mb-10">
              <div className="relative">
                <Avatar className="size-20 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                  <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-pon-cyan to-pon-pink text-white">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
                {/* Online indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-online-green border-2 border-background" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-foreground">{user.displayName}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>

            {/* Settings cards */}
            <div className="space-y-3">
              {/* Edit Profile */}
              <SettingsCard
                icon={<User className="size-5 text-primary" />}
                iconBg="rgba(106,201,255,0.12)"
                title="Chỉnh sửa hồ sơ"
                onClick={() => router.push('/profile')}
              />

              {/* Theme */}
              <SettingsCard
                icon={themeIcon()}
                iconBg="rgba(251,182,139,0.12)"
                title="Giao diện"
                subtitle={themeLabel()}
                onClick={cycleTheme}
              />

              {/* Archived Chats */}
              <SettingsCard
                icon={<Archive className="size-5 text-primary" />}
                iconBg="rgba(106,201,255,0.12)"
                title="Tin nhắn đã lưu trữ"
                subtitle="Xem các cuộc trò chuyện đã ẩn"
                onClick={() => router.push('/archived')}
              />

              {/* Explore Channels */}
              <SettingsCard
                icon={<Hash className="size-5 text-[#B47FFF]" />}
                iconBg="rgba(180,127,255,0.12)"
                title="Khám phá cộng đồng"
                subtitle="Tìm và tham gia các kênh công khai"
                onClick={() => router.push('/explore')}
              />

              {/* Notifications */}
              <SettingsCard
                icon={<Bell className="size-5 text-pon-peach" />}
                iconBg="rgba(251,182,139,0.12)"
                title="Thông báo"
                subtitle={
                  typeof Notification !== 'undefined'
                    ? Notification.permission === 'granted'
                      ? 'Đã bật'
                      : 'Chưa bật'
                    : 'Không khả dụng'
                }
                onClick={() => {
                  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                    Notification.requestPermission().then((perm) => {
                      toast.success(
                        perm === 'granted'
                          ? 'Đã bật thông báo'
                          : 'Không thể bật thông báo. Kiểm tra cài đặt trình duyệt.',
                      )
                    })
                  } else {
                    toast.info('Thông báo đã được bật')
                  }
                }}
              />

              {/* Token Usage */}
              <SettingsCard
                icon={<Coins className="size-5 text-pon-peach" />}
                iconBg="rgba(251,182,139,0.12)"
                title="Lượng token AI"
                subtitle="Xem thống kê sử dụng token"
                onClick={() => router.push('/token-usage')}
              />

              {/* AI Memory */}
              <SettingsCard
                icon={<BrainCircuit className="size-5 text-[#B47FFF]" />}
                iconBg="rgba(180,127,255,0.12)"
                title="AI Memory"
                subtitle="Quản lý bộ nhớ AI"
                onClick={() => router.push('/ai-memory')}
              />

              {/* Change Password */}
              <SettingsCard
                icon={<Lock className="size-5 text-pon-pink" />}
                iconBg="rgba(255,133,179,0.12)"
                title="Đổi mật khẩu"
                onClick={() => setChangePasswordOpen(true)}
              />

              {/* Logout */}
              <div className="pt-4">
                <SettingsCard
                  icon={
                    loggingOut ? (
                      <Loader2 className="size-5 text-destructive animate-spin" />
                    ) : (
                      <LogOut className="size-5 text-destructive" />
                    )
                  }
                  iconBg="rgba(239,68,68,0.1)"
                  title="Đăng xuất"
                  onClick={handleLogout}
                  destructive
                />
              </div>
            </div>

            {/* Version footer */}
            <div className="mt-12 text-center">
              <p className="text-xs text-muted-foreground/50">PON Messenger v1.0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Dialog */}
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  )
}
