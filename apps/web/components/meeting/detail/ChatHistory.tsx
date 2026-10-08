'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MeetingMessage } from '@/lib/api/meeting-types'
import { useMeetingMessages } from '@/lib/hooks/use-meetings'
import { flattenMessages } from '@/lib/meetings/cache-updates'
import { personName } from '@/lib/meetings/display'

function ChatLine({ message, timeFormat }: { message: MeetingMessage; timeFormat: Intl.DateTimeFormat }) {
  const t = useTranslations('meeting')
  const at = new Date(message.createdAt)
  return (
    <li className="space-y-0.5">
      <p className="flex items-baseline gap-2">
        <span className="text-xs font-medium">{personName(message.sender, t('participantFallback'))}</span>
        {Number.isNaN(at.getTime()) ? null : (
          <time dateTime={message.createdAt} className="text-[11px] text-muted-foreground">
            {timeFormat.format(at)}
          </time>
        )}
      </p>
      {/* Plain text only — chat from other people is untrusted. */}
      <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
    </li>
  )
}

/** Read-only history of the in-meeting chat (oldest → newest). */
export function ChatHistory({ meetingId, enabled }: { meetingId: string; enabled: boolean }) {
  const t = useTranslations('meeting')
  const locale = useLocale()
  const query = useMeetingMessages(meetingId, enabled)
  const messages = flattenMessages(query.data)
  const timeFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">{t('sectionChat')}</h2>
      {query.isPending ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
      ) : query.isError ? (
        <p className="text-sm text-muted-foreground">{t('chatHistoryError')}</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('chatHistoryEmpty')}</p>
      ) : (
        <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-border/60 p-3">
          {query.hasNextPage ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('chatLoadOlder')}
            </Button>
          ) : null}
          <ul className="space-y-3">
            {messages.map((m) => (
              <ChatLine key={m.id} message={m} timeFormat={timeFormat} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
