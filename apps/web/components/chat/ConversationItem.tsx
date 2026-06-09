'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Conversation } from '@/lib/api/types'

interface Props {
  conversation: Conversation
}

function getDisplayName(conv: Conversation): string {
  if (conv.name) return conv.name
  return conv.type === 'group' ? 'Nhóm' : 'Cuộc trò chuyện'
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export function ConversationItem({ conversation: conv }: Props) {
  const pathname = usePathname()
  const isActive = pathname === `/conversations/${conv.id}`
  const displayName = getDisplayName(conv)

  return (
    <Link
      href={`/conversations/${conv.id}`}
      className={cn(
        'flex items-center gap-3 px-3 py-3 rounded-lg transition-colors hover:bg-accent',
        isActive && 'bg-accent',
      )}
    >
      <Avatar className="size-10 shrink-0">
        {conv.avatarUrl && <AvatarImage src={conv.avatarUrl} alt={displayName} />}
        <AvatarFallback className="text-sm font-medium">
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium text-sm truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatTime(conv.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">
            {conv.lastMessage?.content ?? 'Chưa có tin nhắn'}
          </p>
          {conv.unreadCount > 0 && (
            <Badge
              variant="default"
              className="text-xs h-4 min-w-4 px-1 shrink-0 rounded-full"
            >
              {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  )
}
