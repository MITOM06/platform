'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, UserPlus, Users, ShieldAlert, Smartphone, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { absoluteMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'
import {
  useNotifications,
  useNotificationActions,
} from '@/lib/hooks/use-notifications'
import { useFriendActions } from '@/lib/hooks/use-friends'
import type { AppNotification } from '@/lib/api/notifications'

/** Compact relative-time formatter (no date-fns dependency). */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  const wk = Math.floor(day / 7)
  if (wk < 4) return `${wk}w`
  return new Date(then).toLocaleDateString()
}

/**
 * Localize a notification's title/body from its `type` (a stable code) so every
 * one of the 7 UI languages renders correctly, regardless of the language the
 * backend happened to store the text in. Falls back to the raw backend title/
 * body only for SYSTEM / unknown types that carry no code-derived copy.
 * See .claude/rules/i18n.md and .claude/rules/no-raw-system-data-in-ui.md.
 */
function localizedNotification(
  n: AppNotification,
  t: ReturnType<typeof useTranslations>,
): { title: string; body: string } {
  const name = n.actorName ?? ''
  switch (n.type) {
    case 'FRIEND_REQUEST':
      return { title: t('friendRequestTitle', { name }), body: '' }
    case 'FRIEND_ACCEPTED':
      return { title: t('friendAcceptedTitle', { name }), body: '' }
    case 'PHONE_SETUP':
      return { title: t('phoneSetupTitle'), body: t('phoneSetupBody') }
    case 'PASSWORD_SETUP':
      return { title: t('passwordSetupTitle'), body: t('passwordSetupBody') }
    default:
      return { title: n.title, body: n.body }
  }
}

function NotifIcon({ type }: { type: AppNotification['type'] }) {
  switch (type) {
    case 'FRIEND_REQUEST':
      return <UserPlus className="size-4 text-pon-cyan" />
    case 'FRIEND_ACCEPTED':
      return <Users className="size-4 text-green-500" />
    case 'PASSWORD_SETUP':
      return <ShieldAlert className="size-4 text-amber-500" />
    case 'PHONE_SETUP':
      return <Smartphone className="size-4 text-amber-500" />
    default:
      return <Info className="size-4 text-muted-foreground" />
  }
}

function NotificationRow({
  n,
  onMarkRead,
  onAccept,
  onDecline,
  accepting,
  declining,
}: {
  n: AppNotification
  onMarkRead: (id: string) => void
  onAccept: (n: AppNotification) => void
  onDecline: (n: AppNotification) => void
  accepting: boolean
  declining: boolean
}) {
  const t = useTranslations('notifications')
  const { title, body } = localizedNotification(n, t)
  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer',
        !n.readAt && 'bg-pon-cyan/5',
      )}
      onClick={() => {
        if (!n.readAt) onMarkRead(n._id)
      }}
    >
      <div className="relative shrink-0">
        {n.actorAvatarUrl ? (
          <Avatar className="size-10">
            <AvatarImage src={absoluteMediaUrl(n.actorAvatarUrl)} />
            <AvatarFallback>
              {(n.actorName?.[0] ?? '?').toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="size-10 rounded-full bg-muted flex items-center justify-center">
            <NotifIcon type={n.type} />
          </div>
        )}
        {n.actorAvatarUrl && (
          <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-card border border-border flex items-center justify-center">
            <NotifIcon type={n.type} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug line-clamp-2">{title}</p>
        {(n.type === 'PHONE_SETUP' || n.type === 'PASSWORD_SETUP') && body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{body}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {relativeTime(n.createdAt)}
        </p>

        {n.type === 'PHONE_SETUP' && (
          <Link
            href="/profile/edit"
            className="mt-1.5 text-xs text-pon-cyan hover:underline inline-block"
            onClick={(e) => {
              e.stopPropagation()
              onMarkRead(n._id)
            }}
          >
            {t('phoneSetupAction')}
          </Link>
        )}
        {n.type === 'PASSWORD_SETUP' && (
          <Link
            href="/settings/security"
            className="mt-1.5 text-xs text-pon-cyan hover:underline inline-block"
            onClick={(e) => {
              e.stopPropagation()
              onMarkRead(n._id)
            }}
          >
            {t('passwordSetupAction')}
          </Link>
        )}

        {n.type === 'FRIEND_REQUEST' && n.relatedEntityId && !n.readAt && (
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              className="h-7 px-3 text-xs bg-pon-cyan hover:bg-pon-cyan/90 text-black"
              onClick={(e) => {
                e.stopPropagation()
                onAccept(n)
              }}
              disabled={accepting}
            >
              {t('accept')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-3 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onDecline(n)
              }}
              disabled={declining}
            >
              {t('decline')}
            </Button>
          </div>
        )}
      </div>

      {!n.readAt && (
        <div className="size-2 rounded-full bg-pon-cyan shrink-0 mt-1.5" />
      )}
    </div>
  )
}

export function NotificationBell() {
  const t = useTranslations('notifications')
  const [open, setOpen] = useState(false)
  const { data: notifications = [] } = useNotifications()
  const { markRead, markAllRead } = useNotificationActions()
  const { acceptRequest, removeFriend } = useFriendActions()

  const unreadCount = notifications.filter((n) => !n.readAt).length
  const unread = notifications.filter((n) => !n.readAt)
  const read = notifications.filter((n) => !!n.readAt)

  const handleOpen = (next: boolean) => {
    setOpen(next)
    // When opening, mark all read after a short delay so the user briefly sees
    // the badge before it clears (signals they've seen the notifications).
    if (next && unreadCount > 0) {
      setTimeout(() => markAllRead.mutate(), 1500)
    }
  }

  const handleAccept = (n: AppNotification) => {
    if (!n.relatedEntityId) return
    acceptRequest.mutate(n.relatedEntityId)
    markRead.mutate(n._id)
  }

  const handleDecline = (n: AppNotification) => {
    if (!n.relatedEntityId) return
    removeFriend.mutate(n.relatedEntityId)
    markRead.mutate(n._id)
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="relative size-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 size-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">{t('title')}</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-pon-cyan hover:text-pon-cyan/80 transition-colors"
            >
              {t('markAllRead')}
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <Bell className="size-8 opacity-20" />
              <p className="text-sm">{t('empty')}</p>
            </div>
          ) : (
            <>
              {unread.length > 0 && (
                <>
                  <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/30 border-b">
                    {t('sectionUnread')} ({unread.length})
                  </div>
                  <div className="divide-y divide-border/50">
                    {unread.map((n) => (
                      <NotificationRow
                        key={n._id}
                        n={n}
                        onMarkRead={(id) => markRead.mutate(id)}
                        onAccept={handleAccept}
                        onDecline={handleDecline}
                        accepting={acceptRequest.isPending}
                        declining={removeFriend.isPending}
                      />
                    ))}
                  </div>
                </>
              )}
              {read.length > 0 && (
                <>
                  <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/30 border-b border-t">
                    {t('sectionRead')}
                  </div>
                  <div className="divide-y divide-border/50">
                    {read.map((n) => (
                      <NotificationRow
                        key={n._id}
                        n={n}
                        onMarkRead={(id) => markRead.mutate(id)}
                        onAccept={handleAccept}
                        onDecline={handleDecline}
                        accepting={acceptRequest.isPending}
                        declining={removeFriend.isPending}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
