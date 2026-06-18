'use client'

import { use, useEffect, useMemo, useRef, useState, useCallback } from 'react'
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
import { ConversationHeader } from '@/components/chat/ConversationHeader'
import { MessageList } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'
import { MessageSearchPanel } from '@/components/chat/MessageSearchPanel'
import { StrangerRequestBanner } from '@/components/chat/StrangerRequestBanner'
import { BlockedComposerNotice } from '@/components/chat/BlockedComposerNotice'
import { AiTraceModal } from '@/components/chat/AiTraceModal'
import { ForwardMessageModal } from '@/components/chat/ForwardMessageModal'
import { cn } from '@/lib/utils'
import { useWallpaper } from '@/lib/hooks/use-wallpaper'
import { useMessageCache } from '@/lib/hooks/use-message-cache'
import { applyNicknameSystemMessage } from '@/lib/nicknames'
import { applyQuickReactionSystemMessage } from '@/lib/quick-reaction'
import type { Message, MessageType, StompEvent } from '@/lib/api/types'

interface Props {
  params: Promise<{ id: string }>
}

// STOMP events use UPPER_CASE types; regular messages use lowercase types
const STOMP_EVENT_TYPES = new Set([
  'MESSAGE_UPDATED', 'MESSAGE_RECALLED', 'MESSAGE_READ', 'REACTION_UPDATED',
  'PINNED_MESSAGE', 'CONVERSATION_UPDATED',
  'AI_STREAM_CHUNK', 'AI_STREAM_DONE', 'AI_STREAM_ERROR', 'AI_TOOL_CALL',
])

function isStompEvent(parsed: Record<string, unknown>): parsed is StompEvent {
  return typeof parsed.type === 'string' && STOMP_EVENT_TYPES.has(parsed.type)
}

export default function ConversationPage({ params }: Props) {
  const { id } = use(params)
  const t = useTranslations('chat')
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const bottomRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef(0)
  const isPrependingRef = useRef(false)

  const [typingUserIds, setTypingUserIds] = useState<string[]>([])
  const [searchVisible, setSearchVisible] = useState(false)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null)
  const [traceMessageId, setTraceMessageId] = useState<string | null>(null)
  const [aiStreamContent, setAiStreamContent] = useState<string | null>(null)

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

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(id)
  const messages = useMemo(() => data?.messages ?? [], [data?.messages])

  // Seed nicknames from historical system messages (parity with Flutter).
  useEffect(() => {
    for (const m of messages) {
      if (m.type === 'system' && typeof m.content === 'string') {
        applyNicknameSystemMessage(id, m.content)
        applyQuickReactionSystemMessage(id, m.content)
      }
    }
  }, [id, messages])

  // Infinite scroll: observe sentinel at top, preserve scroll position
  useEffect(() => {
    const sentinel = topSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          const el = scrollContainerRef.current
          if (el) prevScrollHeightRef.current = el.scrollHeight
          isPrependingRef.current = true
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Restore scroll after prepend
  useEffect(() => {
    if (!isPrependingRef.current || isFetchingNextPage) return
    const el = scrollContainerRef.current
    if (el && prevScrollHeightRef.current) {
      el.scrollTop = el.scrollHeight - prevScrollHeightRef.current
    }
    isPrependingRef.current = false
    prevScrollHeightRef.current = 0
  }, [isFetchingNextPage, messages.length])

  // Auto-scroll to bottom on new messages (not prepend) and while the AI
  // response streams in, so the growing AI bubble stays in view (D-1.2 fix).
  useEffect(() => {
    if (isPrependingRef.current) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, aiStreamContent])

  const { patchMessage, markMessageRead, appendMessage } = useMessageCache(id)

  // Subscribe to STOMP for real-time messages + events + typing
  useEffect(() => {
    let active = true
    let typingSub: ReturnType<typeof stompService.subscribe>
    let messageSub: ReturnType<typeof stompService.subscribe>

    stompService.waitForConnect().then(() => {
      if (!active) return

      messageSub = stompService.subscribe(`/topic/conversation/${id}`, (frame) => {
        try {
          const parsed = JSON.parse(frame.body) as Record<string, unknown>

          if (isStompEvent(parsed)) {
            switch (parsed.type) {
              case 'MESSAGE_UPDATED':
                patchMessage(parsed.messageId, {
                  content: parsed.content,
                  editedAt: parsed.editedAt,
                })
                break
              case 'MESSAGE_RECALLED':
                patchMessage(parsed.messageId, { recalled: true })
                break
              case 'MESSAGE_READ':
                markMessageRead(parsed.messageId, parsed.readerId)
                break
              case 'REACTION_UPDATED':
                patchMessage(parsed.messageId, { reactions: parsed.reactions })
                break
              case 'PINNED_MESSAGE':
                queryClient.invalidateQueries({ queryKey: ['conversation', id] })
                break
              case 'CONVERSATION_UPDATED':
                queryClient.setQueryData(['conversation', id], parsed.conversation)
                queryClient.invalidateQueries({ queryKey: ['conversations'] })
                break
              case 'AI_STREAM_CHUNK':
                setAiStreamContent((prev) => (prev ?? '') + String(parsed.chunk ?? ''))
                break
              case 'AI_STREAM_DONE':
                setAiStreamContent(null)
                break
              case 'AI_STREAM_ERROR': {
                setAiStreamContent(null)
                const aiErrCodeMap: Record<string, string> = {
                  AI_QUOTA_EXCEEDED: t('aiQuotaExceeded'),
                  AI_STREAM_INTERRUPTED: t('aiStreamInterrupted'),
                  AI_UNAVAILABLE: t('aiUnavailable'),
                }
                const aiErrMsg = parsed.code && aiErrCodeMap[parsed.code]
                  ? aiErrCodeMap[parsed.code]
                  : (parsed.error ?? t('aiError'))
                toast.error(String(aiErrMsg))
                break
              }
              case 'AI_TOOL_CALL':
                // tool call indicator is transient — no persistent state needed
                break
            }
          } else {
            // Regular message (includes AI final message after AI_STREAM_DONE)
            const msg = parsed as unknown as Message
            if (msg.type === 'system' && typeof msg.content === 'string') {
              applyNicknameSystemMessage(id, msg.content)
              applyQuickReactionSystemMessage(id, msg.content)
            }
            appendMessage(msg)
          }
        } catch {
          // ignore malformed frames
        }
      })

      typingSub = stompService.subscribe(
        `/topic/conversation/${id}/typing`,
        (frame) => {
          try {
            const { userId, typing } = JSON.parse(frame.body) as { userId: string; typing: boolean }
            if (userId === currentUser?.id) return
            setTypingUserIds((prev) =>
              typing ? [...new Set([...prev, userId])] : prev.filter((uid) => uid !== userId),
            )
          } catch {
            // ignore
          }
        },
      )
    })

    return () => {
      active = false
      messageSub?.unsubscribe()
      typingSub?.unsubscribe()
    }
  }, [id, queryClient, currentUser?.id, patchMessage, appendMessage, markMessageRead, t])

  // Mark conversation as read on open
  useEffect(() => {
    chatService.markConversationRead(id).catch(() => {})
  }, [id])

  // Per-message read receipts (parity with mobile _markLoadedAsRead): publish
  // /app/chat.read for messages from others so the sender's seen-tick flips on
  // in realtime. The server persists readBy + broadcasts MESSAGE_READ.
  const sentReadRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!currentUser) return
    const sent = sentReadRef.current
    stompService.waitForConnect().then(() => {
      for (const m of messages) {
        if (
          m.senderId !== currentUser.id &&
          !sent.has(m.id) &&
          !(m.readBy ?? []).includes(currentUser.id)
        ) {
          sent.add(m.id)
          stompService.publish('/app/chat.read', { conversationId: id, messageId: m.id })
        }
      }
    })
  }, [id, messages, currentUser])

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
      const sent = await chatService.sendMessage(id, finalContent, type, replyingTo?.id)
      appendMessage(sent)
      setReplyingTo(null)
    } catch {
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

      {isPending && !isInitiator && (
        <StrangerRequestBanner
          conversationId={id}
          otherUserId={otherUserId!}
          otherUserName={conversation?.name || otherUser?.displayName || t('userFallback')}
          onAccepted={() => queryClient.invalidateQueries({ queryKey: ['conversation', id] })}
        />
      )}

      <div
        ref={scrollContainerRef}
        className={cn(
          'flex-1 overflow-y-auto px-4 py-4 relative transition-all duration-300 bg-center bg-no-repeat',
          !wp.isImage && wp.className,
        )}
        style={wp.style}
      >
        {/* Custom Wallpaper Darken Overlay */}
        {wp.isImage && (
          <div className="absolute inset-0 bg-background/80 dark:bg-background/90 z-0 pointer-events-none" />
        )}

        {/* Glow Spheres */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40 dark:opacity-20">
          <div className="absolute -top-40 -left-40 size-96 rounded-full bg-pon-cyan blur-[128px] animate-pulse duration-[6000ms]" />
          <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-pon-peach blur-[128px] animate-pulse duration-[8000ms]" />
        </div>

        <MessageList
          messages={messages}
          currentUserId={currentUser?.id}
          conversationId={id}
          otherUserId={otherUserId}
          pinnedMessages={pinnedMessages}
          isGroup={isGroup}
          isLoading={isLoading}
          isError={isError}
          isFetchingNextPage={isFetchingNextPage}
          typingUserIds={typingUserIds}
          aiStreamContent={aiStreamContent}
          topSentinelRef={topSentinelRef}
          bottomRef={bottomRef}
          scrollContainerRef={scrollContainerRef}
          onEdit={setEditingMessage}
          onForward={setForwardMessage}
          onReply={setReplyingTo}
          onAiTrace={setTraceMessageId}
          onOptimisticUpdate={handleOptimisticUpdate}
        />
      </div>

      {isBlocked ? (
        <BlockedComposerNotice
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
