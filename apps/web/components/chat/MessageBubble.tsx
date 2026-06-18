'use client'

import { useState, useRef, memo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Phone, Video, Check, CheckCheck, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { firstUrl } from '@/lib/media'
import { MessageActions } from './MessageActions'
import { ImageContent, VideoContent } from './ImageContent'
import { FileContent } from './FileContent'
import { VoiceMessage } from './VoiceMessage'
import { LinkPreviewCard } from './LinkPreviewCard'
import { UserProfileDrawer } from './UserProfileDrawer'
import { GroupReadDetailsModal } from './GroupReadDetailsModal'
import { ReactionsDetailModal } from './ReactionsDetailModal'
import { humanizeSystemMessage } from '@/lib/system-messages'
import { useNickname } from '@/lib/nicknames'
import { useUser } from '@/lib/hooks/use-user'
import type { Message } from '@/lib/api/types'

interface Props {
  message: Message
  isOwn: boolean
  currentUserId?: string
  conversationId?: string
  otherUserId?: string
  isPinned?: boolean
  isGroup?: boolean
  onEdit?: (message: Message) => void
  onForward?: (message: Message) => void
  onReply?: (message: Message) => void
  onAiTrace?: (messageId: string) => void
  onOptimisticUpdate: (updated: Partial<Message> & { id: string }) => void
}

function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ReactionBadge({ emoji, count, onClick }: { emoji: string; count: number; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="inline-flex items-center gap-0.5 bg-muted border rounded-full px-1.5 py-0.5 text-xs leading-none hover:bg-muted/80 transition-colors"
    >
      {emoji}
      {count > 1 && <span className="text-muted-foreground">{count}</span>}
    </button>
  )
}

// Media types render without the colored chat bubble (mirror Flutter).
const BARE_TYPES = new Set(['image', 'video', 'sticker'])

const MessageBubbleInner = function MessageBubble({
  message,
  isOwn,
  currentUserId,
  conversationId,
  otherUserId,
  isPinned = false,
  isGroup = false,
  onEdit,
  onForward,
  onReply,
  onAiTrace,
  onOptimisticUpdate,
}: Props) {
  const t = useTranslations('chat')
  const locale = useLocale()
  // Resolve nicknames for sender + reply-preview sender (W-15.4 parity).
  const senderNickname = useNickname(conversationId ?? '', message.senderId)
  const replyNickname = useNickname(conversationId ?? '', message.replyPreview?.senderId)
  const senderDisplay = senderNickname || message.senderName || ''
  // Resolve the replied-to message's author (not the current message's sender).
  const { data: repliedSender } = useUser(message.replyPreview?.senderId)
  const [hovered, setHovered] = useState(false)
  const [longPressActive, setLongPressActive] = useState(false)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [showReadDetails, setShowReadDetails] = useState(false)
  const [showReactionsDetail, setShowReactionsDetail] = useState(false)
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
    // Humanise structured system events (parity with Flutter message_bubble_parts.dart).
    const systemText = humanizeSystemMessage(message.content, t)
    const isCallMsg = message.content.startsWith('system.call.')
    const isVideoCall = isCallMsg && message.content.includes(':video')
    return (
      <div className="flex justify-center my-1">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/65 rounded-full px-3 py-1 border border-border/20">
          {isCallMsg && (isVideoCall
            ? <Video className="size-3 shrink-0" />
            : <Phone className="size-3 shrink-0" />
          )}
          {systemText}
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
        {message.replyPreview.senderId === currentUserId
          ? t('you')
          : (replyNickname || repliedSender?.displayName || '')}
      </p>
      <p className="truncate italic">{message.replyPreview.content}</p>
    </button>
  )

  const openProfile = () => {
    if (!isOwn && message.senderId) setProfileUserId(message.senderId)
  }

  const senderLabel = !isOwn && senderDisplay && (
    <button
      type="button"
      onClick={openProfile}
      className="text-xs font-semibold mb-1 text-primary/80 text-left hover:underline"
    >
      {senderDisplay}
    </button>
  )

  // Read receipt tick for OWN messages in direct chats (parity with mobile
  // message_bubble.dart): single check = sent, double cyan check = seen by the
  // other participant (their userId present in readBy).
  const isRead = !!otherUserId && (message.readBy?.includes(otherUserId) ?? false)
  const readTick = isOwn && !isGroup && otherUserId && (
    isRead
      ? <CheckCheck className="size-3 text-pon-cyan" aria-label={t('seen')} />
      : <Check className="size-3 opacity-50" aria-label={t('sent')} />
  )

  const timeLabel = (
    <p
      className={cn(
        'text-[10px] mt-1.5 text-right font-medium tracking-wide flex items-center justify-end gap-1',
        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground/80',
      )}
    >
      {formatTime(message.createdAt, locale)}
      {message.editedAt && <span className="italic opacity-85">{t('edited')}</span>}
      {readTick}
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
    case 'ai':
      if (message.content === '__AI_ERROR__') {
        body = (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {t('aiError')}
          </span>
        )
      } else if (message.content === '__AI_QUOTA__') {
        body = (
          <p className="text-sm italic text-muted-foreground">{t('aiQuotaExceeded')}</p>
        )
      } else if (message.content === '__AI_INTERRUPTED__') {
        body = (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {t('aiStreamInterrupted')}
          </span>
        )
      } else if (message.content === '__AI_UNAVAILABLE__') {
        body = (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {t('aiUnavailable')}
          </span>
        )
      } else {
        body = (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        )
      }
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
            <span className="mt-0.5 text-[10px] font-medium text-muted-foreground/70 flex items-center gap-1">
              {formatTime(message.createdAt, locale)}
              {readTick}
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
              <ReactionBadge 
                key={emoji} 
                emoji={emoji} 
                count={count} 
                onClick={() => setShowReactionsDetail(true)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action menu — visible on hover (desktop) or long-press (touch) */}
      <div className={cn('flex items-center mb-1', !hovered && !longPressActive && 'invisible')}>
        <MessageActions
          message={message}
          isOwn={isOwn}
          currentUserId={currentUserId}
          isPinned={isPinned}
          onEdit={onEdit ? () => onEdit(message) : undefined}
          onForward={onForward ? () => onForward(message) : undefined}
          onReply={onReply ? () => onReply(message) : undefined}
          onAiTrace={onAiTrace ? () => onAiTrace(message.id) : undefined}
          onOptimisticUpdate={onOptimisticUpdate}
          onGroupReadDetails={isOwn && isGroup ? () => setShowReadDetails(true) : undefined}
          onReactionsDetail={message.reactions && message.reactions.length > 0 ? () => setShowReactionsDetail(true) : undefined}
        />
      </div>
    </div>
    <UserProfileDrawer userId={profileUserId} onClose={() => setProfileUserId(null)} />
    {showReadDetails && <GroupReadDetailsModal message={message} open={showReadDetails} onClose={() => setShowReadDetails(false)} />}
    {showReactionsDetail && <ReactionsDetailModal message={message} open={showReactionsDetail} onClose={() => setShowReactionsDetail(false)} />}
    </>
  )
}

export const MessageBubble = memo(
  MessageBubbleInner,
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.recalled === next.message.recalled &&
    prev.message.editedAt === next.message.editedAt &&
    prev.message.reactions === next.message.reactions &&
    prev.message.readBy === next.message.readBy &&
    prev.isPinned === next.isPinned &&
    prev.isOwn === next.isOwn &&
    prev.conversationId === next.conversationId,
)
