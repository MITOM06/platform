'use client'

import { use, useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, MessageCircle } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth.store'
import { stompService } from '@/lib/stomp/client'
import { chatService } from '@/lib/api/chat'
import { useMessages } from '@/lib/hooks/use-messages'
import { ConversationHeader } from '@/components/chat/ConversationHeader'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { MessageInput } from '@/components/chat/MessageInput'
import { MessageSearchPanel } from '@/components/chat/MessageSearchPanel'
import { AiTraceModal } from '@/components/chat/AiTraceModal'
import { ForwardMessageModal } from '@/components/chat/ForwardMessageModal'
import { Skeleton } from '@/components/ui/skeleton'
import type { Message, MessagesResponse, StompEvent } from '@/lib/api/types'

interface Props {
  params: Promise<{ id: string }>
}

// STOMP events use UPPER_CASE types; regular messages use lowercase types
const STOMP_EVENT_TYPES = new Set([
  'MESSAGE_UPDATED', 'MESSAGE_RECALLED', 'REACTION_UPDATED',
  'PINNED_MESSAGE', 'CONVERSATION_UPDATED',
])

function isStompEvent(parsed: Record<string, unknown>): parsed is StompEvent {
  return typeof parsed.type === 'string' && STOMP_EVENT_TYPES.has(parsed.type)
}

function MessageSkeletons() {
  return (
    <div className="space-y-3 py-4 px-4">
      {[60, 80, 50, 90, 65].map((w, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <Skeleton
            className="h-9 rounded-2xl"
            style={{ width: `${w}%`, maxWidth: '320px' }}
          />
        </div>
      ))}
    </div>
  )
}

export default function ConversationPage({ params }: Props) {
  const { id } = use(params)
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
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null)
  const [traceMessageId, setTraceMessageId] = useState<string | null>(null)

  // Pinned messages tracking (driven by STOMP + initial conversation load)
  const [pinnedMessages, setPinnedMessages] = useState<string[]>([])

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(id)
  const messages = data?.messages ?? []

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

  // Auto-scroll to bottom on new messages (not prepend)
  useEffect(() => {
    if (isPrependingRef.current) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Helper to patch a single message in the cache
  const patchMessage = useCallback(
    (messageId: string, patch: Partial<Message>) => {
      queryClient.setQueryData<InfiniteData<MessagesResponse>>(
        ['messages', id],
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              content: page.content.map((m) => m.id === messageId ? { ...m, ...patch } : m),
            })),
          }
        },
      )
    },
    [id, queryClient],
  )

  // Helper to append a new message to page[0]
  const appendMessage = useCallback(
    (incoming: Message) => {
      queryClient.setQueryData<InfiniteData<MessagesResponse>>(
        ['messages', id],
        (old) => {
          if (!old) {
            return {
              pages: [{ content: [incoming], nextCursorId: null, hasMore: false }],
              pageParams: [undefined],
            }
          }
          const allIds = new Set(old.pages.flatMap((p) => p.content.map((m) => m.id)))
          if (allIds.has(incoming.id)) return old
          return {
            ...old,
            pages: old.pages.map((page, i) =>
              i === 0 ? { ...page, content: [incoming, ...page.content] } : page,
            ),
          }
        },
      )
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    [id, queryClient],
  )

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
              case 'REACTION_UPDATED':
                patchMessage(parsed.messageId, { reactions: parsed.reactions })
                break
              case 'PINNED_MESSAGE':
                setPinnedMessages(parsed.pinnedMessages)
                queryClient.invalidateQueries({ queryKey: ['conversation', id] })
                break
              case 'CONVERSATION_UPDATED':
                queryClient.setQueryData(['conversation', id], parsed.conversation)
                queryClient.invalidateQueries({ queryKey: ['conversations'] })
                break
            }
          } else {
            // Regular message or system message
            appendMessage(parsed as unknown as Message)
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
  }, [id, queryClient, currentUser?.id, patchMessage, appendMessage])

  // Mark conversation as read on open
  useEffect(() => {
    chatService.markConversationRead(id).catch(() => {})
  }, [id])

  const handleTypingChange = useCallback(
    (isTyping: boolean) => {
      stompService.publish('/app/chat.typing', { conversationId: id, typing: isTyping })
    },
    [id],
  )

  const handleSend = async (content: string) => {
    try {
      const sent = await chatService.sendMessage(id, content)
      appendMessage(sent)
    } catch {
      toast.error('Không thể gửi tin nhắn')
    }
  }

  const handleEditSend = async (content: string) => {
    if (!editingMessage) return
    try {
      await chatService.editMessage(editingMessage.id, content)
      // STOMP MESSAGE_UPDATED will update the cache
      setEditingMessage(null)
    } catch {
      toast.error('Không thể chỉnh sửa tin nhắn')
    }
  }

  const handleOptimisticUpdate = useCallback(
    (updated: Partial<Message> & { id: string }) => {
      patchMessage(updated.id, updated)
    },
    [patchMessage],
  )

  return (
    <div className="flex flex-col h-full">
      <ConversationHeader
        conversationId={id}
        typingUserIds={typingUserIds}
        onSearchToggle={() => setSearchVisible((v) => !v)}
        onPinnedUpdate={setPinnedMessages}
      />

      {searchVisible && (
        <MessageSearchPanel
          conversationId={id}
          onClose={() => setSearchVisible(false)}
        />
      )}

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        <div ref={topSentinelRef} className="h-1" />

        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {isLoading && <MessageSkeletons />}

        {isError && (
          <div className="flex justify-center py-8 text-sm text-destructive">
            Không thể tải tin nhắn
          </div>
        )}

        {!isLoading && !isError && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <MessageCircle className="size-10 opacity-30" />
            <p className="text-sm">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!</p>
          </div>
        )}

        {!isLoading &&
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.senderId === currentUser?.id}
              isPinned={pinnedMessages.includes(msg.id)}
              onEdit={setEditingMessage}
              onForward={setForwardMessage}
              onAiTrace={setTraceMessageId}
              onOptimisticUpdate={handleOptimisticUpdate}
            />
          ))}

        <div ref={bottomRef} />
      </div>

      <MessageInput
        onSend={editingMessage ? handleEditSend : handleSend}
        onTypingChange={handleTypingChange}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
      />

      <AiTraceModal messageId={traceMessageId} onClose={() => setTraceMessageId(null)} />
      <ForwardMessageModal message={forwardMessage} onClose={() => setForwardMessage(null)} />
    </div>
  )
}
