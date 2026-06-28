'use client'

import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { chatService } from '@/lib/api/chat'
import { absoluteMediaUrl } from '@/lib/media'
import { humanizeSystemMessage } from '@/lib/system-messages'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface Props {
  /** If provided, filter conversations by this search string. */
  searchQuery?: string
}

export function ArchivedConversationList({ searchQuery = '' }: Props) {
  const t = useTranslations('archived')
  const tChat = useTranslations('chat')
  const router = useRouter()
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
      {filtered.map((conv) => {
        const name = conv.name ?? t('defaultName')
        const avatar = conv.avatarUrl ? absoluteMediaUrl(conv.avatarUrl) : null
        const isUnarchiving = unarchiveMutation.isPending && unarchiveMutation.variables === conv.id

        // Humanize last-message preview (mirrors ConversationItem previewText)
        let previewText = tChat('noMessagesYet')
        if (conv.lastMessage?.content) {
          previewText = humanizeSystemMessage(conv.lastMessage.content, tChat, { short: true })
        }

        return (
          <div
            key={conv.id}
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
                {conv.type === 'group' ? <MessageSquare className="size-3 shrink-0" /> : null}
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
                unarchiveMutation.mutate(conv.id)
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
      })}
    </div>
  )
}
