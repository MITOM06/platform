'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import type { MeetingAttachment, MeetingMessage } from '@/lib/api/meeting-types'
import { FileCard } from '@/components/chat/FileContent'
import { MarkdownContent } from '@/components/chat/MarkdownContent'
import { safeDisplayName } from '@/lib/chat/names'
import { AI_BOT_ID } from '@/lib/constants'
import type { MessageKey } from '@/lib/meetings/meeting-errors'
import type { AiNotice, PendingChat } from '@/lib/store/meeting.store'
import { cn } from '@/lib/utils'
import { useRoom } from './room-context'

/** Consecutive lines of one person within this window share one name. */
const GROUP_MS = 2 * 60_000

export function sameGroup(prev: MeetingMessage | undefined, m: MeetingMessage): boolean {
  if (!prev || prev.sender.userId !== m.sender.userId) return false
  return Date.parse(m.createdAt) - Date.parse(prev.createdAt) <= GROUP_MS
}

/** The file of a chat line as a card; the URL itself is never shown. */
function AttachmentCard({ attachment, mine }: { attachment: MeetingAttachment; mine: boolean }) {
  return (
    <div className={cn('max-w-[85%] rounded-lg px-3 py-2', mine ? 'bg-accent text-accent-foreground' : 'bg-muted')}>
      <FileCard url={attachment.url} name={attachment.name} size={attachment.size} isOwn={false} />
    </div>
  )
}

/** A delivered line. Plain text only — chat from other people is untrusted; the AI's answer is Markdown. */
export function ChatLine({ message, showName, timeFormat }: {
  message: MeetingMessage
  showName: boolean
  timeFormat: Intl.DateTimeFormat
}) {
  const t = useTranslations('meeting')
  const { myId, myName } = useRoom()
  const isAi = message.sender.userId === AI_BOT_ID
  const mine = !isAi && message.sender.userId === myId
  const at = new Date(message.createdAt)
  const name = isAi
    ? t('aiName')
    : mine
    ? myName || t('you')
    : safeDisplayName(message.sender.displayName, message.sender.userId) ?? t('participantFallback')
  return (
    <li className={cn('flex flex-col', mine ? 'items-end' : 'items-start', showName ? 'mt-3' : 'mt-1')}>
      {showName ? (
        <p className="mb-0.5 flex items-baseline gap-2 px-1">
          <span className="text-xs font-medium">{name}</span>
          {Number.isNaN(at.getTime()) ? null : (
            <time dateTime={message.createdAt} className="text-[11px] text-muted-foreground">
              {timeFormat.format(at)}
            </time>
          )}
        </p>
      ) : null}
      {isAi ? (
        <div className="max-w-[85%] rounded-lg bg-muted px-3 py-1.5">
          <MarkdownContent content={message.content} disallowImages />
        </div>
      ) : (
        <>
          {message.attachment ? <AttachmentCard attachment={message.attachment} mine={mine} /> : null}
          {message.content ? (
            <p className={cn('max-w-[85%] rounded-lg px-3 py-1.5 text-sm break-words whitespace-pre-wrap', mine ? 'bg-accent text-accent-foreground' : 'bg-muted', message.attachment && 'mt-1')}>
              {message.content}
            </p>
          ) : null}
        </>
      )}
    </li>
  )
}

/** Local system-style line: my `@AI` question got no answer. Never carries the server's code or text. */
export function AiNoticeLine({ notice }: { notice: AiNotice }) {
  const t = useTranslations('meeting')
  return (
    <li className="mt-2 px-2 text-center text-xs text-muted-foreground">{t(notice.key)}</li>
  )
}

/** My line before its echo: sending (dimmed), or failed with Retry / Discard. */
export function PendingLine({ line, error, onRetry, onDiscard }: {
  line: PendingChat
  /** The server's error, or a stand-in once the echo is overdue. */
  error: MessageKey | null
  onRetry(): void
  onDiscard(): void
}) {
  const t = useTranslations('meeting')
  return (
    <li className="mt-1 flex flex-col items-end">
      <div className={cn('flex max-w-[85%] flex-col items-end gap-1', error ? '[&>*]:border [&>*]:border-destructive' : 'opacity-60')}>
        {line.attachment ? (
          <div className="rounded-lg bg-accent px-3 py-2 text-accent-foreground">
            <FileCard url={line.attachment.url} name={line.attachment.name} size={line.attachment.size} isOwn={false} />
          </div>
        ) : null}
        {line.content ? (
          <p className="rounded-lg bg-accent px-3 py-1.5 text-sm break-words whitespace-pre-wrap text-accent-foreground">
            {line.content}
          </p>
        ) : null}
      </div>
      {error ? (
        <div className="mt-0.5 flex flex-wrap items-center justify-end gap-1">
          <span className="text-xs text-destructive">
            {t('chatFailed')} · {t(error.key, error.values)}
          </span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onRetry}>
            {t('chatRetry')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onDiscard}>
            {t('chatDiscard')}
          </Button>
        </div>
      ) : (
        <span className="mt-0.5 text-[11px] text-muted-foreground">{t('chatSending')}</span>
      )}
    </li>
  )
}
