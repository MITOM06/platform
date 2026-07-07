'use client'

import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { chatService } from '@/lib/api/chat'
import { absoluteMediaUrl } from '@/lib/media'
import { humanizeSystemMessage } from '@/lib/system-messages'
import { useAuthStore } from '@/lib/store/auth.store'
import { useUser } from '@/lib/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Conversation } from '@/lib/api/types'

interface Props {
  /** If provided, filter conversations by this search string. */
  searchQuery?: string
}

interface RowProps {
  conv: Conversation
  onUnarchive: (id: string) => void
  isUnarchiving: boolean
}

/**
 * One archived-conversation row. Extracted so it can call `useUser()` per item:
 * DM conversations have `conv.name === null` (the server never embeds the peer's
 * name), so we resolve the other participant's display name the same way
 * ConversationItem does, instead of falling back to "Conversation".
 */
function ArchivedConversationRow({ conv, onUnarchive, isUnarchiving }: RowProps) {
  const t = useTranslations('archived')
  const tChat = useTranslations('chat')
  const router = useRouter()
  const currentUser = useAuthStore((s) => s.user)

  const isGroup = conv.type === 'group'
  const otherUserId = !isGroup
    ? conv.participants.find((uid) => uid !== currentUser?.id)
    : undefined

  const { data: otherUser } = useUser(otherUserId)

  const name =
    conv.name ??
    (isGroup ? t('groupFallback') : (otherUser?.displayName ?? t('defaultName')))
  const avatar = conv.avatarUrl ? absoluteMediaUrl(conv.avatarUrl) : null

  let previewText = tChat('noMessagesYet')
  if (conv.lastMessage?.content) {
    previewText = humanizeSystemMessage(conv.lastMessage.content, tChat, { short: true })
  }

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer"
      onClick={() => router.push(`/conversations/${conv.id}`)}
    >
      <Avatar className="size-10 shrink-0">
        {avatar ? (
          <AvatarImage src={avatar} alt={name} className="object-cover" />
        ) : (
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        )}
      </Avatar>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm truncate">{name}</h3>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          {isGroup ? <MessageSquare className="size-3 shrink-0" /> : null}
          {previewText}
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        disabled={isUnarchiving}
        onClick={(e) => {
          e.stopPropagation()
          onUnarchive(conv.id)
        }}
        title={t('unarchive')}
      >
        {isUnarchiving ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArchiveRestore className="size-4" />
        )}
      </Button>
    </div>
  )
}

export function ArchivedConversationList({ searchQuery = '' }: Props) {
  const t = useTranslations('archived')
  const queryClient = useQueryClient()

  const { data: response, isLoading } = useQuery({
    queryKey: ['conversations', 'archived'],
    queryFn: () => chatService.getConversations(true),
  })

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => chatService.unarchiveConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success(t('unarchiveSuccess'))
    },
    onError: () => {
      toast.error(t('unarchiveError'))
    },
  })

  const conversations = response?.content ?? []

  const filtered = conversations.filter((conv) => {
    if (!searchQuery) return true
    const name = conv.name ?? t('defaultName')
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <Archive className="size-8 opacity-40" />
        <p className="text-sm">
          {searchQuery ? t('noResults') : t('empty')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {filtered.map((conv) => (
        <ArchivedConversationRow
          key={conv.id}
          conv={conv}
          onUnarchive={(id) => unarchiveMutation.mutate(id)}
          isUnarchiving={unarchiveMutation.isPending && unarchiveMutation.variables === conv.id}
        />
      ))}
    </div>
  )
}
