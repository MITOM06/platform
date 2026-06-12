'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArchiveRestore, Archive, Loader2, Search, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { chatService } from '@/lib/api/chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function ArchivedChatsPage() {
  const t = useTranslations('archived')
  const router = useRouter()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')

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

  const conversations = response?.content || []

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true
    const name = conv.name ?? t('defaultName')
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="h-14 flex items-center px-4 border-b shrink-0 gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="p-4 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            className="pl-9 bg-muted/50 border-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-3">
            <Archive className="size-16 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? t('noResults') : t('empty')}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const name = conv.name ?? t('defaultName')
            const avatar = conv.avatarUrl
            const isUnarchiving = unarchiveMutation.isPending && unarchiveMutation.variables === conv.id

            return (
              <div
                key={conv.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer"
                onClick={() => router.push(`/conversations/${conv.id}`)}
              >
                <Avatar className="size-12 shrink-0">
                  {avatar ? (
                    <AvatarImage src={avatar} alt={name} className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{name}</h3>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {conv.type === 'group' ? (
                      <MessageSquare className="size-3" />
                    ) : null}
                    {conv.lastMessage?.content || t('noMessages')}
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
          })
        )}
      </div>
    </div>
  )
}
