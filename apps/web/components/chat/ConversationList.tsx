'use client'

import { useState } from 'react'
import { Search, MessageSquare, Bot } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConversationItem } from './ConversationItem'
import { NewConversationModal } from './NewConversationModal'
import { PublicChannelsModal } from './PublicChannelsModal'
import { useConversations } from '@/lib/hooks/use-conversations'
import { useUiStore } from '@/lib/store/ui.store'
import { useAuthStore } from '@/lib/store/auth.store'
import { getNickname } from '@/lib/nicknames'
import { OfflineBanner } from './OfflineBanner'
import { chatService } from '@/lib/api/chat'
import type { Conversation } from '@/lib/api/types'

const AI_BOT_ID = 'ai-bot-000000000000000000000001'

function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-3 rounded-lg">
      <Skeleton className="size-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <Skeleton className="h-3.5 w-28 rounded" />
        <Skeleton className="h-3 w-40 rounded" />
      </div>
    </div>
  )
}

export function ConversationList() {
  const t = useTranslations('chat')
  const [search, setSearch] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const { data: conversations, isLoading, isError } = useConversations()
  const {
    showNewChatModal,
    showPublicChannelsModal,
    defaultChatTab,
    closeNewChat,
    closePublicChannels,
    openNewChat,
  } = useUiStore()

  const handleOpenAiChat = async () => {
    if (aiLoading) return
    setAiLoading(true)
    try {
      const conv = await chatService.createConversation(AI_BOT_ID)
      router.push(`/conversations/${conv.id}`)
    } catch (err) {
      // 409 = conversation already exists — find and navigate to it
      const isConflict = (err as { response?: { status?: number } })?.response?.status === 409
      if (isConflict) {
        const body = (err as { response?: { data?: { conversationId?: string } } })?.response?.data
        if (body?.conversationId) {
          router.push(`/conversations/${body.conversationId}`)
          return
        }
      }
      toast.error(t('aiOpenError'))
    } finally {
      setAiLoading(false)
    }
  }

  // Resolve the name shown for a conversation in the sidebar — mirrors
  // ConversationItem so search matches exactly what the user sees: group name,
  // or (for 1:1) the peer's nickname / cached displayName.
  const resolveSearchTerms = (conv: Conversation): string[] => {
    const terms: string[] = []
    if (conv.name) terms.push(conv.name)
    if (conv.type === 'direct' && !conv.participants.includes(AI_BOT_ID)) {
      const peerId = conv.participants.find((id) => id !== currentUserId)
      if (peerId) {
        const nick = getNickname(conv.id, peerId)
        if (nick) terms.push(nick)
        const cached = queryClient.getQueryData<{ displayName?: string }>(['user', peerId])
        if (cached?.displayName) terms.push(cached.displayName)
      }
    }
    return terms
  }

  const filtered = conversations?.filter((conv) => {
    if (!search) return true
    const q = search.toLowerCase()
    return resolveSearchTerms(conv).some((term) => term.toLowerCase().includes(q))
  })

  return (
    <>
      <NewConversationModal
        open={showNewChatModal}
        onClose={closeNewChat}
        defaultTab={defaultChatTab}
      />
      <PublicChannelsModal
        open={showPublicChannelsModal}
        onClose={closePublicChannels}
      />

      <div className="flex flex-col h-full">
        <div className="px-3 py-2 shrink-0 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenAiChat}
            title={t('chatWithAI')}
            disabled={aiLoading}
            className="shrink-0 h-9 w-9"
          >
            <Bot className="size-4" />
          </Button>
        </div>

        <OfflineBanner />

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {isLoading && (
            <div className="space-y-1 px-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <ConversationSkeleton key={i} />
              ))}
            </div>
          )}

          {isError && (
            <div className="flex items-center justify-center py-8 text-sm text-destructive">
              {t('loadError')}
            </div>
          )}

          {!isLoading && !isError && filtered?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <MessageSquare className="size-8 opacity-40" />
              <p className="text-sm">
                {search ? t('noResults') : t('noConversations')}
              </p>
              {!search && (
                <Button variant="outline" size="sm" onClick={() => openNewChat('direct')}>
                  {t('startConversation')}
                </Button>
              )}
            </div>
          )}

          {filtered?.map((conv) => (
            <ConversationItem key={conv.id} conversation={conv} />
          ))}
        </div>
      </div>
    </>
  )
}
