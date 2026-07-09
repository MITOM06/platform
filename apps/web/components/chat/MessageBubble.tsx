'use client'

import { useState, useRef, memo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Phone, Video, Check, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MessageActions } from './MessageActions'
import { UserProfileDrawer } from './UserProfileDrawer'
import { GroupReadDetailsModal } from './GroupReadDetailsModal'
import { ReactionsDetailModal } from './ReactionsDetailModal'
import { MessageFeedback } from './MessageFeedback'
import { MessageSources } from './MessageSources'
import { ExternalBotBubble } from './ExternalBotBubble'
import { MessageBubbleBody } from './MessageBubbleBody'
import { formatTime, ReactionBadge, BARE_TYPES, isEmojiOnly } from './message-bubble-helpers'
import { humanizeSystemMessage, humanizeMessagePreview } from '@/lib/system-messages'
import { useNickname, getNickname } from '@/lib/nicknames'
import { useUser } from '@/lib/hooks/use-user'
import { useQueryClient } from '@tanstack/react-query'
import { type Message, isExternalBot } from '@/lib/api/types'

interface Props {
  message: Message
  isOwn: boolean
  currentUserId?: string
  conversationId?: string
  otherUserId?: string
  isPinned?: boolean
  pinnedCount?: number
  isGroup?: boolean
  onEdit?: (message: Message) => void
  onForward?: (message: Message) => void
  onReply?: (message: Message) => void
  onAiTrace?: (messageId: string) => void
  onOptimisticUpdate: (updated: Partial<Message> & { id: string }) => void
  onMenuOpen?: (createdAt: string) => void
  onMenuClose?: () => void
  /** Multi-select thread mode: whole row toggles selection, actions are hidden. */
  multiSelectMode?: boolean
  isSelected?: boolean
  onSelectMessage?: (message: Message) => void
  onEnterMultiSelect?: () => void
}

const MessageBubbleInner = function MessageBubble({
  message,
  isOwn,
  currentUserId,
  conversationId,
  otherUserId,
  isPinned = false,
  pinnedCount = 0,
  isGroup = false,
  onEdit,
  onForward,
  onReply,
  onAiTrace,
  onOptimisticUpdate,
  onMenuOpen,
  onMenuClose,
  multiSelectMode = false,
  isSelected = false,
  onSelectMessage,
  onEnterMultiSelect,
}: Props) {
  const t = useTranslations('chat')
  const locale = useLocale()
  const queryClient = useQueryClient()
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

  // Resolve an actor's display name for system codes that carry an actor id
  // (e.g. `system.message.pinned:<actorId>`) and for humanizing system reply
  // quotes. Order: current user → "You", conversation nickname, cached profile.
  const resolveName = (actorId: string): string | undefined => {
    if (actorId === currentUserId) return t('you')
    const nick = conversationId ? getNickname(conversationId, actorId) : undefined
    if (nick) return nick
    const cached = queryClient.getQueryData<{ displayName?: string }>(['user', actorId])
    return cached?.displayName
  }

  // Multi-select: the whole row toggles selection — overlay a checkbox and
  // neutralize inner controls so any tap selects instead of firing actions.
  const wrapSelectable = (node: React.ReactNode) => {
    if (!multiSelectMode) return node
    return (
      <div
        className={cn(
          'relative cursor-pointer select-none rounded-xl transition-colors',
          isSelected && 'bg-pon-cyan/10',
        )}
        onClick={() => onSelectMessage?.(message)}
      >
        <div className="absolute left-1 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div
            className={cn(
              'size-5 rounded-full border-2 flex items-center justify-center transition-colors',
              isSelected ? 'bg-pon-cyan border-pon-cyan' : 'border-muted-foreground/50 bg-background/80',
            )}
          >
            {isSelected && <Check className="size-3 text-black" strokeWidth={3} />}
          </div>
        </div>
        <div className="pl-8 pointer-events-none">{node}</div>
      </div>
    )
  }

  if (message.recalled) {
    return wrapSelectable(
      <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[70%] rounded-[24px] px-4 py-2 text-sm italic text-muted-foreground border border-dashed bg-muted/20">
          {t('recalled')}
        </div>
      </div>,
    )
  }

  if (message.type === 'system') {
    // Humanise structured system events (parity with Flutter message_bubble_parts.dart).
    const systemText = humanizeSystemMessage(message.content, t, { resolveName })
    const isCallMsg = message.content.startsWith('system.call.')
    const isVideoCall = isCallMsg && message.content.includes(':video')
    return wrapSelectable(
      <div className="flex justify-center my-1">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/65 rounded-full px-3 py-1 border border-border/20">
          {isCallMsg && (isVideoCall
            ? <Video className="size-3 shrink-0" />
            : <Phone className="size-3 shrink-0" />
          )}
          {systemText}
        </span>
      </div>,
    )
  }

  // Personal assistant bot (Bot Factory) — distinct identity via ExternalBotBubble.
  // Rendered before reaction/feedback logic since bot messages carry none of it.
  if (isExternalBot(message.senderId)) {
    return wrapSelectable(<ExternalBotBubble message={message} />)
  }

  // Group reactions by emoji
  const reactionMap = new Map<string, number>()
  message.reactions?.forEach((r) => {
    reactionMap.set(r.emoji, (reactionMap.get(r.emoji) ?? 0) + 1)
  })

  const isBare = BARE_TYPES.has(message.type)
  // Emoji-only text renders large and frameless (no bubble), like Messenger.
  const isEmojiMsg = message.type === 'text' && isEmojiOnly(message.content)
  // Feedback only on real AI answers — not the error/quota/interrupted sentinels.
  const showFeedback =
    message.type === 'ai' &&
    !['__AI_ERROR__', '__AI_QUOTA__', '__AI_INTERRUPTED__', '__AI_UNAVAILABLE__'].includes(
      message.content,
    )

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
      {/* Never render replied-to content raw (system code / upload URL / JSON
          payload — rule: no-raw-system-data-in-ui); humanize by sniffing it. */}
      <p className="truncate italic">
        {humanizeMessagePreview(message.replyPreview.content, undefined, t, {
          short: true,
          resolveName,
        })}
      </p>
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

  // Read receipt tick for OWN messages in direct chats (parity with mobile):
  // single check = sent, double cyan check = seen (otherUserId in readBy).
  const isRead = !!otherUserId && (message.readBy?.includes(otherUserId) ?? false)
  const readTick = isOwn && !isGroup && otherUserId && (
    isRead
      ? <CheckCheck className="size-3 text-pon-cyan" aria-label={t('seen')} />
      : <Check className="size-3 opacity-50" aria-label={t('sent')} />
  )

  // Read receipt + "edited" marker, shown below the bubble (time lives in the
  // hover tooltip / group separator).
  const metaRow = (readTick || message.editedAt) && (
    <div className={cn('flex items-center gap-1', isOwn ? 'justify-end' : 'justify-start')}>
      {message.editedAt && (
        <span className="text-[10px] italic text-muted-foreground/70">{t('edited')}</span>
      )}
      {readTick}
    </div>
  )

  // Exact-time tooltip revealed on hover, beside the bubble (desktop pointer).
  const hoverTime = (
    <span
      className={cn(
        'absolute top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap',
        isOwn ? 'right-full mr-2' : 'left-full ml-2',
      )}
    >
      {formatTime(message.createdAt, locale)}
    </span>
  )

  // ── Inner content by type ──────────────────────────────────────────────────
  const body = <MessageBubbleBody message={message} isOwn={isOwn} isPinned={isPinned} />

  return (
    <>
    {wrapSelectable(
    <div
      className={cn('flex group', isOwn ? 'flex-row-reverse' : 'flex-row', 'items-end gap-1')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onClick={handleRowClick}
    >
      <div className="relative flex flex-col gap-1 max-w-[70%]">
        {hoverTime}
        {isEmojiMsg ? (
          <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
            {senderLabel}
            {replyPreview}
            {/* Emoji-only: large & frameless, no bubble background/border. */}
            <span className="text-5xl leading-none select-none py-0.5">{message.content}</span>
          </div>
        ) : isBare ? (
          <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
            {senderLabel}
            {replyPreview}
            {body}
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
            {showFeedback && message.sources && message.sources.length > 0 && (
              <MessageSources sources={message.sources} conversationId={conversationId} />
            )}
          </div>
        )}

        {metaRow}

        {/* AI answer feedback (👍/👎) — under the bubble, AI messages only */}
        {showFeedback && (
          <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
            <MessageFeedback messageId={message.id} />
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

      {/* Action menu — visible on hover (desktop) or long-press (touch).
          Hidden entirely in multi-select mode (row is a selection target). */}
      {!multiSelectMode && (
        <div className={cn('flex items-center mb-1', !hovered && !longPressActive && 'invisible')}>
          <MessageActions
            message={message}
            isOwn={isOwn}
            currentUserId={currentUserId}
            isPinned={isPinned}
            pinnedCount={pinnedCount}
            onEdit={onEdit ? () => onEdit(message) : undefined}
            onForward={onForward ? () => onForward(message) : undefined}
            onReply={onReply ? () => onReply(message) : undefined}
            onAiTrace={onAiTrace ? () => onAiTrace(message.id) : undefined}
            onOptimisticUpdate={onOptimisticUpdate}
            onGroupReadDetails={isOwn && isGroup ? () => setShowReadDetails(true) : undefined}
            onReactionsDetail={message.reactions && message.reactions.length > 0 ? () => setShowReactionsDetail(true) : undefined}
            onEnterMultiSelect={onEnterMultiSelect}
            onMenuOpen={onMenuOpen ? () => onMenuOpen(message.createdAt) : undefined}
            onMenuClose={onMenuClose}
          />
        </div>
      )}
    </div>,
    )}
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
    prev.message.sources === next.message.sources &&
    prev.isPinned === next.isPinned &&
    prev.pinnedCount === next.pinnedCount &&
    prev.isOwn === next.isOwn &&
    prev.conversationId === next.conversationId &&
    prev.multiSelectMode === next.multiSelectMode &&
    prev.isSelected === next.isSelected,
)
