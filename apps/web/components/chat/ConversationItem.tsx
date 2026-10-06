'use client'

import { memo, useState } from 'react'
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
  ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger,
} from '@/components/ui/context-menu'
import { useAuthStore } from '@/lib/store/auth.store'
import { useUser } from '@/lib/hooks/use-user'
import { useAssistant } from '@/lib/hooks/use-assistant'
import { useAssistantName } from '@/lib/hooks/use-capabilities'
import { useRelationship } from '@/lib/hooks/use-relationship'
import { useNickname } from '@/lib/nicknames'
import { chatService } from '@/lib/api/chat'
import { chatErrorMessage } from '@/lib/api/chat-errors'
import { authService } from '@/lib/api/auth'
import { humanizeLastMessage } from '@/lib/system-messages'
import { useNameResolver } from '@/lib/hooks/use-display-names'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  AI_BOT_ID, MUTE_FOREVER_MS, MUTE_OPTIONS,
  getInitials, formatTime, formatMuteExpiry,
} from './conversation-item-helpers'
import type { Conversation } from '@/lib/api/types'

interface Props {
  conversation: Conversation
  /** When true the item is in the Blocked section: show Unblock, hide Block */
  isBlocked?: boolean
}

const ConversationItemInner = function ConversationItem({ conversation: conv, isBlocked = false }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('chat')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false)
  const isActive = pathname === `/conversations/${conv.id}`
  const currentUser = useAuthStore((s) => s.user)

  const isAI = conv.participants.includes(AI_BOT_ID)
  // Bot Factory personal assistants join as `extbot:*` participants — treat them
  // as bots too (badge + bot avatar), just with the assistant's own name.
  const isExtBot = !isAI && conv.participants.some((p) => p.startsWith('extbot:'))
  const isAnyBot = isAI || isExtBot
  const otherUserId =
    !isAnyBot && conv.type === 'direct'
      ? conv.participants.find((id) => id !== currentUser?.id)
      : undefined

  const { data: otherUser } = useUser(otherUserId)
  const otherNickname = useNickname(conv.id, otherUserId)
  const { relationship } = useRelationship(otherUserId)
  const assistantName = useAssistantName()
  // The member's own personal assistant (the extbot in this 1-1) — name/avatar
  // come from the assistant mapping, not a user lookup.
  const { data: extBotAssistant } = useAssistant()

  const displayName =
    conv.name ??
    (isAI
      ? (assistantName ?? t('aiAssistant'))
      : isExtBot
        ? (extBotAssistant?.name ?? t('aiAssistant'))
        : (otherNickname || otherUser?.displayName || t('conversationDefault')))
  const avatarUrl = conv.avatarUrl ?? otherUser?.avatarUrl

  // Sidebar preview: "You: <msg>" for own last message in direct chats, with
  // system-codes/attachments humanised and recalled messages shown as recalled
  // (mirror Flutter conversation_tile).
  const resolveName = useNameResolver(conv.id)
  const lastMessage = conv.lastMessage
  const humanized = humanizeLastMessage(lastMessage, t, {
    resolveName,
    currentUserId: currentUser?.id,
  })
  let previewText = humanized ?? t('noMessagesYet')
  if (humanized && lastMessage && !lastMessage.recalled) {
    const isOwn = lastMessage.senderId === currentUser?.id
    const isPlainOwn =
      isOwn && conv.type === 'direct' && !lastMessage.content.startsWith('system.')
    if (isPlainOwn) previewText = `${t('youColon')}${humanized}`
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    queryClient.invalidateQueries({ queryKey: ['blocked-conversations'] })
  }

  const run = async (fn: () => Promise<unknown>, errorKey: string) => {
    try {
      await fn()
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (err) {
      toast.error(chatErrorMessage(err, t, errorKey))
    }
  }

  const handleMarkRead = () => run(() => chatService.markConversationRead(conv.id), 'actionFailed')
  const handleMarkUnread = () => run(() => chatService.markConversationUnread(conv.id), 'actionFailed')

  const handleUnmute = () =>
    run(() => chatService.unmuteConversation(conv.id), 'actionFailed')

  const handleMuteWithDuration = async (seconds: number) => {
    try {
      await chatService.muteConversation(conv.id, seconds)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success(t('muteSuccess'))
    } catch (err) {
      toast.error(chatErrorMessage(err, t, 'actionFailed'))
    }
  }

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
      await authService.blockUser(otherUserId)
      await chatService.blockArchiveConversation(conv.id)
      invalidateAll()
      toast.success(t('userBlocked'))
    } catch {
      toast.error(t('actionFailed'))
    }
  }

  /** Full unblock: used in the Blocked section (isBlocked=true). Restores the conversation. */
  const handleUnblock = async () => {
    if (!otherUserId) return
    try {
      await authService.unblockUser(otherUserId)
      await chatService.blockRestoreConversation(conv.id)
      invalidateAll()
      toast.success(t('userUnblocked'))
    } catch {
      toast.error(t('actionFailed'))
    }
  }

  /**
   * Unblock-only: used in the normal list when `relationship?.iBlocked` is true
   * but the conversation was never block-archived (i.e. `isBlocked` prop is false).
   * Only calls unblockUser — no blockRestoreConversation.
   */
  const handleUnblockOnly = async () => {
    if (!otherUserId) return
    try {
      await authService.unblockUser(otherUserId)
      invalidateAll()
      toast.success(t('userUnblocked'))
    } catch {
      toast.error(t('actionFailed'))
    }
  }

  const handleInfo = () => router.push(`/conversations/${conv.id}`)

  const showMuteExpiry =
    conv.isMuted &&
    typeof conv.muteExpiresAt === 'number' &&
    conv.muteExpiresAt < MUTE_FOREVER_MS

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          href={`/conversations/${conv.id}`}
          className={cn(
            'flex items-center gap-0 @[120px]:gap-3 justify-center @[120px]:justify-start px-3 py-3 rounded-lg transition-[background-color,transform] duration-[180ms] hover:bg-primary/5 active:scale-[0.98]',
            isActive
              ? 'bg-primary/[0.08] shadow-[inset_2px_0_0_0_var(--primary)]'
              : 'hover:bg-muted',
          )}
        >
          <div className="relative shrink-0">
            <Avatar className="size-10 shrink-0">
              {isAnyBot ? (
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
            {/* Compact rail: unread shows as a dot on the avatar (the full badge
                lives in the meta block, which is hidden when narrow). */}
            {conv.unreadCount > 0 && !isAnyBot && (
              <span className="@[120px]:hidden absolute -top-0.5 -right-0.5 size-3 rounded-full bg-primary border-2 border-background" />
            )}
          </div>

          <div className="hidden @[120px]:block flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-sm truncate">{displayName}</span>
                {isAnyBot && (
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
                    AI
                  </span>
                )}
                {isBlocked && <Ban className="size-3 text-destructive/60 shrink-0" />}
                {conv.isMuted && (
                  <span className="flex items-center gap-0.5 text-muted-foreground shrink-0">
                    <VolumeX className="size-3" />
                    {showMuteExpiry && (
                      <span className="text-xs">
                        {formatMuteExpiry(conv.muteExpiresAt!, locale)}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatTime(conv.lastMessageAt, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <p className="text-xs text-muted-foreground truncate">
                {previewText}
              </p>
              {conv.unreadCount > 0 && !isAnyBot && (
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
        {/* Mark read/unread is meaningless on AI/extbot conversations — hide it. */}
        {!isAnyBot && (
          conv.unreadCount > 0 ? (
            <ContextMenuItem onClick={handleMarkRead}>
              <MailOpen className="size-4" />
              {t('markAsRead')}
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={handleMarkUnread}>
              <Mail className="size-4" />
              {t('markAsUnread')}
            </ContextMenuItem>
          )
        )}

        {/* Mute: single unmute item when already muted, submenu when not */}
        {conv.isMuted ? (
          <ContextMenuItem onClick={handleUnmute}>
            <Volume2 className="size-4" />
            <span>{t('unmuteNotifications')}</span>
            {showMuteExpiry && (
              <span className="ml-auto text-xs text-muted-foreground">
                {formatMuteExpiry(conv.muteExpiresAt!, locale)}
              </span>
            )}
          </ContextMenuItem>
        ) : (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <VolumeX className="size-4" />
              {t('muteNotifications')}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {MUTE_OPTIONS.map(({ labelKey, seconds }) => (
                <ContextMenuItem
                  key={seconds}
                  onClick={() => handleMuteWithDuration(seconds)}
                >
                  {t(labelKey)}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

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
            {isBlocked ? (
              <ContextMenuItem onClick={handleUnblock}>
                <ShieldOff className="size-4" />
                {t('unblockAndRestore')}
              </ContextMenuItem>
            ) : relationship?.iBlocked ? (
              <ContextMenuItem variant="destructive" onClick={handleUnblockOnly}>
                <ShieldOff className="size-4" />
                {t('unblockAction')}
              </ContextMenuItem>
            ) : (
              <ContextMenuItem variant="destructive" onClick={() => setBlockConfirmOpen(true)}>
                <Ban className="size-4" />
                {t('blockAndHide')}
              </ContextMenuItem>
            )}
          </>
        )}

        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={handleDelete}>
          <Trash2 className="size-4" />
          {t('deleteConversation')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

      <ConfirmDialog
        open={blockConfirmOpen}
        onOpenChange={setBlockConfirmOpen}
        title={t('blockConfirmTitle', { name: displayName })}
        description={t('blockConfirmDesc', { name: displayName })}
        confirmLabel={t('blockAction')}
        onConfirm={handleBlock}
      />
    </>
  )
}

// Every field the row renders must be compared: the comparator used to ignore
// name / avatar / participants / recall, so a renamed group or a new group photo
// never reached the sidebar until a reload. Merged cache updates keep untouched
// rows referentially equal, so the cheap identity check still skips most renders.
export const ConversationItem = memo(
  ConversationItemInner,
  (prev, next) => {
    if (prev.isBlocked !== next.isBlocked) return false
    const a = prev.conversation
    const b = next.conversation
    if (a === b) return true
    return (
      a.id === b.id &&
      a.name === b.name &&
      a.avatarUrl === b.avatarUrl &&
      a.type === b.type &&
      a.participants.join(',') === b.participants.join(',') &&
      a.lastMessageAt === b.lastMessageAt &&
      a.unreadCount === b.unreadCount &&
      a.lastMessage?.content === b.lastMessage?.content &&
      a.lastMessage?.senderId === b.lastMessage?.senderId &&
      a.lastMessage?.type === b.lastMessage?.type &&
      !!a.lastMessage?.recalled === !!b.lastMessage?.recalled &&
      a.isMuted === b.isMuted &&
      a.muteExpiresAt === b.muteExpiresAt &&
      a.isArchived === b.isArchived &&
      a.isBlocked === b.isBlocked
    )
  },
)
