'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { firstUrl } from '@/lib/media'
import { ImageContent, VideoContent } from './ImageContent'
import { FileContent } from './FileContent'
import { VoiceMessage } from './VoiceMessage'
import { LinkPreviewCard } from './LinkPreviewCard'
import { MeetingSummaryCard } from './MeetingSummaryCard'
import { MarkdownContent } from './MarkdownContent'
import type { Message } from '@/lib/api/types'

interface Props {
  message: Message
  isOwn: boolean
  isPinned: boolean
}

// Renders the inner content of a chat bubble by message type. Extracted from
// MessageBubble.tsx; behaviour is identical (the same switch + AI sentinels).
export function MessageBubbleBody({ message, isOwn, isPinned }: Props) {
  const t = useTranslations('chat')
  const linkUrl = message.type === 'text' ? firstUrl(message.content) : null

  switch (message.type) {
    case 'image':
      return <ImageContent content={message.content} />
    case 'video':
      return <VideoContent content={message.content} />
    case 'sticker':
      return <span className="text-5xl leading-none">{message.content}</span>
    case 'file':
      return <FileContent content={message.content} isOwn={isOwn} />
    case 'voice':
      return <VoiceMessage content={message.content} isOwn={isOwn} />
    case 'meeting_summary':
      return <MeetingSummaryCard content={message.content} isPinned={isPinned} />
    case 'ai':
      if (message.content === '__AI_ERROR__') {
        return (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {t('aiError')}
          </span>
        )
      }
      if (message.content === '__AI_QUOTA__') {
        return (
          <div className="text-sm italic text-muted-foreground space-y-1">
            <p>{t('aiQuotaExceeded')}</p>
            <Link
              href="/token-usage"
              className="not-italic font-medium text-primary underline underline-offset-2 hover:opacity-80"
            >
              {t('viewUsage')}
            </Link>
          </div>
        )
      }
      if (message.content === '__AI_INTERRUPTED__') {
        return (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {t('aiStreamInterrupted')}
          </span>
        )
      }
      if (message.content === '__AI_UNAVAILABLE__') {
        return (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {t('aiUnavailable')}
          </span>
        )
      }
      return <MarkdownContent content={message.content} />
    default:
      return (
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
}
