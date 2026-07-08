'use client'

import { useEffect, useState } from 'react'
import { Search, MessageSquare, Archive, UserX, MessageSquarePlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConversationItem } from './ConversationItem'
import { ArchivedConversationList } from './ArchivedConversationList'
import { ConversationRequestItem } from './ConversationRequestItem'
import { NewConversationModal } from './NewConversationModal'
import { PublicChannelsModal } from './PublicChannelsModal'
import { useConversations } from '@/lib/hooks/use-conversations'
import { useUiStore } from '@/lib/store/ui.store'
import { useAuthStore } from '@/lib/store/auth.store'
import { getNickname } from '@/lib/nicknames'
import { authService } from '@/lib/api/auth'
import { AI_BOT_ID } from '@/lib/constants'
import type { Conversation } from '@/lib/api/types'

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

function RequestsBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-semibold rounded-full bg-destructive text-destructive-foreground">
      {count > 9 ? '9+' : count}
    </span>
  )
}

export function ConversationList() {
  const t = useTranslations('chat')
  const [search, setSearch] = useState('')
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

  // --- Tab filters ---

  // Chats tab: exclude archived, blocked, and any pending conversations the
  // current user did NOT initiate (pending DM from stranger, or group invites).
  const chatsFiltered = conversations?.filter((conv) => {
    if (conv.isArchived || conv.isBlocked) return false
    if (conv.status === 'pending' && conv.createdBy !== currentUserId) return false
    if (conv.pendingMembers?.includes(currentUserId ?? '')) return false
    if (!search) return true
    const q = search.toLowerCase()
    return resolveSearchTerms(conv).some((term) => term.toLowerCase().includes(q))
  }) ?? []

  // Requests tab: pending DMs from strangers + group invites
  const requestsFiltered = conversations?.filter((conv) => {
    const isPendingDm =
      conv.type === 'direct' &&
      conv.status === 'pending' &&
      conv.createdBy !== currentUserId
    const isPendingGroup = !!conv.pendingMembers?.includes(currentUserId ?? '')
    return isPendingDm || isPendingGroup
  }) ?? []

  const requestCount = requestsFiltered.length

  // Batch-prefetch all participant profiles in ONE request, then seed the
  // per-id (`['user', id]`) cache so ConversationItem's useUser reads from
  // cache instead of firing a query per participant (was an N+1 → 429s).
  useEffect(() => {
    if (!conversations || !currentUserId) return
    const ids = [
      ...new Set(
        conversations
          .flatMap((c) => c.participants)
          .filter((id) => id !== currentUserId && id !== AI_BOT_ID),
      ),
    ]
    const missing = ids.filter((id) => !queryClient.getQueryData(['user', id]))
    if (missing.length === 0) return
    let cancelled = false
    authService
      .getUsers(missing)
      .then((users) => {
        if (cancelled) return
        users.forEach((u) => queryClient.setQueryData(['user', u.id], u))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [conversations, currentUserId, queryClient])

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
        <div className="hidden @[300px]:block px-3 py-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        <Tabs defaultValue="chats" className="flex flex-col flex-1 min-h-0">
          {/* Chats tab */}
          <TabsContent value="chats" className="flex-1 overflow-y-auto px-2 pb-2 mt-0">
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

            {!isLoading && !isError && chatsFiltered.length === 0 && (
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

            {chatsFiltered.map((conv) => (
              <ConversationItem key={conv.id} conversation={conv} />
            ))}
          </TabsContent>

          {/* Archived tab */}
          <TabsContent value="archived" className="flex-1 overflow-y-auto px-2 pb-2 mt-0">
            <ArchivedConversationList searchQuery={search} />
          </TabsContent>

          {/* Requests tab */}
          <TabsContent value="requests" className="flex-1 overflow-y-auto px-2 pb-2 mt-0">
            {isLoading && (
              <div className="space-y-1 px-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <ConversationSkeleton key={i} />
                ))}
              </div>
            )}

            {isError && (
              <div className="flex items-center justify-center py-8 text-sm text-destructive">
                {t('loadError')}
              </div>
            )}

            {!isLoading && !isError && requestsFiltered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <UserX className="size-8 opacity-40" />
                <p className="text-sm">{t('noRequests')}</p>
              </div>
            )}

            {!isError && requestsFiltered.map((conv) => (
              <ConversationRequestItem key={conv.id} conversation={conv} />
            ))}
          </TabsContent>

          {/* ── Tab bar ── Desktop: compact at top; Mobile: full-height at bottom ── */}
          <div
            className="shrink-0 order-last md:order-first border-t md:border-t-0 md:border-b bg-background/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-stretch h-14 md:h-auto md:px-3 md:py-1.5">
              <TabsList className="flex-1 flex md:grid md:grid-cols-3 rounded-none md:rounded-md h-14 md:h-auto bg-transparent md:bg-muted p-0 md:p-1 mx-0 md:mx-3">
                <TabsTrigger
                  value="chats"
                  className="flex-1 flex-col md:flex-row gap-0.5 md:gap-1 text-[10px] md:text-xs h-full md:h-auto rounded-none md:rounded-sm px-2"
                >
                  <MessageSquare className="size-5 md:size-3.5 shrink-0" />
                  <span className="hidden @[300px]:inline">{t('tabChats')}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="archived"
                  className="flex-1 flex-col md:flex-row gap-0.5 md:gap-1 text-[10px] md:text-xs h-full md:h-auto rounded-none md:rounded-sm px-2"
                >
                  <Archive className="size-5 md:size-3.5 shrink-0" />
                  <span className="hidden @[300px]:inline">{t('tabArchived')}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="requests"
                  className="flex-1 flex-col md:flex-row gap-0.5 md:gap-1 text-[10px] md:text-xs h-full md:h-auto rounded-none md:rounded-sm px-2"
                >
                  <UserX className="size-5 md:size-3.5 shrink-0" />
                  <span className="relative">
                    <span className="hidden @[300px]:inline">{t('tabRequests')}</span>
                    <RequestsBadge count={requestCount} />
                  </span>
                </TabsTrigger>
              </TabsList>

              {/* "+ New" — MOBILE ONLY (desktop has the + button in the sidebar header) */}
              <button
                onClick={() => openNewChat('direct')}
                className="md:hidden flex flex-col items-center justify-center gap-0.5 px-4 text-muted-foreground hover:text-foreground transition-colors border-l border-border"
                title={t('newConversation')}
              >
                <MessageSquarePlus className="size-5 shrink-0" />
                <span className="text-[10px]">{t('new')}</span>
              </button>
            </div>
          </div>
        </Tabs>
      </div>
    </>
  )
}
