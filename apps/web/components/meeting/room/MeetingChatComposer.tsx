'use client'

import { useState, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MEETING_LIMITS } from '@/lib/api/meeting-types'
import { useRoom } from './room-context'

const MAX = MEETING_LIMITS.chat
/** The counter shows up from here on. */
const COUNTER_FROM = 1800

/** Message box of the meeting chat: Enter sends, Shift+Enter breaks the line. */
export function MeetingChatComposer() {
  const t = useTranslations('meeting')
  const { controller, realtimeConnected } = useRoom()
  const [text, setText] = useState('')
  const tooLong = text.length > MAX
  const canSend = realtimeConnected && !tooLong && text.trim().length > 0

  const send = () => {
    if (!canSend) return
    if (controller.sendChat(text) !== null) setText('')
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    send()
  }

  return (
    <div className="shrink-0 space-y-1.5 border-t border-border/60 p-3">
      {!realtimeConnected ? <p className="text-xs text-muted-foreground">{t('chatOffline')}</p> : null}
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={t('chatPlaceholder')}
          placeholder={t('chatPlaceholder')}
          aria-invalid={tooLong || undefined}
          disabled={!realtimeConnected}
          rows={1}
          className="max-h-[7.5rem] min-h-10 resize-none"
        />
        <Button size="icon" className="size-10 shrink-0" aria-label={t('chatSend')} title={t('chatSend')} disabled={!canSend} onClick={send}>
          <SendHorizontal className="size-4" aria-hidden />
        </Button>
      </div>
      {tooLong ? (
        <p role="alert" className="text-xs text-destructive">{t('errChatTooLong', { max: MAX })}</p>
      ) : text.length > COUNTER_FROM ? (
        <p className="text-right text-xs tabular-nums text-muted-foreground">{t('chatCounter', { count: text.length, max: MAX })}</p>
      ) : null}
    </div>
  )
}
