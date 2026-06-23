'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ThumbsUp, ThumbsDown, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMessageFeedback } from '@/lib/hooks/use-message-feedback'
import type { FeedbackRating } from '@/lib/api/types'

interface Props {
  messageId: string
}

/**
 * 👍/👎 feedback control rendered under AI answers. The active vote lives in
 * local optimistic state (no historical votes preloaded for v1). Tapping the
 * active vote again clears it (`none`). Choosing 👎 reveals an optional
 * one-line comment input.
 */
export function MessageFeedback({ messageId }: Props) {
  const t = useTranslations('chat')
  const { mutate } = useMessageFeedback()
  const [rating, setRating] = useState<FeedbackRating>('none')
  const [comment, setComment] = useState('')
  const [commentSent, setCommentSent] = useState(false)

  const vote = (next: 'up' | 'down') => {
    const resolved: FeedbackRating = rating === next ? 'none' : next
    setRating(resolved)
    setCommentSent(false)
    if (resolved !== 'down') setComment('')
    mutate({ messageId, rating: resolved })
  }

  const sendComment = () => {
    const trimmed = comment.trim()
    if (!trimmed) return
    mutate({ messageId, rating: 'down', comment: trimmed })
    setCommentSent(true)
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <div className="flex items-center gap-1 text-muted-foreground/70">
        <button
          type="button"
          aria-label={t('feedbackHelpful')}
          aria-pressed={rating === 'up'}
          onClick={() => vote('up')}
          className={cn(
            'rounded-md p-1 transition-colors hover:bg-muted hover:text-foreground',
            rating === 'up' && 'bg-pon-cyan/15 text-pon-cyan hover:text-pon-cyan',
          )}
        >
          <ThumbsUp className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={t('feedbackNotHelpful')}
          aria-pressed={rating === 'down'}
          onClick={() => vote('down')}
          className={cn(
            'rounded-md p-1 transition-colors hover:bg-muted hover:text-foreground',
            rating === 'down' && 'bg-destructive/15 text-destructive hover:text-destructive',
          )}
        >
          <ThumbsDown className="size-3.5" />
        </button>
        {rating === 'up' && (
          <span className="ml-1 text-[11px] text-muted-foreground/80">{t('feedbackThanks')}</span>
        )}
      </div>

      {rating === 'down' &&
        (commentSent ? (
          <span className="text-[11px] text-muted-foreground/80">{t('feedbackThanks')}</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendComment()
              }}
              placeholder={t('feedbackCommentPlaceholder')}
              className="h-7 w-full max-w-xs rounded-md border border-border/60 bg-background px-2 text-xs outline-none focus:border-primary/50"
            />
            <button
              type="button"
              aria-label={t('feedbackSend')}
              onClick={sendComment}
              disabled={!comment.trim()}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Send className="size-3.5" />
            </button>
          </div>
        ))}
    </div>
  )
}
