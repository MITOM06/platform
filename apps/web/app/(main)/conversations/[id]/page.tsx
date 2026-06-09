'use client'

import { use, useEffect, useRef } from 'react'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store/auth.store'
import { stompService } from '@/lib/stomp/client'
import { chatService } from '@/lib/api/chat'
import { useMessages } from '@/lib/hooks/use-messages'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { MessageInput } from '@/components/chat/MessageInput'
import type { Message, MessagesResponse } from '@/lib/api/types'

interface Props {
  params: Promise<{ id: string }>
}

export default function ConversationPage({ params }: Props) {
  const { id } = use(params)
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isError } = useMessages(id)
  const messages = data?.messages ?? []

  // Subscribe to STOMP for real-time messages
  useEffect(() => {
    let active = true

    stompService.waitForConnect().then(() => {
      if (!active) return
      stompService.subscribe(`/topic/conversation/${id}`, (frame) => {
        try {
          const incoming: Message = JSON.parse(frame.body)
          queryClient.setQueryData<InfiniteData<MessagesResponse>>(
            ['messages', id],
            (old) => {
              if (!old) return old
              // deduplicate by id
              const allIds = new Set(old.pages.flatMap((p) => p.content.map((m) => m.id)))
              if (allIds.has(incoming.id)) return old
              return {
                ...old,
                pages: old.pages.map((page, i) =>
                  i === 0
                    ? { ...page, content: [...page.content, incoming] }
                    : page,
                ),
              }
            },
          )
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
        } catch {
          // ignore malformed frames
        }
      })
    })

    return () => {
      active = false
    }
  }, [id, queryClient])

  // Mark conversation as read on open
  useEffect(() => {
    chatService.markConversationRead(id).catch(() => {})
  }, [id])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async (content: string) => {
    try {
      const sent = await chatService.sendMessage(id, content)
      queryClient.setQueryData<InfiniteData<MessagesResponse>>(
        ['messages', id],
        (old) => {
          if (!old) {
            return {
              pages: [{ content: [sent], nextCursorId: null, hasMore: false }],
              pageParams: [undefined],
            }
          }
          const allIds = new Set(old.pages.flatMap((p) => p.content.map((m) => m.id)))
          if (allIds.has(sent.id)) return old
          return {
            ...old,
            pages: old.pages.map((page, i) =>
              i === 0 ? { ...page, content: [...page.content, sent] } : page,
            ),
          }
        },
      )
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch {
      toast.error('Không thể gửi tin nhắn')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background">
        <Link
          href="/conversations"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-medium truncate">Cuộc trò chuyện</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {isLoading && (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">
            Đang tải tin nhắn...
          </div>
        )}

        {isError && (
          <div className="flex justify-center py-8 text-sm text-destructive">
            Không thể tải tin nhắn
          </div>
        )}

        {!isLoading &&
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.senderId === currentUser?.id}
            />
          ))}

        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={handleSend} />
    </div>
  )
}
