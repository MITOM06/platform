'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { LogOut, User, Settings, ShieldCheck, ChevronsUpDown } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth.store'
import { stompService } from '@/lib/stomp/client'
import { useCanAccessAdmin } from '@/lib/hooks/use-capabilities'
import { absoluteMediaUrl } from '@/lib/media'
import { LogoutConfirmDialog } from '@/components/layout/LogoutConfirmDialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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

/**
 * Persistent account bar pinned to the bottom of the messaging sidebar (desktop).
 * Replaces the small avatar that used to sit in the sidebar header — enlarged and
 * given a PON-gradient ring so the account is the anchor of the left rail, the
 * Slack/Linear pattern. Mobile keeps its own entry via the header avatar + tab bar,
 * so this is `md` and up only.
 */
export function SidebarProfileBar() {
  const router = useRouter()
  const t = useTranslations('layout')
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const canAccessAdmin = useCanAccessAdmin()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  if (!user) return null

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/clear-cookie', { method: 'POST' })
      stompService.disconnect()
      clearAuth()
      // `?cleared=1` tells the login page to wipe any browser-autofilled
      // credentials so the next person doesn't see the prior account.
      router.push('/login?cleared=1')
    } catch {
      toast.error(t('logoutError'))
    }
  }

  return (
    <div className="hidden md:block shrink-0 border-t bg-background/95 backdrop-blur-md p-2.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group relative flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pon-cyan/50 data-[state=open]:bg-muted/70 justify-center @[200px]:justify-start"
          >
            {/* Avatar with PON-gradient ring */}
            <span className="relative shrink-0">
              <span className="block rounded-full bg-gradient-to-br from-pon-cyan via-pon-peach to-pon-pink p-[2px] shadow-[0_0_12px_-2px] shadow-pon-peach/40">
                <Avatar className="size-11 border-2 border-background">
                  {user.avatarUrl && (
                    <AvatarImage src={absoluteMediaUrl(user.avatarUrl)} alt={user.displayName} />
                  )}
                  <AvatarFallback className="bg-background text-sm font-semibold text-foreground">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
              </span>
            </span>

            <span className="hidden @[200px]:block min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight">
                {user.displayName}
              </span>
              <span className="block truncate text-xs leading-tight text-muted-foreground">
                {user.email}
              </span>
            </span>

            <ChevronsUpDown className="hidden @[200px]:block size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56"
        >
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
            <span>{t('menuProfile')}</span>
          </DropdownMenuItem>
          {canAccessAdmin && (
            <DropdownMenuItem
              onSelect={() => router.push('/admin')}
              className="flex w-full items-center cursor-pointer"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              <span>{t('menuAdmin')}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => router.push('/settings')}
            className="flex w-full items-center cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>{t('menuSettings')}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setLogoutConfirmOpen(true)}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('menuLogout')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LogoutConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        onConfirm={handleLogout}
      />
    </div>
  )
}
