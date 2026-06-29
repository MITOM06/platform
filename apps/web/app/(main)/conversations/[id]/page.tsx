'use client'

import { use, useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store/auth.store'
import { stompService } from '@/lib/stomp/client'
import { chatService } from '@/lib/api/chat'
import { useMessages } from '@/lib/hooks/use-messages'
import { useConversation } from '@/lib/hooks/use-conversation'
import { useUser } from '@/lib/hooks/use-user'
import { useRelationship } from '@/lib/hooks/use-relationship'
import { useConversationStomp } from '@/lib/hooks/use-conversation-stomp'
import { ConversationHeader } from '@/components/chat/ConversationHeader'
import { MessageViewport } from '@/components/chat/MessageViewport'
import { MessageInput } from '@/components/chat/MessageInput'
import { MessageSearchPanel } from '@/components/chat/MessageSearchPanel'
import { StrangerRequestBanner } from '@/components/chat/StrangerRequestBanner'
import { BlockedComposerNotice } from '@/components/chat/BlockedComposerNotice'
import { AiTraceModal } from '@/components/chat/AiTraceModal'
import { ForwardMessageModal } from '@/components/chat/ForwardMessageModal'
import { ActiveCallBanner } from '@/components/call/ActiveCallBanner'
import { useCallStore } from '@/lib/store/call.store'
import { cn } from '@/lib/utils'
import { useWallpaper } from '@/lib/hooks/use-wallpaper'
import { useMessageCache } from '@/lib/hooks/use-message-cache'
import { applyNicknameSystemMessage } from '@/lib/nicknames'
import { applyQuickReactionSystemMessage } from '@/lib/quick-reaction'
import type { Message, MessageType } from '@/lib/api/types'
import { isExternalBot } from '@/lib/api/types'

interface Props {
  params: Promise<{ id: string }>
}

export default function ConversationPage({ params }: Props) {
  const { id } = use(params)
  const t = useTranslations('chat')
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)

  const [searchVisible, setSearchVisible] = useState(false)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null)
  const [traceMessageId, setTraceMessageId] = useState<string | null>(null)
  const groupCallId = useCallStore((s) => s.groupCallId)

  const { data: conversation } = useConversation(id)

  const pinnedMessages = useMemo(
    () => conversation?.pinnedMessages?.map((m) => m.id) ?? [],
    [conversation?.pinnedMessages],
  )
  const isGroup = conversation?.type === 'group'
  const isAI = conversation?.participants.includes('ai-bot-000000000000000000000001') ?? false
  const otherUserId = !isGroup && !isAI && conversation?.type === 'direct'
    ? conversation.participants.find((uid) => uid !== currentUser?.id)
    : undefined

  const { data: otherUser } = useUser(otherUserId)
  const { relationship, refetch: refetchRelationship } = useRelationship(otherUserId)

  const isPending = conversation?.type === 'direct' && conversation?.status === 'pending'
  const isInitiator = conversation?.createdBy === currentUser?.id
  const isBlocked = !!(relationship?.iBlocked || relationship?.blockedMe)

  const wp = useWallpaper(id)
  // True when a non-default wallpaper (image or gradient preset) is set — used to
  // hide the ambient glow spheres so they don't tint the chosen wallpaper.
  const hasWallpaper = wp.isImage || (!!wp.className && wp.className !== 'bg-background')

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(id)
  const messages = useMemo(() => data?.messages ?? [], [data?.messages])

  // Real-time wiring (STOMP subscriptions, AI streaming, group-call lifecycle,
  // typing + read receipts). Patches the TanStack Query cache, not refetch.
  const { typingUserIds, aiStream, setAiStream, activeCall, armAiWatchdog, clearAiStream } =
    useConversationStomp({ id, messages, currentUserId: currentUser?.id })

  const { patchMessage, appendMessage } = useMessageCache(id)

  // Personal assistant (Bot Factory) replies are synchronous (2–10s) with no
  // STOMP typing event, so synthesise one: if this is an external-bot DM and the
  // newest message is the member's own, the bot is preparing its reply. Clears
  // automatically when the bot's broadcast lands (it becomes the newest message).
  const isAssistantTyping = useMemo(() => {
    if (!isExternalBot(otherUserId ?? '')) return false
    const last = messages[messages.length - 1]
    return !!last && last.senderId === currentUser?.id
  }, [otherUserId, messages, currentUser?.id])

  // Seed nicknames from historical system messages (parity with Flutter).
  useEffect(() => {
    for (const m of messages) {
      if (m.type === 'system' && typeof m.content === 'string') {
        applyNicknameSystemMessage(id, m.content)
        applyQuickReactionSystemMessage(id, m.content)
      }
    }
  }, [id, messages])

  // Scroll positioning + pagination triggers now live in MessageViewport, which
  // is keyed on the conversation id so every switch starts from a clean scroll
  // state (see MessageViewport for the full rationale).
  const handleTypingChange = useCallback(
    (isTyping: boolean) => {
      stompService.publish('/app/chat.typing', { conversationId: id, typing: isTyping })
    },
    [id],
  )

  const handleSend = async (content: string, type: MessageType = 'text') => {
    try {
      // In AI conversations, prepend @AI so the server triggers the AI pipeline
      const finalContent = isAI && type === 'text' && !content.match(/^@(AI|ponai)\b/i)
        ? `@AI ${content}`
        : content
      // Show the "thinking" bubble immediately when a reply from the AI is
      // expected — either a dedicated AI conversation or an @AI mention in a
      // group — so the indicator appears before the first stream chunk (parity
      // with Flutter, which creates the placeholder on send).
      const triggersAi = type === 'text' && (isAI || /@(?:AI|ponai)\b/i.test(content))
      if (triggersAi) {
        setAiStream({ content: '', thinking: true, activeTools: [], sensitiveTools: [] })
        armAiWatchdog()
      }
      const sent = await chatService.sendMessage(id, finalContent, type, replyingTo?.id)
      appendMessage(sent)
      setReplyingTo(null)
    } catch {
      clearAiStream()
      toast.error(t('sendMessageError'))
    }
  }

  const handleEditSend = async (content: string) => {
    if (!editingMessage) return
    try {
      await chatService.editMessage(editingMessage.id, content)
      // STOMP MESSAGE_UPDATED will update the cache
      setEditingMessage(null)
    } catch {
      toast.error(t('editMessageError'))
    }
  }

  const handleOptimisticUpdate = useCallback(
    (updated: Partial<Message> & { id: string }) => {
      patchMessage(updated.id, updated)
    },
    [patchMessage],
  )

  return (
    <div className="flex flex-col h-full relative">
      <ConversationHeader
        conversationId={id}
        typingUserIds={typingUserIds.filter((uid) => uid !== currentUser?.id)}
        onSearchToggle={() => setSearchVisible((v) => !v)}
      />

      {searchVisible && (
        <MessageSearchPanel
          conversationId={id}
          onClose={() => setSearchVisible(false)}
        />
      )}

      {activeCall && groupCallId !== activeCall.callId && (
        <ActiveCallBanner
          callId={activeCall.callId}
          conversationId={id}
          media={activeCall.media}
          aiNotetaker={activeCall.aiNotetaker}
          joinedCount={activeCall.joinedCount}
        />
      )}

      {isPending && !isInitiator && (
        <StrangerRequestBanner
          conversationId={id}
          otherUserId={otherUserId!}
          otherUserName={conversation?.name || otherUser?.displayName || t('userFallback')}
          onAccepted={() => queryClient.invalidateQueries({ queryKey: ['conversation', id] })}
        />
      )}

      {/* Chat viewport. The wallpaper + decorations live on a NON-scrolling
          backdrop layer that fills this box; only the message list (the
          absolutely-positioned scroll container on top) scrolls. This keeps the
          wallpaper pinned behind the messages — like WhatsApp/Telegram — instead
          of scrolling away with the content. */}
      <div className="flex-1 relative overflow-hidden">
        {/* Wallpaper backdrop (image or gradient preset). */}
        <div
          className={cn(
            'absolute inset-0 z-0 bg-center bg-no-repeat transition-all duration-300 pointer-events-none',
            !wp.isImage && wp.className,
          )}
          style={wp.style}
        />

        {/* Custom Wallpaper Darken Overlay — kept light so the image stays
            visible while text remains readable. */}
        {wp.isImage && (
          <div className="absolute inset-0 bg-background/20 dark:bg-background/30 z-0 pointer-events-none" />
        )}

        {/* Glow Spheres — only when no wallpaper is set, so they don't tint it. */}
        {!hasWallpaper && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40 dark:opacity-20">
            <div className="absolute -top-40 -left-40 size-96 rounded-full bg-pon-cyan blur-[128px] animate-pulse duration-[6000ms]" />
            <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-pon-peach blur-[128px] animate-pulse duration-[8000ms]" />
          </div>
        )}

        {/* Scrolling message list — transparent, rides on top of the backdrop.
            Keyed on the conversation id so it remounts (fresh scroll state) on
            every switch instead of inheriting the previous thread's position. */}
        <MessageViewport
          key={id}
          messages={messages}
          currentUserId={currentUser?.id}
          conversationId={id}
          otherUserId={otherUserId}
          pinnedMessages={pinnedMessages}
          isGroup={isGroup}
          isLoading={isLoading}
          isError={isError}
          hasNextPage={!!hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          typingUserIds={typingUserIds}
          assistantTyping={isAssistantTyping}
          aiStream={aiStream}
          onEdit={setEditingMessage}
          onForward={setForwardMessage}
          onReply={setReplyingTo}
          onAiTrace={setTraceMessageId}
          onOptimisticUpdate={handleOptimisticUpdate}
        />
      </div>

      {isBlocked ? (
        <BlockedComposerNotice
          conversationId={id}
          otherUserId={otherUserId!}
          otherUserName={conversation?.name || otherUser?.displayName || t('userFallback')}
          iBlocked={relationship!.iBlocked}
          blockedMe={relationship!.blockedMe}
          onUnblocked={refetchRelationship}
        />
      ) : (
        <MessageInput
          onSend={editingMessage ? handleEditSend : handleSend}
          onTypingChange={handleTypingChange}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          disabled={isPending && !isInitiator}
          conversation={conversation}
        />
      )}

      <AiTraceModal messageId={traceMessageId} onClose={() => setTraceMessageId(null)} />
      <ForwardMessageModal message={forwardMessage} onClose={() => setForwardMessage(null)} />
    </div>
  )
}
