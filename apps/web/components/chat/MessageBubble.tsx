'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { firstUrl } from '@/lib/media'
import { MessageActions } from './MessageActions'
import { ImageContent, VideoContent } from './ImageContent'
import { FileContent } from './FileContent'
import { VoiceMessage } from './VoiceMessage'
import { LinkPreviewCard } from './LinkPreviewCard'
import { UserProfileDrawer } from './UserProfileDrawer'
import type { Message } from '@/lib/api/types'

interface Props {
  message: Message
  isOwn: boolean
  currentUserId?: string
  isPinned?: boolean
  onEdit?: (message: Message) => void
  onForward?: (message: Message) => void
  onReply?: (message: Message) => void
  onAiTrace?: (messageId: string) => void
  onOptimisticUpdate: (updated: Partial<Message> & { id: string }) => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ReactionBadge({ emoji, count }: { emoji: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 bg-muted border rounded-full px-1.5 py-0.5 text-xs leading-none">
      {emoji}
      {count > 1 && <span className="text-muted-foreground">{count}</span>}
    </span>
  )
}

// Media types render without the colored chat bubble (mirror Flutter).
const BARE_TYPES = new Set(['image', 'video', 'sticker'])

export function MessageBubble({
  message,
  isOwn,
  currentUserId,
  isPinned = false,
  onEdit,
  onForward,
  onReply,
  onAiTrace,
  onOptimisticUpdate,
}: Props) {
  const t = useTranslations('chat')
  const [hovered, setHovered] = useState(false)
  const [longPressActive, setLongPressActive] = useState(false)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressAt = useRef(0)

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleTouchStart = () => {
    clearLongPressTimer()
    longPressTimer.current = setTimeout(() => {
      setLongPressActive(true)
      longPressAt.current = Date.now()
      navigator?.vibrate?.(20)
    }, 600)
  }

  const handleTouchEnd = () => clearLongPressTimer()
  const handleTouchMove = () => clearLongPressTimer()

  const handleRowClick = () => {
    if (!longPressActive) return
    // Ignore the synthetic click that fires immediately after the long-press touchend
    if (Date.now() - longPressAt.current < 400) return
    setLongPressActive(false)
  }

  if (message.recalled) {
    return (
      <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[70%] rounded-[24px] px-4 py-2 text-sm italic text-muted-foreground border border-dashed bg-muted/20">
          {t('recalled')}
        </div>
      </div>
    )
  }

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-1">
        <span className="text-[11px] text-muted-foreground bg-muted/65 rounded-full px-3 py-1 border border-border/20">
          {message.content}
        </span>
      </div>
    )
  }

  // Group reactions by emoji
  const reactionMap = new Map<string, number>()
  message.reactions?.forEach((r) => {
    reactionMap.set(r.emoji, (reactionMap.get(r.emoji) ?? 0) + 1)
  })

  const isBare = BARE_TYPES.has(message.type)
  const linkUrl = message.type === 'text' ? firstUrl(message.content) : null

  const replyPreview = message.replyPreview && (
    <button
      type="button"
      className={cn(
        'mb-2 w-full pl-2 border-l-2 text-left text-xs opacity-80 cursor-pointer select-none transition-colors hover:opacity-100 rounded-xs py-0.5',
        isOwn
          ? 'border-primary-foreground/40 bg-primary-foreground/10 hover:bg-primary-foreground/15'
          : 'border-primary/50 bg-primary/5 hover:bg-primary/10',
      )}
      onClick={() => {
        const el = document.getElementById(`message-${message.replyPreview?.messageId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('bg-primary/20', 'transition-all', 'duration-500', 'ring-2', 'ring-primary/40')
          setTimeout(() => {
            el.classList.remove('bg-primary/20', 'ring-2', 'ring-primary/40')
          }, 2000)
        }
      }}
    >
      <p className="font-semibold mb-0.5">
        {message.replyPreview.senderId === currentUserId ? t('you') : (message.senderName || '')}
      </p>
      <p className="truncate italic">{message.replyPreview.content}</p>
    </button>
  )

  const openProfile = () => {
    if (!isOwn && message.senderId) setProfileUserId(message.senderId)
  }

  const senderLabel = !isOwn && message.senderName && (
    <button
      type="button"
      onClick={openProfile}
      className="text-xs font-semibold mb-1 text-primary/80 text-left hover:underline"
    >
      {message.senderName}
    </button>
  )

  const timeLabel = (
    <p
      className={cn(
        'text-[10px] mt-1.5 text-right font-medium tracking-wide',
        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground/80',
      )}
    >
      {formatTime(message.createdAt)}
      {message.editedAt && <span className="ml-1 italic opacity-85">{t('edited')}</span>}
    </p>
  )

  // ── Inner content by type ──────────────────────────────────────────────────
  let body: React.ReactNode
  switch (message.type) {
    case 'image':
      body = <ImageContent content={message.content} />
      break
    case 'video':
      body = <VideoContent content={message.content} />
      break
    case 'sticker':
      body = <span className="text-5xl leading-none">{message.content}</span>
      break
    case 'file':
      body = <FileContent content={message.content} isOwn={isOwn} />
      break
    case 'voice':
      body = <VoiceMessage content={message.content} isOwn={isOwn} />
      break
    default:
      body = (
        <>
          <p className="whitespace-pre-wrap leading-relaxed">
            {message.content.split(/(@\w+)/g).map((part, i) => {
              if (part.startsWith('@') && part.length > 1) {
                return (
                  <span
                    key={i}
                    className={cn(
                      'font-semibold px-1 rounded-sm cursor-pointer mx-0.5',
                      isOwn ? 'bg-primary-foreground/20' : 'bg-primary/20 text-primary hover:bg-primary/30'
                    )}
                  >
                    {part}
                  </span>
                )
              }
              return <span key={i}>{part}</span>
            })}
          </p>
          {linkUrl && <LinkPreviewCard url={linkUrl} />}
        </>
      )
  }

  return (
    <>
    <div
      className={cn('flex group', isOwn ? 'flex-row-reverse' : 'flex-row', 'items-end gap-1')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onClick={handleRowClick}
    >
      <div className="flex flex-col gap-1 max-w-[70%]">
        {isBare ? (
          <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
            {senderLabel}
            {replyPreview}
            {body}
            <span className="mt-0.5 text-[10px] font-medium text-muted-foreground/70">
              {formatTime(message.createdAt)}
            </span>
          </div>
        ) : (
          <div
            className={cn(
              'rounded-[24px] px-4 py-2.5 text-sm break-words relative overflow-hidden shadow-xs border',
              isOwn
                ? 'bg-primary text-primary-foreground border-primary/30 rounded-tr-none shadow-[0_2px_12px_rgba(106,201,255,0.25)] dark:shadow-[0_2px_16px_rgba(106,201,255,0.2)]'
                : 'bg-muted/70 text-foreground border-border/50 rounded-tl-none',
              isPinned && 'ring-2 ring-primary/40',
            )}
          >
            {senderLabel}
            {replyPreview}
            {body}
            {timeLabel}
          </div>
        )}

        {/* Reaction badges */}
        {reactionMap.size > 0 && (
          <div className={cn('flex flex-wrap gap-1', isOwn ? 'justify-end' : 'justify-start')}>
            {Array.from(reactionMap.entries()).map(([emoji, count]) => (
              <ReactionBadge key={emoji} emoji={emoji} count={count} />
            ))}
          </div>
        )}
      </div>

      {/* Action menu — visible on hover (desktop) or long-press (touch) */}
      <div className={cn('flex items-center mb-1', !hovered && !longPressActive && 'invisible')}>
        <MessageActions
          message={message}
          isOwn={isOwn}
          isPinned={isPinned}
          onEdit={onEdit ? () => onEdit(message) : undefined}
          onForward={onForward ? () => onForward(message) : undefined}
          onReply={onReply ? () => onReply(message) : undefined}
          onAiTrace={onAiTrace ? () => onAiTrace(message.id) : undefined}
          onOptimisticUpdate={onOptimisticUpdate}
        />
      </div>
    </div>
    <UserProfileDrawer userId={profileUserId} onClose={() => setProfileUserId(null)} />
    </>
  )
}
