'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bot } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth.store'
import { useUser } from '@/lib/hooks/use-user'
import type { Conversation } from '@/lib/api/types'

const AI_BOT_ID = 'ai-bot-000000000000000000000001'

interface Props {
  conversation: Conversation
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
  const currentUser = useAuthStore((s) => s.user)

  const isAI = conv.participants.includes(AI_BOT_ID)
  const otherUserId =
    !isAI && conv.type === 'direct'
      ? conv.participants.find((id) => id !== currentUser?.id)
      : undefined

  const { data: otherUser } = useUser(otherUserId)

  const displayName =
    conv.name ??
    (isAI ? 'AI Assistant' : (otherUser?.displayName ?? 'Cuộc trò chuyện'))
  const avatarUrl = conv.avatarUrl ?? otherUser?.avatarUrl

  return (
    <Link
      href={`/conversations/${conv.id}`}
      className={cn(
        'flex items-center gap-3 px-3 py-3 rounded-lg transition-colors hover:bg-primary/5',
        isActive
          ? 'bg-primary/[0.08] shadow-[inset_2px_0_0_0_#6AC9FF]'
          : 'hover:bg-muted',
      )}
    >
      <Avatar className="size-10 shrink-0">
        {isAI ? (
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            <Bot className="size-4" />
          </AvatarFallback>
        ) : (
          <>
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="text-sm font-medium">
              {getInitials(displayName)}
            </AvatarFallback>
          </>
        )}
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-sm truncate">{displayName}</span>
            {isAI && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
                AI
              </span>
            )}
          </div>
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
