'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Bot, Settings, Phone, Video, Users, MoreVertical } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useConversation } from '@/lib/hooks/use-conversation'
import { useUserStatus } from '@/lib/hooks/use-user-status'
import { useAuthStore } from '@/lib/store/auth.store'
import { useUser } from '@/lib/hooks/use-user'
import { useAssistant } from '@/lib/hooks/use-assistant'
import { useAssistantName } from '@/lib/hooks/use-capabilities'
import type { Conversation } from '@/lib/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { PinnedMessagesBar } from './PinnedMessagesBar'
import { ConversationSettingsDrawer } from './ConversationSettingsDrawer'
import { GroupSettingsDrawer } from './GroupSettingsDrawer'
import { SharedMediaGallery } from './SharedMediaGallery'
import { UserProfileDrawer } from './UserProfileDrawer'
import { StartCallSheet } from '@/components/call/StartCallSheet'
import { useNickname } from '@/lib/nicknames'
import { absoluteMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

const AI_BOT_ID = 'ai-bot-000000000000000000000001'

// Lazy-load the WebRTC stack only when the user actually starts a call, so the
// RTCPeerConnection code stays out of the conversation route's initial bundle.
function startCall(
  otherUserId: string,
  displayName: string,
  conversationId: string,
  video: boolean,
) {
  void import('@/lib/webrtc/call-manager').then((m) =>
    m.callManager.startCall(otherUserId, displayName, conversationId, video),
  )
}

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
  const router = useRouter()
  const { data: conversation } = useConversation(conversationId)
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [startCallOpen, setStartCallOpen] = useState(false)

  const isAI = conversation?.participants.includes(AI_BOT_ID) ?? false
  // Bot Factory personal assistants join as `extbot:*` participants.
  const isExtBot =
    !isAI && (conversation?.participants.some((p) => p.startsWith('extbot:')) ?? false)
  const isAnyBot = isAI || isExtBot
  const isGroup = conversation?.type === 'group'
  const otherUserId =
    !isAnyBot && !isGroup && conversation?.type === 'direct'
      ? conversation.participants.find((id) => id !== currentUser?.id)
      : undefined

  const { data: status } = useUserStatus(otherUserId)
  const { data: otherUser } = useUser(otherUserId)
  const nickname = useNickname(conversationId, otherUserId)
  const assistantName = useAssistantName()
  const { data: extBotAssistant } = useAssistant()

  const displayName =
    nickname ??
    conversation?.name ??
    (isAI
      ? (assistantName ?? t('aiAssistant'))
      : isExtBot
        ? (extBotAssistant?.name ?? t('aiAssistant'))
        : (otherUser?.displayName ?? t('conversationDefault')))
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
        {/* Mobile back button — returns to the conversation list. Navigating to
            /conversations flips the layout's isConversationOpen to false, so the
            sidebar (list) reclaims the screen on mobile. Hidden on desktop. */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 shrink-0 -ml-1"
          onClick={() => router.push('/conversations')}
          title={t('backToList')}
        >
          <ArrowLeft className="size-5" />
        </Button>
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
            {isAnyBot ? (
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                <Bot className="size-4" />
              </AvatarFallback>
            ) : (
              <>
                {avatarUrl && <AvatarImage src={absoluteMediaUrl(avatarUrl)} alt={displayName} />}
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
            {isAnyBot && (
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
          {/* Group call — always visible for group conversations */}
          {isGroup && !isAI && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStartCallOpen(true)}
              title={t('groupCall')}
              className="tap"
            >
              <Users className="size-4" />
            </Button>
          )}
          {/* Voice call — always visible for DMs */}
          {otherUserId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => startCall(otherUserId, displayName, conversationId, false)}
              title={t('voiceCall')}
              className="tap"
            >
              <Phone className="size-4" />
            </Button>
          )}

          {/* Desktop: video call inline — DM only */}
          {otherUserId && (
            <div className="hidden md:flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => startCall(otherUserId, displayName, conversationId, true)}
                title={t('videoCall')}
                className="tap"
              >
                <Video className="size-4" />
              </Button>
            </div>
          )}

          {/* Settings — always visible on all screen sizes */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => isGroup ? setGroupSettingsOpen(true) : setSettingsOpen(true)}
            title={t('settingsTooltip')}
            className="tap"
          >
            <Settings className="size-4" />
          </Button>

          {/* Mobile: overflow menu — DM only (video call is the sole overflowed action) */}
          {otherUserId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden tap"
                  aria-label={t('moreActions')}
                >
                  <MoreVertical className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => startCall(otherUserId, displayName, conversationId, true)}
                >
                  <Video className="size-4 mr-2" />
                  {t('videoCall')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Pinned messages bar */}
      <PinnedMessagesBar
        pinnedMessages={pinnedMessages}
        onUnpin={handleUnpin}
        conversationId={conversationId}
        currentUserId={currentUser?.id}
      />

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
      {isGroup && (
        <StartCallSheet
          open={startCallOpen}
          conversationId={conversationId}
          onClose={() => setStartCallOpen(false)}
        />
      )}
    </div>
  )
}
