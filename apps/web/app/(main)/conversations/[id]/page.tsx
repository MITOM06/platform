'use client'

import { use, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store/auth.store'
import { stompService } from '@/lib/stomp/client'
import { useStompConnected } from '@/lib/stomp/use-stomp-connected'
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
import { ActiveCallBanner } from '@/components/call/ActiveCallBanner'
import { useCallStore } from '@/lib/store/call.store'
import { cn } from '@/lib/utils'
import { useWallpaper } from '@/lib/hooks/use-wallpaper'
import { useMessageCache } from '@/lib/hooks/use-message-cache'
import { applyNicknameSystemMessage } from '@/lib/nicknames'
import { applyQuickReactionSystemMessage } from '@/lib/quick-reaction'
import type { AiSource, AiStreamState, CallEvent, CallMedia, Message, MessageType, StompEvent } from '@/lib/api/types'

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

// Group-call lifecycle events (Track A §3) are keyed by `event`, not `type`.
const CALL_EVENT_TYPES = new Set(['call.started', 'call.roster', 'call.ended'])
function isCallEvent(parsed: Record<string, unknown>): parsed is CallEvent {
  return typeof parsed.event === 'string' && CALL_EVENT_TYPES.has(parsed.event)
}

interface ActiveCall {
  callId: string
  media: CallMedia
  aiNotetaker: boolean
  joinedCount: number
}

export default function ConversationPage({ params }: Props) {
  const { id } = use(params)
  const t = useTranslations('chat')
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  // Re-run the STOMP subscribe effect on every (re)connect so a dropped socket
  // is re-subscribed instead of leaving a subscription bound to a dead socket.
  const stompConnected = useStompConnected()
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
  const [aiStream, setAiStream] = useState<AiStreamState | null>(null)
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const groupCallId = useCallStore((s) => s.groupCallId)
  // Watchdog so a "thinking" bubble never sticks forever if the AI never
  // responds (parity with Flutter's 30s watchdog). Re-armed on every AI event.
  const aiWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  }, [messages.length, aiStream])

  // Jump to the latest message instantly whenever the conversation changes.
  // The App Router reuses this [id] page instance across conversation switches
  // (the STOMP effect is keyed on `id` precisely because the component is NOT
  // remounted), so the scroll container + react-virtual virtualizer otherwise
  // keep the PREVIOUS thread's scroll offset. When the new thread renders with
  // the same message count (cached revisit), the length-based effect above does
  // not fire, the virtualizer positions rows at the stale offset, and the
  // viewport shows blank until a manual scroll or full page reload. Resetting
  // here forces a clean recompute — matching the browser-refresh behaviour.
  useEffect(() => {
    isPrependingRef.current = false
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [id])

  const { patchMessage, markMessageRead, appendMessage, attachAiSources } = useMessageCache(id)
  // RAG sources from an AI_STREAM_DONE that arrived before the persisted AI
  // message was in the cache — applied to that message on append (rare race).
  const pendingAiSourcesRef = useRef<AiSource[] | null>(null)

  const armAiWatchdog = useCallback(() => {
    if (aiWatchdogRef.current) clearTimeout(aiWatchdogRef.current)
    aiWatchdogRef.current = setTimeout(() => setAiStream(null), 30000)
  }, [])

  const clearAiStream = useCallback(() => {
    if (aiWatchdogRef.current) {
      clearTimeout(aiWatchdogRef.current)
      aiWatchdogRef.current = null
    }
    setAiStream(null)
  }, [])

  // Clear the watchdog timer on unmount.
  useEffect(() => () => {
    if (aiWatchdogRef.current) clearTimeout(aiWatchdogRef.current)
  }, [])

  // Subscribe to STOMP for real-time messages + events + typing
  useEffect(() => {
    if (!stompConnected) return
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
                // A participant may have changed their avatar/displayName — refresh
                // their cached profile so peers see the new avatar (issue 1). The
                // refetched URL is unique-per-upload so it dodges the HTTP cache.
                parsed.conversation.participants.forEach((uid) =>
                  queryClient.invalidateQueries({ queryKey: ['user', uid] }),
                )
                break
              case 'AI_STREAM_CHUNK':
                setAiStream((prev) => ({
                  content: (prev?.content ?? '') + String(parsed.chunk ?? ''),
                  thinking: false,
                  activeTools: prev?.activeTools ?? [],
                  sensitiveTools: prev?.sensitiveTools ?? [],
                }))
                armAiWatchdog()
                break
              case 'AI_TOOL_CALL': {
                const toolName = String(parsed.toolName ?? '')
                const isSensitive = parsed.sensitive === true
                setAiStream((prev) => {
                  const base = prev ?? { content: '', thinking: true, activeTools: [], sensitiveTools: [] }
                  return {
                    ...base,
                    activeTools: base.activeTools.includes(toolName)
                      ? base.activeTools
                      : [...base.activeTools, toolName],
                    sensitiveTools:
                      isSensitive && !base.sensitiveTools.includes(toolName)
                        ? [...base.sensitiveTools, toolName]
                        : base.sensitiveTools,
                  }
                })
                armAiWatchdog()
                break
              }
              case 'AI_STREAM_DONE': {
                clearAiStream()
                // Attach RAG citation sources to the persisted AI message so the
                // bubble can render clickable chips. The saved message frame is
                // sent before this DONE frame (same topic, FIFO), so it is
                // normally already in the cache; if not (rare reorder), stash the
                // sources for the next AI message append.
                const doneSources = parsed.sources ?? []
                if (doneSources.length > 0 && !attachAiSources(doneSources)) {
                  pendingAiSourcesRef.current = doneSources
                }
                break
              }
              case 'AI_STREAM_ERROR': {
                clearAiStream()
                const aiErrCodeMap: Record<string, string> = {
                  AI_QUOTA_EXCEEDED: t('aiQuotaExceeded'),
                  AI_RATE_LIMITED: t('aiRateLimited'),
                  AI_STREAM_INTERRUPTED: t('aiStreamInterrupted'),
                  AI_UNAVAILABLE: t('aiUnavailable'),
                }
                const aiErrMsg = parsed.code && aiErrCodeMap[parsed.code]
                  ? aiErrCodeMap[parsed.code]
                  : (parsed.error ?? t('aiError'))
                toast.error(String(aiErrMsg))
                break
              }
            }
          } else if (isCallEvent(parsed)) {
            // Group-call lifecycle (Track A §3): drive the active-call banner and,
            // if this client is in the call, feed the roster into the mesh manager.
            switch (parsed.event) {
              case 'call.started': {
                setActiveCall({
                  callId: parsed.callId,
                  media: parsed.media,
                  aiNotetaker: parsed.aiNotetaker,
                  joinedCount: parsed.participants.length,
                })
                // If WE started it, the server already added us as a participant —
                // activate our group-call state without re-joining.
                if (parsed.startedBy === currentUser?.id) {
                  void import('@/lib/webrtc/group-call-manager').then((m) =>
                    m.groupCallManager.confirmStarted(
                      parsed.callId,
                      parsed.conversationId,
                      currentUser!.id,
                      parsed.media,
                      parsed.aiNotetaker,
                    ),
                  )
                }
                break
              }
              case 'call.roster': {
                const joined = parsed.participants.filter((p) => !p.leftAt).length
                setActiveCall((prev) =>
                  prev && prev.callId === parsed.callId ? { ...prev, joinedCount: joined } : prev,
                )
                if (useCallStore.getState().groupCallId === parsed.callId) {
                  void import('@/lib/webrtc/group-call-manager').then((m) =>
                    m.groupCallManager.applyRoster(parsed.participants),
                  )
                }
                break
              }
              case 'call.ended':
                setActiveCall((prev) => (prev?.callId === parsed.callId ? null : prev))
                void import('@/lib/webrtc/group-call-manager').then((m) =>
                  m.groupCallManager.handleEnded(parsed.callId),
                )
                break
            }
          } else {
            // Regular message (includes AI final message after AI_STREAM_DONE)
            const msg = parsed as unknown as Message
            if (msg.type === 'system' && typeof msg.content === 'string') {
              applyNicknameSystemMessage(id, msg.content)
              applyQuickReactionSystemMessage(id, msg.content)
            }
            // If a DONE frame delivered sources before this AI message arrived
            // (rare reorder), graft them on so the chips render.
            if (msg.type === 'ai' && pendingAiSourcesRef.current) {
              msg.sources = pendingAiSourcesRef.current
              pendingAiSourcesRef.current = null
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
  }, [id, stompConnected, queryClient, currentUser?.id, patchMessage, appendMessage, attachAiSources, markMessageRead, t, armAiWatchdog, clearAiStream])

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

        {/* Custom Wallpaper Darken Overlay */}
        {wp.isImage && (
          <div className="absolute inset-0 bg-background/80 dark:bg-background/90 z-0 pointer-events-none" />
        )}

        {/* Glow Spheres */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40 dark:opacity-20">
          <div className="absolute -top-40 -left-40 size-96 rounded-full bg-pon-cyan blur-[128px] animate-pulse duration-[6000ms]" />
          <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-pon-peach blur-[128px] animate-pulse duration-[8000ms]" />
        </div>

        {/* Scrolling message list — transparent, rides on top of the backdrop. */}
        <div
          ref={scrollContainerRef}
          className="absolute inset-0 overflow-y-auto px-4 py-4 z-10"
        >
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
            aiStream={aiStream}
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
