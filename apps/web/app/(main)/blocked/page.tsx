'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Ban, Loader2, ShieldOff } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/lib/store/auth.store'
import { chatService } from '@/lib/api/chat'
import { absoluteMediaUrl } from '@/lib/media'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUser } from '@/lib/hooks/use-user'
import { getInitials } from '@/lib/utils'
import { AI_BOT_ID } from '@/lib/constants'
import type { Conversation } from '@/lib/api/types'

interface BlockedRowProps {
  conv: Conversation
  currentUserId: string | undefined
  onUnblock: (conv: Conversation, otherUserId: string) => void
  isPending: boolean
}

function BlockedRow({ conv, currentUserId, onUnblock, isPending }: BlockedRowProps) {
  const t = useTranslations('chat')

  // Blocking is a per-user/DM concept (the list is pre-filtered to direct
  // conversations), so the other user is always resolvable — same logic
  // ConversationItem uses for the isBlocked unblock path.
  const otherUserId = conv.participants.find(
    (id) => id !== currentUserId && id !== AI_BOT_ID,
  )

  const { data: otherUser } = useUser(otherUserId)

  // Never show raw ObjectId — fall back to localized generic label
  const displayName = conv.name ?? otherUser?.displayName ?? t('userFallback')
  const avatarUrl = conv.avatarUrl
    ? absoluteMediaUrl(conv.avatarUrl)
    : otherUser?.avatarUrl
      ? absoluteMediaUrl(otherUser.avatarUrl)
      : null

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group">
      <Avatar className="size-10 shrink-0">
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
          <Ban className="size-3 text-destructive/60 shrink-0" />
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 gap-1.5"
        disabled={isPending || !otherUserId}
        onClick={() => {
          if (otherUserId) onUnblock(conv, otherUserId)
        }}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ShieldOff className="size-3.5" />
        )}
        {t('unblockAndRestore')}
      </Button>
    </div>
  )
}

export default function BlockedChatsPage() {
  const t = useTranslations('chat')
  const tSettings = useTranslations('settings')
  const queryClient = useQueryClient()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const { data: response, isLoading } = useQuery({
    queryKey: ['conversations', 'blocked'],
    queryFn: () => chatService.getBlockedConversations(),
  })

  const unblockMutation = useMutation({
    mutationFn: async ({ conv, otherUserId }: { conv: Conversation; otherUserId: string }) => {
      await chatService.unblockUser(otherUserId)
      await chatService.blockRestoreConversation(conv.id)
    },
    onMutate: ({ conv }) => {
      setPendingId(conv.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversations', 'blocked'] })
      toast.success(t('userUnblocked'))
    },
    onError: () => {
      toast.error(t('unblockError'))
    },
    onSettled: () => {
      setPendingId(null)
    },
  })

  // Blocking is a per-user (DM) concept — only direct conversations can be
  // unblocked here, so filter out any non-direct rows to avoid dead-end items.
  const conversations = (response?.content ?? []).filter((c) => c.type === 'direct')

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="h-14 flex items-center px-4 border-b shrink-0 gap-3">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{tSettings('blockedChats')}</span>
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Ban className="size-8 opacity-40" />
            <p className="text-sm">{t('noBlockedChats')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((conv) => (
              <BlockedRow
                key={conv.id}
                conv={conv}
                currentUserId={currentUserId}
                onUnblock={(c, uid) => unblockMutation.mutate({ conv: c, otherUserId: uid })}
                isPending={pendingId === conv.id && unblockMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
