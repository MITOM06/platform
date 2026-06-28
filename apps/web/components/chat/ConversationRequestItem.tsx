'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { chatService } from '@/lib/api/chat'
import { absoluteMediaUrl } from '@/lib/media'
import { humanizeSystemMessage } from '@/lib/system-messages'
import { useAuthStore } from '@/lib/store/auth.store'
import { useUser } from '@/lib/hooks/use-user'
import { useNickname } from '@/lib/nicknames'
import { getInitials } from '@/lib/utils'
import { AI_BOT_ID } from '@/lib/constants'
import type { Conversation } from '@/lib/api/types'

interface Props {
  conversation: Conversation
}

export function ConversationRequestItem({ conversation: conv }: Props) {
  const t = useTranslations('chat')
  const router = useRouter()
  const queryClient = useQueryClient()
  const currentUserId = useAuthStore((s) => s.user?.id)

  const isGroupInvite = !!conv.pendingMembers?.includes(currentUserId ?? '')

  // For DMs resolve the peer's display name; for groups use conv.name
  const otherUserId =
    !isGroupInvite && conv.type === 'direct'
      ? conv.participants.find((id) => id !== currentUserId && id !== AI_BOT_ID)
      : undefined

  const { data: otherUser } = useUser(otherUserId)
  const otherNickname = useNickname(conv.id, otherUserId)

  // Never show a raw ObjectId — fall back to generic localized label
  const displayName = isGroupInvite
    ? (conv.name || t('conversationDefault'))
    : (otherNickname || otherUser?.displayName || t('userFallback'))

  const avatarUrl = isGroupInvite
    ? (conv.avatarUrl ? absoluteMediaUrl(conv.avatarUrl) : null)
    : (otherUser?.avatarUrl ? absoluteMediaUrl(otherUser.avatarUrl) : null)

  const subtitle = isGroupInvite ? t('groupInviteSubtitle') : t('dmRequestSubtitle')

  // Humanize last-message preview — never render raw system codes or IDs
  let previewText = t('noMessagesYet')
  if (conv.lastMessage?.content) {
    previewText = humanizeSystemMessage(conv.lastMessage.content, t, { short: true })
  }

  const invalidateConversations = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }

  const acceptMutation = useMutation({
    mutationFn: () => chatService.acceptConversation(conv.id),
    onSuccess: () => {
      invalidateConversations()
      router.push(`/conversations/${conv.id}`)
    },
    onError: () => {
      toast.error(t('actionError'))
    },
  })

  const declineMutation = useMutation({
    mutationFn: () => {
      if (isGroupInvite) {
        // Leave the group (removeMember with self) — never fall through to
        // deleteConversation, which would delete the whole group.
        if (!currentUserId) throw new Error('Not authenticated')
        return chatService.removeMember(conv.id, currentUserId)
      }
      // Decline a DM request → delete the conversation
      return chatService.deleteConversation(conv.id).then(() => undefined)
    },
    onSuccess: () => {
      invalidateConversations()
    },
    onError: () => {
      toast.error(t('actionError'))
    },
  })

  const isPending = acceptMutation.isPending || declineMutation.isPending

  return (
    <div
      className="flex items-start gap-3 px-2 py-3 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer"
      onClick={() => router.push(`/conversations/${conv.id}`)}
    >
      <Avatar className="size-10 shrink-0 mt-0.5">
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
        ) : null}
        <AvatarFallback className="text-sm font-medium">
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate">{displayName}</span>
          {isGroupInvite && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
              {t('groupLabel')}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{previewText}</p>

        <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs"
            disabled={isPending}
            onClick={() => acceptMutation.mutate()}
          >
            {t('acceptRequest')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={isPending}
            onClick={() => declineMutation.mutate()}
          >
            {t('declineRequest')}
          </Button>
        </div>
      </div>
    </div>
  )
}
