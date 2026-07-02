'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { MessageCircle, Wrench, ShieldAlert } from 'lucide-react'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { ChatTypingIndicator } from '@/components/chat/ChatTypingIndicator'
import { Skeleton } from '@/components/ui/skeleton'
import type { AiStreamState, Message } from '@/lib/api/types'

// Maps backend tool names to localized "in progress" labels (parity with the
// Flutter StreamingAiBubble); unknown tools fall back to a generic label.
const TOOL_LABEL_KEYS: Record<string, string> = {
  search_messages: 'toolSearchMessages',
  get_user_info: 'toolGetUserInfo',
  search_knowledge_base: 'toolSearchKnowledgeBase',
  summarize_conversation: 'toolSummarizeConversation',
  create_reminder: 'toolCreateReminder',
}

// Gap between consecutive messages beyond which a lightweight time marker is
// inserted (Messenger-style grouping). Tunable in one place.
const TIME_GROUP_GAP_MS = 15 * 60 * 1000 // 15 minutes

type VirtualRow =
  | { kind: 'separator'; isoDate: string }
  | { kind: 'time-separator'; isoDate: string }
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
  typingUserIds: string[]
  /** True while the personal assistant bot is preparing its reply (no STOMP
   *  typing event exists for external bots — Bot Factory calls are synchronous). */
  assistantTyping?: boolean
  aiStream: AiStreamState | null
  onEdit: (message: Message) => void
  onForward: (message: Message) => void
  onReply: (message: Message) => void
  onAiTrace: (messageId: string) => void
  onOptimisticUpdate: (updated: Partial<Message> & { id: string }) => void
  /** Fired when a message's actions menu opens/closes — used to surface that
   *  message's exact timestamp as a sticky chip at the top of the viewport. */
  onMenuOpen?: (createdAt: string) => void
  onMenuClose?: () => void
}

/**
 * Pure renderer for the message thread. Scroll positioning and pagination are
 * owned by the parent MessageViewport — this component only turns the (already
 * paginated, chronological) `messages` array into bubbles + date separators.
 * Not virtualized: cursor pagination keeps the DOM small enough to render
 * directly, which removes the scroll/measure races that virtualization caused.
 */
export function MessageList({
  messages,
  currentUserId,
  conversationId,
  otherUserId,
  pinnedMessages,
  isGroup,
  isLoading,
  isError,
  typingUserIds,
  assistantTyping = false,
  aiStream,
  onEdit,
  onForward,
  onReply,
  onAiTrace,
  onOptimisticUpdate,
  onMenuOpen,
  onMenuClose,
}: Props) {
  const t = useTranslations('chat')
  const locale = useLocale()

  // Entrance-animation guard (motion spec §B): only the single newest *appended*
  // message animates in. This component is remounted per conversation (the
  // parent MessageViewport is keyed on the id), so the whole first batch is
  // treated as historical; afterwards, any change to the newest message id means
  // a message was appended and only that one animates. Prepended older pages
  // don't change the newest id, so they never animate. Uses the React-sanctioned
  // "store information from previous renders" pattern — no refs read in render.
  const newestId = messages.length > 0 ? messages[messages.length - 1].id : null
  const [hydrated, setHydrated] = useState(false)
  const [prevNewestId, setPrevNewestId] = useState<string | null>(null)
  const [justAppendedId, setJustAppendedId] = useState<string | null>(null)

  if (!hydrated) {
    setHydrated(true)
    setPrevNewestId(newestId)
  } else if (newestId !== prevNewestId) {
    setPrevNewestId(newestId)
    setJustAppendedId(newestId)
  }

  // Flatten messages + date separators + time-group markers into rows. A date
  // separator opens each new calendar day; within a day, a lighter time marker
  // appears whenever more than TIME_GROUP_GAP_MS elapsed since the previous
  // message (so a burst of messages shows one time, not one per bubble).
  const rows = useMemo<VirtualRow[]>(() => {
    const result: VirtualRow[] = []
    let lastDate = ''
    let lastTimestamp = 0
    for (const msg of messages) {
      const msgDate = new Date(msg.createdAt)
      const dateStr = msgDate.toDateString()
      const msgTs = msgDate.getTime()
      if (dateStr !== lastDate) {
        result.push({ kind: 'separator', isoDate: msg.createdAt })
        lastDate = dateStr
      } else if (msgTs - lastTimestamp > TIME_GROUP_GAP_MS) {
        result.push({ kind: 'time-separator', isoDate: msg.createdAt })
      }
      lastTimestamp = msgTs
      result.push({ kind: 'message', msg })
    }
    return result
  }, [messages])

  const showContent = !isLoading && !!currentUserId && !isError

  return (
    <div className="relative z-10 space-y-2">
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
        <div className="space-y-2">
          {rows.map((row, i) =>
            row.kind === 'separator' ? (
              <div key={`sep-${row.isoDate}-${i}`} className="flex justify-center my-4 select-none">
                <span className="text-[11px] bg-muted/80 backdrop-blur-xs text-muted-foreground font-semibold px-3 py-1 rounded-full border shadow-xs">
                  {formatSeparatorDate(row.isoDate, locale, {
                    today: t('today'),
                    yesterday: t('yesterday'),
                  })}
                </span>
              </div>
            ) : row.kind === 'time-separator' ? (
              <div key={`tsep-${row.isoDate}-${i}`} className="flex justify-center my-2 select-none">
                <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">
                  {new Date(row.isoDate).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ) : (
              <div
                key={row.msg.id}
                id={`message-${row.msg.id}`}
                className={
                  row.msg.id === justAppendedId
                    ? 'space-y-2 motion-safe:pon-enter'
                    : 'space-y-2'
                }
              >
                <MessageBubble
                  message={row.msg}
                  isOwn={row.msg.senderId === currentUserId}
                  currentUserId={currentUserId}
                  conversationId={conversationId}
                  otherUserId={otherUserId}
                  isPinned={pinnedMessages.includes(row.msg.id)}
                  pinnedCount={pinnedMessages.length}
                  isGroup={isGroup}
                  onEdit={onEdit}
                  onForward={onForward}
                  onReply={onReply}
                  onAiTrace={onAiTrace}
                  onOptimisticUpdate={onOptimisticUpdate}
                  onMenuOpen={onMenuOpen}
                  onMenuClose={onMenuClose}
                />
              </div>
            ),
          )}
        </div>
      )}

      {((typingUserIds.length > 0 && currentUserId && !typingUserIds.includes(currentUserId)) ||
        assistantTyping) && (
        <ChatTypingIndicator />
      )}

      {aiStream !== null && (
        <div className="flex flex-row items-end gap-1 motion-safe:pon-enter">
          <div className="max-w-[70%] rounded-[24px] rounded-tl-none px-4 py-2.5 text-sm bg-muted/70 border border-border/50 shadow-xs">
            {aiStream.activeTools.length > 0 && (() => {
              const tool = aiStream.activeTools[aiStream.activeTools.length - 1]
              const key = TOOL_LABEL_KEYS[tool]
              const label = key ? t(key) : t('aiToolCalling', { toolName: tool })
              const isSensitive = aiStream.sensitiveTools.includes(tool)
              return (
                <div
                  className={`flex items-center gap-1.5 mb-1.5 text-[12px] italic ${
                    isSensitive ? 'text-red-400' : 'text-amber-500'
                  }`}
                >
                  {isSensitive ? (
                    <ShieldAlert className="size-3 shrink-0" />
                  ) : (
                    <Wrench className="size-3 shrink-0" />
                  )}
                  <span>{isSensitive ? `${label} · ${t('aiSensitiveAction')}` : label}</span>
                </div>
              )
            })()}
            {aiStream.content ? (
              <p className="whitespace-pre-wrap leading-relaxed">
                {aiStream.content}
                <span className="ml-0.5 inline-block w-[2px] h-[1.05em] translate-y-0.5 bg-primary/70 animate-pulse" />
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('aiThinking')}</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="inline-block size-1.5 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
