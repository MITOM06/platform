'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { useTranslations, useLocale } from 'next-intl'
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
  Languages,
} from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/auth.store'
import { stompService } from '@/lib/stomp/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChangePasswordDialog } from '@/components/chat/ChangePasswordDialog'
import { setLocaleAction } from '@/lib/actions/locale'
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '@/i18n/config'

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
  const t = useTranslations('settings')
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { theme, setTheme } = useTheme()
  const locale = useLocale()
  const [loggingOut, setLoggingOut] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/clear-cookie', { method: 'POST' })
      stompService.disconnect()
      clearAuth()
      router.push('/login')
    } catch {
      toast.error(t('logoutError'))
      setLoggingOut(false)
    }
  }

  const cycleTheme = () => {
    const order: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system']
    const current = theme as (typeof order)[number]
    const idx = order.indexOf(current)
    const next = order[(idx + 1) % order.length]
    setTheme(next)
    const label = next === 'light' ? t('themeLight') : next === 'dark' ? t('themeDark') : t('themeSystem')
    toast.success(t('themeChanged', { theme: label }))
  }

  const cycleLocale = () => {
    const idx = SUPPORTED_LOCALES.indexOf(locale as Locale)
    const next = SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length]
    startTransition(async () => {
      await setLocaleAction(next)
      toast.success(t('languageChanged'))
      router.refresh()
    })
  }

  const themeIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon className="size-5 text-primary" />
      case 'light':
        return <Sun className="size-5 text-amber-500" />
      default:
        return <Monitor className="size-5 text-primary" />
    }
  }

  const themeLabel = () => {
    switch (theme) {
      case 'dark': return t('themeDark')
      case 'light': return t('themeLight')
      default: return t('themeSystem')
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
        <Link
          href="/conversations"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-pon-cyan/5 blur-3xl pointer-events-none dark:bg-pon-cyan/8" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-pon-peach/5 blur-3xl pointer-events-none dark:bg-pon-peach/8" />

          <div className="relative max-w-md mx-auto px-6 py-8 pb-24 md:pb-8">
            <div className="flex flex-col items-center mb-10">
              <div className="relative">
                <Avatar className="size-20 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                  <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-pon-cyan to-pon-pink text-white">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-online-green border-2 border-background" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-foreground">{user.displayName}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>

            <div className="space-y-3">
              <SettingsCard
                icon={<User className="size-5 text-primary" />}
                iconBg="rgba(106,201,255,0.12)"
                title={t('editProfile')}
                onClick={() => router.push('/profile')}
              />

              <SettingsCard
                icon={themeIcon()}
                iconBg="rgba(251,182,139,0.12)"
                title={t('theme')}
                subtitle={themeLabel()}
                onClick={cycleTheme}
              />

              <SettingsCard
                icon={<Languages className="size-5 text-primary" />}
                iconBg="rgba(106,201,255,0.12)"
                title={t('language')}
                subtitle={`${LOCALE_NAMES[locale as Locale] ?? locale}${isPending ? '…' : ''}`}
                onClick={cycleLocale}
              />

              <SettingsCard
                icon={<Archive className="size-5 text-primary" />}
                iconBg="rgba(106,201,255,0.12)"
                title={t('archived')}
                subtitle={t('archivedSubtitle')}
                onClick={() => router.push('/archived')}
              />

              <SettingsCard
                icon={<Hash className="size-5 text-[#B47FFF]" />}
                iconBg="rgba(180,127,255,0.12)"
                title={t('explore')}
                subtitle={t('exploreSubtitle')}
                onClick={() => router.push('/explore')}
              />

              <SettingsCard
                icon={<Bell className="size-5 text-pon-peach" />}
                iconBg="rgba(251,182,139,0.12)"
                title={t('notifications')}
                subtitle={
                  typeof Notification !== 'undefined'
                    ? Notification.permission === 'granted'
                      ? t('notificationsEnabled')
                      : t('notificationsDisabled')
                    : t('notificationsUnavailable')
                }
                onClick={() => {
                  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                    Notification.requestPermission().then((perm) => {
                      toast.success(
                        perm === 'granted' ? t('notificationsGranted') : t('notificationsDenied'),
                      )
                    })
                  } else {
                    toast.info(t('notificationsAlready'))
                  }
                }}
              />

              <SettingsCard
                icon={<Coins className="size-5 text-pon-peach" />}
                iconBg="rgba(251,182,139,0.12)"
                title={t('tokenUsage')}
                subtitle={t('tokenUsageSubtitle')}
                onClick={() => router.push('/token-usage')}
              />

              <SettingsCard
                icon={<BrainCircuit className="size-5 text-[#B47FFF]" />}
                iconBg="rgba(180,127,255,0.12)"
                title={t('aiMemory')}
                subtitle={t('aiMemorySubtitle')}
                onClick={() => router.push('/ai-memory')}
              />

              <SettingsCard
                icon={<Lock className="size-5 text-pon-pink" />}
                iconBg="rgba(255,133,179,0.12)"
                title={t('changePassword')}
                onClick={() => setChangePasswordOpen(true)}
              />

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
                  title={t('logout')}
                  onClick={handleLogout}
                  destructive
                />
              </div>
            </div>

            <div className="mt-12 text-center">
              <p className="text-xs text-muted-foreground/50">{t('version')}</p>
            </div>
          </div>
        </div>
      </div>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  )
}
