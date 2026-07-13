'use client'

import { useState } from 'react'
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
  Ban,
  Bell,
  Coins,
  BrainCircuit,
  Hash,
  Languages,
  Plug,
  Sparkles,
  HelpCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/auth.store'
import { useNotificationPrefs } from '@/lib/store/notification-prefs'
import { stompService } from '@/lib/stomp/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { absoluteMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { LogoutConfirmDialog } from '@/components/layout/LogoutConfirmDialog'
import { ThemePickerDialog, LanguagePickerDialog } from '@/components/settings/AppearanceDialogs'
import { LOCALE_NAMES, type Locale } from '@/i18n/config'

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
  const { theme } = useTheme()
  const locale = useLocale()
  const notificationsEnabled = useNotificationPrefs((s) => s.enabled)
  const setNotificationsEnabled = useNotificationPrefs((s) => s.setEnabled)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/clear-cookie', { method: 'POST' })
      stompService.disconnect()
      clearAuth()
      // `?cleared=1` tells the login page to wipe any browser-autofilled
      // credentials so the next person doesn't see the prior account.
      router.push('/login?cleared=1')
    } catch {
      toast.error(t('logoutError'))
      setLoggingOut(false)
    }
  }

  const notificationApiAvailable = typeof Notification !== 'undefined'

  const handleToggleNotifications = (next: boolean) => {
    setNotificationsEnabled(next)
    if (next) {
      // Best-effort OS permission so notifications work when the tab is hidden.
      if (notificationApiAvailable && Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          toast.success(perm === 'granted' ? t('notificationsGranted') : t('notificationsDenied'))
        })
      } else {
        toast.success(t('notificationsGranted'))
      }
    } else {
      toast.info(t('notificationsTurnedOff'))
    }
  }

  const notificationSubtitle = !notificationApiAvailable
    ? t('notificationsUnavailable')
    : notificationsEnabled
      ? t('notificationsEnabled')
      : t('notificationsDisabled')

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

          <div className="relative max-w-5xl mx-auto px-6 md:px-10 py-8 pb-tabbar md:pb-12">
            <div className="flex flex-col items-center mb-10">
              <div className="relative">
                <Avatar className="size-20 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                  {user.avatarUrl && (
                    <AvatarImage src={absoluteMediaUrl(user.avatarUrl)} alt={user.displayName} />
                  )}
                  <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-pon-cyan to-pon-pink text-white">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <h2 className="mt-4 text-lg font-bold text-foreground">{user.displayName}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                onClick={() => setThemePickerOpen(true)}
              />

              <SettingsCard
                icon={<Languages className="size-5 text-primary" />}
                iconBg="rgba(106,201,255,0.12)"
                title={t('language')}
                subtitle={LOCALE_NAMES[locale as Locale] ?? locale}
                onClick={() => setLanguagePickerOpen(true)}
              />

              <SettingsCard
                icon={<Ban className="size-5 text-destructive" />}
                iconBg="rgba(239,68,68,0.1)"
                title={t('blockedChats')}
                subtitle={t('blockedChatsSubtitle')}
                onClick={() => router.push('/blocked')}
              />

              <SettingsCard
                icon={<Hash className="size-5 text-[#B47FFF]" />}
                iconBg="rgba(180,127,255,0.12)"
                title={t('explore')}
                subtitle={t('exploreSubtitle')}
                onClick={() => router.push('/explore')}
              />

              <div className="relative rounded-xl border bg-card overflow-hidden">
                <div className="relative flex items-center gap-4 px-5 py-4">
                  <div
                    className="size-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(251,182,139,0.12)' }}
                  >
                    <Bell className="size-5 text-pon-peach" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{t('notifications')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {notificationSubtitle}
                    </p>
                  </div>
                  <Switch
                    checked={notificationsEnabled}
                    onCheckedChange={handleToggleNotifications}
                    disabled={!notificationApiAvailable}
                    aria-label={t('notifications')}
                  />
                </div>
              </div>

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
                title={t('aiContext')}
                subtitle={t('aiContextSubtitle')}
                onClick={() => router.push('/ai-context')}
              />

              <SettingsCard
                icon={<Plug className="size-5 text-pon-cyan" />}
                iconBg="rgba(106,201,255,0.12)"
                title={t('integrations')}
                subtitle={t('integrationsSubtitle')}
                onClick={() => router.push('/integrations')}
              />

              <SettingsCard
                icon={<Sparkles className="size-5 text-[#B47FFF]" />}
                iconBg="rgba(180,127,255,0.12)"
                title={t('skills')}
                subtitle={t('skillsSubtitle')}
                onClick={() => router.push('/skills')}
              />

              <SettingsCard
                icon={<HelpCircle className="size-5 text-pon-cyan" />}
                iconBg="rgba(106,201,255,0.12)"
                title={t('help')}
                subtitle={t('helpSubtitle')}
                onClick={() => router.push('/help')}
              />

              <SettingsCard
                icon={
                  <Lock
                    className={cn(
                      'size-5',
                      !user.hasPassword ? 'text-amber-500' : 'text-pon-pink',
                    )}
                  />
                }
                iconBg={
                  !user.hasPassword
                    ? 'rgba(245,158,11,0.12)'
                    : 'rgba(255,133,179,0.12)'
                }
                title={t('securityCard')}
                subtitle={
                  !user.hasPassword
                    ? t('securityNoPassword')
                    : t('securitySubtitle')
                }
                onClick={() => router.push('/settings/security')}
              />
            </div>

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
                onClick={() => setLogoutConfirmOpen(true)}
                destructive
              />
            </div>

            <div className="mt-12 text-center">
              <p className="text-xs text-muted-foreground/50">{t('version')}</p>
            </div>
          </div>
        </div>
      </div>

      <LogoutConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        onConfirm={handleLogout}
      />
      <ThemePickerDialog open={themePickerOpen} onOpenChange={setThemePickerOpen} />
      <LanguagePickerDialog open={languagePickerOpen} onOpenChange={setLanguagePickerOpen} />
    </div>
  )
}
