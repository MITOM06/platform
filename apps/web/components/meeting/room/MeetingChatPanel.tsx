'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useNow, useTranslations } from 'next-intl'
import { ArrowDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMeetingMessages } from '@/lib/hooks/use-meetings'
import { flattenMessages } from '@/lib/meetings/cache-updates'
import type { MessageKey } from '@/lib/meetings/meeting-errors'
import { useMeetingRoomStore, type PendingChat } from '@/lib/store/meeting.store'
import { ChatLine, PendingLine, sameGroup } from './MeetingChatLines'
import { MeetingChatComposer } from './MeetingChatComposer'
import { useRoom } from './room-context'

/** "Near the bottom": new lines keep the view pinned to the end. */
const NEAR_BOTTOM_PX = 80
/** Older history loads when scrolled this close to the top. */
const NEAR_TOP_PX = 40
/** A line without an echo after this long is shown as failed (network). */
const ECHO_TIMEOUT_MS = 10_000
const OVERDUE: MessageKey = { key: 'errNetwork' }

function lineError(p: PendingChat, now: number): MessageKey | null {
  return p.error ?? (now - p.sentAt > ECHO_TIMEOUT_MS ? OVERDUE : null)
}

/** In-meeting chat: history (older pages on scroll up), my optimistic lines, the composer. */
export function MeetingChatPanel() {
  const t = useTranslations('meeting')
  const locale = useLocale()
  const { meeting, controller } = useRoom()
  const query = useMeetingMessages(meeting.id, true)
  const messages = useMemo(() => flattenMessages(query.data), [query.data])
  const pending = useMeetingRoomStore((s) => s.pendingChat)
  const now = useNow(pending.length ? { updateInterval: 2000 } : undefined).getTime()
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(locale, { timeStyle: 'short' }), [locale])

  const listRef = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  /** Line count when the reader scrolled away from the end (null = at the end). */
  const [awayAt, setAwayAt] = useState<number | null>(null)
  const restore = useRef<{ height: number; top: number } | null>(null)
  const total = messages.length + pending.length
  const unseen = awayAt === null ? 0 : Math.max(0, total - awayAt)

  const loadOlder = () => {
    const el = listRef.current
    if (!el || !query.hasNextPage || query.isFetchingNextPage) return
    restore.current = { height: el.scrollHeight, top: el.scrollTop }
    void query.fetchNextPage()
  }

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
    nearBottom.current = atEnd
    setAwayAt((v) => (atEnd ? null : (v ?? total)))
    if (el.scrollTop <= NEAR_TOP_PX) loadOlder()
  }

  const toEnd = () => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
    nearBottom.current = true
    setAwayAt(null)
  }

  // Older lines were prepended: keep the reader's place.
  const firstId = messages[0]?.id
  useLayoutEffect(() => {
    const el = listRef.current
    const r = restore.current
    if (!el || !r) return
    restore.current = null
    el.scrollTop = el.scrollHeight - r.height + r.top
  }, [firstId])

  // A new line at the end: follow it if the reader is at the end.
  // My own new line always brings the view to the end.
  const lastKey = `${messages.at(-1)?.id ?? ''}|${pending.length}`
  const sentCount = useRef(pending.length)
  useEffect(() => {
    const el = listRef.current
    const justSent = pending.length > sentCount.current
    sentCount.current = pending.length
    if (el && (nearBottom.current || justSent)) el.scrollTop = el.scrollHeight
  }, [lastKey, pending.length])

  const empty = !query.isPending && messages.length === 0 && pending.length === 0
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={listRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {query.hasNextPage ? (
          <Button variant="ghost" size="sm" className="mt-2 w-full" disabled={query.isFetchingNextPage} onClick={loadOlder}>
            {query.isFetchingNextPage ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {t('chatLoadOlder')}
          </Button>
        ) : null}
        {query.isPending ? <Loader2 className="mx-auto mt-6 size-5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden /> : null}
        {empty ? <p className="mt-6 px-2 text-center text-sm text-muted-foreground">{t('chatEmpty')}</p> : null}
        <ul role="log" aria-live="polite" aria-relevant="additions" aria-label={t('chatTitle')}>
          {messages.map((m, i) => (
            <ChatLine key={m.id} message={m} showName={!sameGroup(messages[i - 1], m)} timeFormat={timeFormat} />
          ))}
          {pending.map((p) => (
            <PendingLine
              key={p.clientId}
              line={p}
              error={lineError(p, now)}
              onRetry={() => controller.retryChat(p.clientId)}
              onDiscard={() => controller.discardChat(p.clientId)}
            />
          ))}
        </ul>
      </div>
      {unseen > 0 ? (
        <Button size="sm" variant="secondary" className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full shadow-none" onClick={toEnd}>
          <ArrowDown className="size-4" aria-hidden />
          {t('chatUnread', { count: unseen })}
        </Button>
      ) : null}
      <MeetingChatComposer />
    </div>
  )
}
