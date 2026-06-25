'use client'

import { memo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bot, MailOpen, Mail, VolumeX, Volume2, Info, Archive, ArchiveRestore,
  Ban, ShieldOff, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { absoluteMediaUrl } from '@/lib/media'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useAuthStore } from '@/lib/store/auth.store'
import { useUser } from '@/lib/hooks/use-user'
import { useRelationship } from '@/lib/hooks/use-relationship'
import { useNickname } from '@/lib/nicknames'
import { chatService } from '@/lib/api/chat'
import { humanizeSystemMessage } from '@/lib/system-messages'
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

function formatTime(iso: string | null, locale: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}

const ConversationItemInner = function ConversationItem({ conversation: conv }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('chat')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const isActive = pathname === `/conversations/${conv.id}`
  const currentUser = useAuthStore((s) => s.user)

  const isAI = conv.participants.includes(AI_BOT_ID)
  const otherUserId =
    !isAI && conv.type === 'direct'
      ? conv.participants.find((id) => id !== currentUser?.id)
      : undefined

  const { data: otherUser } = useUser(otherUserId)
  const otherNickname = useNickname(conv.id, otherUserId)
  const { relationship, block, unblock } = useRelationship(otherUserId)

  const displayName =
    conv.name ??
    (isAI
      ? t('aiAssistant')
      : (otherNickname || otherUser?.displayName || t('conversationDefault')))
  const avatarUrl = conv.avatarUrl ?? otherUser?.avatarUrl

  // Sidebar preview: "You: <msg>" for own last message in direct chats, with
  // system-codes/attachments humanised (mirror Flutter conversation_tile).
  const lastMessage = conv.lastMessage
  let previewText = t('noMessagesYet')
  if (lastMessage?.content) {
    const humanized = humanizeSystemMessage(lastMessage.content, t, { short: true })
    const isOwn = lastMessage.senderId === currentUser?.id
    const isPlainOwn =
      isOwn && conv.type === 'direct' && !lastMessage.content.startsWith('system.')
    previewText = isPlainOwn ? `${t('youColon')}${humanized}` : humanized
  }

  const invalidateConversations = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }

  const run = async (fn: () => Promise<unknown>, errorKey: string) => {
    try {
      await fn()
      invalidateConversations()
    } catch {
      toast.error(t(errorKey))
    }
  }

  const handleMarkRead = () => run(() => chatService.markConversationRead(conv.id), 'actionFailed')
  const handleMarkUnread = () => run(() => chatService.markConversationUnread(conv.id), 'actionFailed')
  const handleMute = () =>
    run(
      () => (conv.isMuted ? chatService.unmuteConversation(conv.id) : chatService.muteConversation(conv.id)),
      'actionFailed',
    )
  const handleArchive = () =>
    run(
      () =>
        conv.isArchived
          ? chatService.unarchiveConversation(conv.id)
          : chatService.archiveConversation(conv.id),
      'actionFailed',
    )
  const handleDelete = () => run(() => chatService.deleteConversation(conv.id), 'actionFailed')

  const handleBlock = async () => {
    if (!otherUserId) return
    try {
      if (relationship?.iBlocked) {
        await unblock(otherUserId)
        toast.success(t('userUnblocked'))
      } else {
        await block(otherUserId)
        toast.success(t('userBlocked'))
      }
      invalidateConversations()
    } catch {
      toast.error(t('actionFailed'))
    }
  }

  const handleInfo = () => router.push(`/conversations/${conv.id}`)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          href={`/conversations/${conv.id}`}
          className={cn(
            'flex items-center gap-3 px-3 py-3 rounded-lg transition-[background-color,transform] duration-[180ms] hover:bg-primary/5 active:scale-[0.98]',
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
                {avatarUrl && <AvatarImage src={absoluteMediaUrl(avatarUrl)} alt={displayName} />}
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
                {conv.isMuted && <VolumeX className="size-3 text-muted-foreground shrink-0" />}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatTime(conv.lastMessageAt, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <p className="text-xs text-muted-foreground truncate">
                {previewText}
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
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        {conv.unreadCount > 0 ? (
          <ContextMenuItem onClick={handleMarkRead}>
            <MailOpen className="size-4" />
            {t('markAsRead')}
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={handleMarkUnread}>
            <Mail className="size-4" />
            {t('markAsUnread')}
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={handleMute}>
          {conv.isMuted ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          {conv.isMuted ? t('unmuteNotifications') : t('muteNotifications')}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleArchive}>
          {conv.isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          {conv.isArchived ? t('unarchiveChat') : t('archiveChat')}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleInfo}>
          <Info className="size-4" />
          {conv.type === 'group' ? t('groupInfo') : t('viewProfile')}
        </ContextMenuItem>

        {otherUserId && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={handleBlock}>
              {relationship?.iBlocked ? <ShieldOff className="size-4" /> : <Ban className="size-4" />}
              {relationship?.iBlocked ? t('unblockAction') : t('blockAction')}
            </ContextMenuItem>
          </>
        )}

        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={handleDelete}>
          <Trash2 className="size-4" />
          {t('deleteConversation')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export const ConversationItem = memo(
  ConversationItemInner,
  (prev, next) =>
    prev.conversation.id === next.conversation.id &&
    prev.conversation.lastMessageAt === next.conversation.lastMessageAt &&
    prev.conversation.unreadCount === next.conversation.unreadCount &&
    prev.conversation.lastMessage?.content === next.conversation.lastMessage?.content &&
    prev.conversation.isMuted === next.conversation.isMuted &&
    prev.conversation.isArchived === next.conversation.isArchived,
)
