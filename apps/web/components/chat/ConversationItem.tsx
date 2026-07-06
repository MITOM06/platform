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
import { authService } from '@/lib/api/auth'
import { humanizeSystemMessage } from '@/lib/system-messages'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import type { Conversation } from '@/lib/api/types'

const AI_BOT_ID = 'ai-bot-000000000000000000000001'

/** epoch ms value chat-service uses for "muted forever" (Long.MAX_VALUE proxy) */
const MUTE_FOREVER_MS = 9_200_000_000_000_000

interface Props {
  conversation: Conversation
  /** When true the item is in the Blocked section: show Unblock, hide Block */
  isBlocked?: boolean
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

/** Returns a short human-readable remaining time string for mute expiry. */
function formatMuteExpiry(expiresAt: number): string {
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return ''
  const mins = Math.ceil(remaining / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(remaining / 3_600_000)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

const MUTE_OPTIONS = [
  { labelKey: 'mute15min',   seconds: 900   },
  { labelKey: 'mute30min',   seconds: 1800  },
  { labelKey: 'mute1hour',   seconds: 3600  },
  { labelKey: 'mute24hours', seconds: 86400 },
  { labelKey: 'muteForever', seconds: -1    },
] as const

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

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    queryClient.invalidateQueries({ queryKey: ['blocked-conversations'] })
  }

  const run = async (fn: () => Promise<unknown>, errorKey: string) => {
    try {
      await fn()
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch {
      toast.error(t(errorKey))
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
    } catch {
      toast.error(t('actionFailed'))
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
              ? 'bg-primary/[0.08] shadow-[inset_2px_0_0_0_#6AC9FF]'
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
            {conv.unreadCount > 0 && (
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
                        {formatMuteExpiry(conv.muteExpiresAt!)}
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

        {/* Mute: single unmute item when already muted, submenu when not */}
        {conv.isMuted ? (
          <ContextMenuItem onClick={handleUnmute}>
            <Volume2 className="size-4" />
            <span>{t('unmuteNotifications')}</span>
            {showMuteExpiry && (
              <span className="ml-auto text-xs text-muted-foreground">
                {formatMuteExpiry(conv.muteExpiresAt!)}
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

export const ConversationItem = memo(
  ConversationItemInner,
  (prev, next) =>
    prev.conversation.id === next.conversation.id &&
    prev.conversation.lastMessageAt === next.conversation.lastMessageAt &&
    prev.conversation.unreadCount === next.conversation.unreadCount &&
    prev.conversation.lastMessage?.content === next.conversation.lastMessage?.content &&
    prev.conversation.isMuted === next.conversation.isMuted &&
    prev.conversation.muteExpiresAt === next.conversation.muteExpiresAt &&
    prev.conversation.isArchived === next.conversation.isArchived &&
    prev.conversation.isBlocked === next.conversation.isBlocked &&
    prev.isBlocked === next.isBlocked,
)
