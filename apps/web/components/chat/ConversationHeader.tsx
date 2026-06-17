'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Bot, Settings, Phone, Video } from 'lucide-react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useConversation } from '@/lib/hooks/use-conversation'
import { useUserStatus } from '@/lib/hooks/use-user-status'
import { useAuthStore } from '@/lib/store/auth.store'
import { useUser } from '@/lib/hooks/use-user'
import type { Conversation } from '@/lib/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { PinnedMessagesBar } from './PinnedMessagesBar'
import { ConversationSettingsDrawer } from './ConversationSettingsDrawer'
import { GroupSettingsDrawer } from './GroupSettingsDrawer'
import { SharedMediaGallery } from './SharedMediaGallery'
import { UserProfileDrawer } from './UserProfileDrawer'
import { callManager } from '@/lib/webrtc/call-manager'
import { useNickname } from '@/lib/nicknames'
import { cn } from '@/lib/utils'

const AI_BOT_ID = 'ai-bot-000000000000000000000001'

interface Props {
  conversationId: string
  typingUserIds: string[]
  onSearchToggle: () => void
}

function getInitial(name: string): string {
  return name[0]?.toUpperCase() ?? '?'
}

export function ConversationHeader({
  conversationId,
  typingUserIds,
  onSearchToggle,
}: Props) {
  const t = useTranslations('chat')
  const { data: conversation } = useConversation(conversationId)
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const isAI = conversation?.participants.includes(AI_BOT_ID) ?? false
  const isGroup = conversation?.type === 'group'
  const otherUserId =
    !isAI && !isGroup && conversation?.type === 'direct'
      ? conversation.participants.find((id) => id !== currentUser?.id)
      : undefined

  const { data: status } = useUserStatus(otherUserId)
  const { data: otherUser } = useUser(otherUserId)
  const nickname = useNickname(conversationId, otherUserId)

  const displayName =
    nickname ??
    conversation?.name ??
    (isAI ? t('aiAssistant') : (otherUser?.displayName ?? t('conversationDefault')))
  const avatarUrl = conversation?.avatarUrl ?? otherUser?.avatarUrl
  const isTyping = typingUserIds.length > 0
  const pinnedMessages = conversation?.pinnedMessages ?? []

  const handleUnpin = (messageId: string) => {
    queryClient.setQueryData(
      ['conversation', conversationId],
      (old: Conversation | undefined) =>
        old
          ? { ...old, pinnedMessages: old.pinnedMessages.filter((m) => m.id !== messageId) }
          : old,
    )
  }

  return (
    <div className="shrink-0">
      <header className="h-14 border-b px-4 flex items-center gap-3 bg-background">
        <Link
          href="/conversations"
          className="text-muted-foreground hover:text-foreground transition-colors p-2 -m-2 rounded-full"
        >
          <ArrowLeft className="size-5" />
        </Link>

        <button
          type="button"
          className="relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onClick={() => {
            if (isGroup) setGroupSettingsOpen(true)
            else if (otherUserId) setProfileOpen(true)
          }}
          title={isGroup ? t('groupInfoTooltip') : t('viewProfileTooltip')}
        >
          <Avatar className="size-9 shrink-0">
            {isAI ? (
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                <Bot className="size-4" />
              </AvatarFallback>
            ) : (
              <>
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="text-sm font-medium">
                  {getInitial(displayName)}
                </AvatarFallback>
              </>
            )}
          </Avatar>
          {otherUserId && status?.online && (
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-[#00E676] border-2 border-background shadow-[0_0_6px_rgba(0,230,118,0.6)]" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'font-medium text-sm truncate',
                (isGroup || otherUserId) && 'cursor-pointer hover:underline',
              )}
              onClick={() => {
                if (isGroup) setGroupSettingsOpen(true)
                else if (otherUserId) setProfileOpen(true)
              }}
            >
              {displayName}
            </span>
            {isAI && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
                AI
              </span>
            )}
          </div>
          {isTyping ? (
            <p className="text-xs text-pon-cyan font-medium animate-pulse">{t('typing')}</p>
          ) : otherUserId && status ? (
            <p className="text-xs text-muted-foreground">
              {status.online ? t('online') : t('offline')}
            </p>
          ) : isGroup ? (
            <p className="text-xs text-muted-foreground">
              {t('membersCount', { count: conversation?.participants.length ?? 0 })}
            </p>
          ) : null}
        </div>

        {/* Header action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {otherUserId && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => callManager.startCall(otherUserId, displayName, conversationId, false)}
                title={t('voiceCall')}
              >
                <Phone className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => callManager.startCall(otherUserId, displayName, conversationId, true)}
                title={t('videoCall')}
              >
                <Video className="size-4" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => isGroup ? setGroupSettingsOpen(true) : setSettingsOpen(true)}
            title={t('settingsTooltip')}
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </header>

      {/* Pinned messages bar */}
      <PinnedMessagesBar pinnedMessages={pinnedMessages} onUnpin={handleUnpin} />

      {/* Drawers & modals */}
      {conversation && currentUser && (
        <>
          <ConversationSettingsDrawer
            conversation={conversation}
            currentUserId={currentUser.id}
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenGroupInfo={() => setGroupSettingsOpen(true)}
            onSearch={onSearchToggle}
            onOpenSharedMedia={() => setGalleryOpen(true)}
          />
          {isGroup && (
            <GroupSettingsDrawer
              conversation={conversation}
              currentUserId={currentUser.id}
              open={groupSettingsOpen}
              onClose={() => setGroupSettingsOpen(false)}
            />
          )}
        </>
      )}
      <SharedMediaGallery
        conversationId={conversationId}
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
      />
      <UserProfileDrawer
        userId={profileOpen ? (otherUserId ?? null) : null}
        onClose={() => setProfileOpen(false)}
      />
    </div>
  )
}
