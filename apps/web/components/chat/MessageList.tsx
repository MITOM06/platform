'use client'

import { useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, MessageCircle } from 'lucide-react'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { ChatTypingIndicator } from '@/components/chat/ChatTypingIndicator'
import { Skeleton } from '@/components/ui/skeleton'
import type { Message } from '@/lib/api/types'

type VirtualRow =
  | { kind: 'separator'; isoDate: string }
  | { kind: 'message'; msg: Message }

function formatSeparatorDate(
  dateStr: string,
  locale: string,
  labels: { today: string; yesterday: string },
): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return labels.today
  if (date.toDateString() === yesterday.toDateString()) return labels.yesterday
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function MessageSkeletons() {
  return (
    <div className="space-y-3 py-4 px-4">
      {[60, 80, 50, 90, 65].map((w, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <Skeleton className="h-9 rounded-2xl" style={{ width: `${w}%`, maxWidth: '320px' }} />
        </div>
      ))}
    </div>
  )
}

interface Props {
  messages: Message[]
  currentUserId?: string
  conversationId: string
  otherUserId?: string
  pinnedMessages: string[]
  isGroup: boolean
  isLoading: boolean
  isError: boolean
  isFetchingNextPage: boolean
  typingUserIds: string[]
  aiStreamContent: string | null
  topSentinelRef: React.RefObject<HTMLDivElement | null>
  bottomRef: React.RefObject<HTMLDivElement | null>
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  onEdit: (message: Message) => void
  onForward: (message: Message) => void
  onReply: (message: Message) => void
  onAiTrace: (messageId: string) => void
  onOptimisticUpdate: (updated: Partial<Message> & { id: string }) => void
}

export function MessageList({
  messages,
  currentUserId,
  conversationId,
  otherUserId,
  pinnedMessages,
  isGroup,
  isLoading,
  isError,
  isFetchingNextPage,
  typingUserIds,
  aiStreamContent,
  topSentinelRef,
  bottomRef,
  scrollContainerRef,
  onEdit,
  onForward,
  onReply,
  onAiTrace,
  onOptimisticUpdate,
}: Props) {
  const t = useTranslations('chat')
  const locale = useLocale()

  // Flatten messages + date separators into virtual rows
  const rows = useMemo<VirtualRow[]>(() => {
    const result: VirtualRow[] = []
    let lastDate = ''
    for (const msg of messages) {
      const dateStr = new Date(msg.createdAt).toDateString()
      if (dateStr !== lastDate) {
        result.push({ kind: 'separator', isoDate: msg.createdAt })
        lastDate = dateStr
      }
      result.push({ kind: 'message', msg })
    }
    return result
  }, [messages])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => (rows[index].kind === 'separator' ? 44 : 72),
    overscan: 5,
  })

  const showContent = !isLoading && !!currentUserId && !isError

  return (
    <div className="relative z-10 space-y-2">
      <div ref={topSentinelRef} className="h-1" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {(isLoading || !currentUserId) && <MessageSkeletons />}

      {isError && (
        <div className="flex justify-center py-8 text-sm text-destructive">
          {t('loadMessagesError')}
        </div>
      )}

      {showContent && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-muted-foreground">
          <MessageCircle className="size-10 opacity-30" />
          <p className="text-sm">{t('noMessagesStart')}</p>
        </div>
      )}

      {showContent && rows.length > 0 && (
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = rows[virtualItem.index]
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: virtualItem.start,
                  width: '100%',
                }}
              >
                {row.kind === 'separator' ? (
                  <div className="flex justify-center my-4 select-none">
                    <span className="text-[11px] bg-muted/80 backdrop-blur-xs text-muted-foreground font-semibold px-3 py-1 rounded-full border shadow-xs">
                      {formatSeparatorDate(row.isoDate, locale, {
                        today: t('today'),
                        yesterday: t('yesterday'),
                      })}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2" id={`message-${row.msg.id}`}>
                    <MessageBubble
                      message={row.msg}
                      isOwn={row.msg.senderId === currentUserId}
                      currentUserId={currentUserId}
                      conversationId={conversationId}
                      otherUserId={otherUserId}
                      isPinned={pinnedMessages.includes(row.msg.id)}
                      isGroup={isGroup}
                      onEdit={onEdit}
                      onForward={onForward}
                      onReply={onReply}
                      onAiTrace={onAiTrace}
                      onOptimisticUpdate={onOptimisticUpdate}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {typingUserIds.length > 0 && currentUserId && !typingUserIds.includes(currentUserId) && (
        <ChatTypingIndicator />
      )}

      {aiStreamContent !== null && (
        <div className="flex flex-row items-end gap-1">
          <div className="max-w-[70%] rounded-[24px] rounded-tl-none px-4 py-2.5 text-sm bg-muted/70 border border-border/50 shadow-xs">
            <p className="whitespace-pre-wrap leading-relaxed">{aiStreamContent || '…'}</p>
            <div className="flex gap-1 mt-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block size-1.5 rounded-full bg-primary/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
