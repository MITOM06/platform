'use client'

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Paperclip, SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { chatService, FILE_TOO_LARGE } from '@/lib/api/chat'
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
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const canSend = realtimeConnected && !tooLong && !uploading && text.trim().length > 0

  /** Upload first, then send the file with the typed text as one line. Failures never publish. */
  const attach = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || uploading || tooLong || !realtimeConnected) return
    setUploading(true)
    try {
      const up = await chatService.uploadFile(file)
      const name = up.filename || file.name
      const size = Number(up.size)
      const sent = controller.sendChat(text, { url: up.url, name, size: Number.isFinite(size) ? size : file.size })
      if (sent !== null) setText('')
    } catch (err) {
      toast.error(err instanceof Error && err.message === FILE_TOO_LARGE ? t('chatFileTooLarge') : t('chatUploadFailed'))
    } finally {
      setUploading(false)
    }
  }

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
      {uploading ? (
        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          {t('chatUploading')}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <input ref={fileInput} type="file" className="hidden" onChange={(e) => void attach(e)} data-testid="chat-file-input" />
        <Button
          size="icon"
          variant="ghost"
          className="size-10 shrink-0"
          aria-label={t('chatAttach')}
          title={t('chatAttach')}
          disabled={!realtimeConnected || uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Paperclip className="size-4" aria-hidden />
        </Button>
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
