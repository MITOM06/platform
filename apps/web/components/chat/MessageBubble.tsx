'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MessageActions } from './MessageActions'
import type { Message } from '@/lib/api/types'

interface Props {
  message: Message
  isOwn: boolean
  isPinned?: boolean
  onEdit?: (message: Message) => void
  onForward?: (message: Message) => void
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

export function MessageBubble({
  message,
  isOwn,
  isPinned = false,
  onEdit,
  onForward,
  onAiTrace,
  onOptimisticUpdate,
}: Props) {
  const [hovered, setHovered] = useState(false)

  if (message.recalled) {
    return (
      <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[70%] rounded-2xl px-3 py-2 text-sm italic text-muted-foreground border border-dashed">
          Tin nhắn đã bị thu hồi
        </div>
      </div>
    )
  }

  if (message.type === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
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

  return (
    <div
      className={cn('flex group', isOwn ? 'flex-row-reverse' : 'flex-row', 'items-end gap-1')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex flex-col gap-1 max-w-[70%]">
        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm break-words',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted text-foreground rounded-bl-sm',
            isPinned && 'ring-1 ring-primary/40',
          )}
        >
          {!isOwn && message.senderName && (
            <p className="text-xs font-medium mb-1 opacity-70">{message.senderName}</p>
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
          <p
            className={cn(
              'text-xs mt-1 text-right',
              isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground',
            )}
          >
            {formatTime(message.createdAt)}
            {message.editedAt && <span className="ml-1 italic">đã sửa</span>}
          </p>
        </div>

        {/* Reaction badges */}
        {reactionMap.size > 0 && (
          <div className={cn('flex flex-wrap gap-1', isOwn ? 'justify-end' : 'justify-start')}>
            {Array.from(reactionMap.entries()).map(([emoji, count]) => (
              <ReactionBadge key={emoji} emoji={emoji} count={count} />
            ))}
          </div>
        )}
      </div>

      {/* Action menu — visible on hover */}
      <div className={cn('flex items-center mb-1', !hovered && 'invisible')}>
        <MessageActions
          message={message}
          isOwn={isOwn}
          isPinned={isPinned}
          onEdit={onEdit ? () => onEdit(message) : undefined}
          onForward={onForward ? () => onForward(message) : undefined}
          onAiTrace={onAiTrace ? () => onAiTrace(message.id) : undefined}
          onOptimisticUpdate={onOptimisticUpdate}
        />
      </div>
    </div>
  )
}
