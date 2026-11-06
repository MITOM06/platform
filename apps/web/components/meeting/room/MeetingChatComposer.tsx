'use client'

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { FileText, Loader2, Paperclip, SendHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { chatService, FILE_TOO_LARGE } from '@/lib/api/chat'
import { MEETING_LIMITS } from '@/lib/api/meeting-types'
import type { OutgoingAttachment } from '@/lib/meetings/meeting-room-chat'
import { useRoom } from './room-context'

const MAX = MEETING_LIMITS.chat

/** chat-service answers `/api/uploads/<id>`; if a gateway ever returns it absolute, keep only the path. */
function uploadPath(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}
/** The counter shows up from here on. */
const COUNTER_FROM = 1800

/** Message box of the meeting chat: Enter sends, Shift+Enter breaks the line. */
export function MeetingChatComposer() {
  const t = useTranslations('meeting')
  const { controller, realtimeConnected } = useRoom()
  const [text, setTextState] = useState('')
  /** Always the box's current value; async work (the upload) must read this, never a captured `text`. */
  const textRef = useRef('')
  const setText = (v: string) => {
    textRef.current = v
    setTextState(v)
  }
  const tooLong = text.length > MAX
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  /** Uploaded but not yet sent (offline / left the room): kept so the file is never re-uploaded or lost. */
  const [staged, setStaged] = useState<OutgoingAttachment | null>(null)
  const canSend = realtimeConnected && !tooLong && !uploading && (text.trim().length > 0 || staged !== null)

  /** Sends text + the staged file; clears them only once the controller accepted the line. */
  const deliver = (file: OutgoingAttachment | null): boolean => {
    const current = textRef.current
    if (current.length > MAX) {
      toast.error(t('errChatTooLong', { max: MAX }))
      return false
    }
    const sent = file ? controller.sendChat(current, file) : controller.sendChat(current)
    if (sent === null) return false
    setText('')
    setStaged(null)
    return true
  }

  /** Upload first, then send the file with the typed text as one line. Failures never publish. */
  const attach = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || uploading || !realtimeConnected) return
    if (tooLong) {
      toast.error(t('errChatTooLong', { max: MAX }))
      return
    }
    setUploading(true)
    try {
      const up = await chatService.uploadFile(file)
      const size = Number(up.size)
      const ready: OutgoingAttachment = {
        url: uploadPath(up.url),
        name: up.filename || file.name,
        size: Number.isFinite(size) ? size : file.size,
      }
      setStaged(ready)
      if (textRef.current.length <= MAX && !deliver(ready)) toast.error(t('chatNotSent'))
    } catch (err) {
      toast.error(err instanceof Error && err.message === FILE_TOO_LARGE ? t('chatFileTooLarge') : t('chatUploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  const send = () => {
    if (!canSend) return
    if (!deliver(staged) && staged) toast.error(t('chatNotSent'))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    send()
  }

  return (
    <div className="shrink-0 space-y-1.5 border-t border-border/60 p-3">
      {!realtimeConnected ? <p className="text-xs text-muted-foreground">{t('chatOffline')}</p> : null}
      {staged ? (
        <p className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
          <FileText className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{staged.name}</span>
          <button type="button" className="shrink-0" aria-label={t('chatRemoveFile')} title={t('chatRemoveFile')} onClick={() => setStaged(null)}>
            <X className="size-3.5" aria-hidden />
          </button>
        </p>
      ) : null}
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
