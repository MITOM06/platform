'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, X, Pencil, Paperclip, ImagePlus, FileText, Smile, Mic, Trash2, Reply,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { chatService } from '@/lib/api/chat'
import type { Message, MessageType } from '@/lib/api/types'

const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😮',
  '😢', '😭', '😡', '👍', '👎', '👏', '🙏', '🔥', '❤️', '💔',
  '🎉', '✨', '⭐', '💯', '😴', '🤗', '🥳', '😅', '😇', '🤩',
  '😋', '😜', '🤪', '😬', '🙄', '😏', '🙂', '🥰', '😤', '👌',
]

interface Props {
  onSend: (content: string, type?: MessageType) => Promise<void>
  onTypingChange?: (isTyping: boolean) => void
  disabled?: boolean
  editingMessage?: Message | null
  onCancelEdit?: () => void
  replyingTo?: Message | null
  onCancelReply?: () => void
}

export function MessageInput({
  onSend,
  onTypingChange,
  disabled,
  editingMessage,
  onCancelEdit,
  replyingTo,
  onCancelReply,
}: Props) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)

  // Populate textarea when entering edit mode
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingMessage) {
        setValue(editingMessage.content)
        textareaRef.current?.focus()
      } else {
        setValue('')
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [editingMessage])

  // Focus when starting a reply
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus()
  }, [replyingTo])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    if (onTypingChange && !editingMessage) {
      onTypingChange(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => onTypingChange(false), 3000)
    }
  }

  const handleSend = async () => {
    const content = value.trim()
    if (!content || sending) return
    setSending(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    onTypingChange?.(false)
    try {
      await onSend(content, 'text')
      setValue('')
      textareaRef.current?.focus()
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      if (editingMessage) onCancelEdit?.()
      else if (replyingTo) onCancelReply?.()
    }
  }

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current
    if (!el) {
      setValue((v) => v + emoji)
      return
    }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + emoji + value.slice(end)
    setValue(next)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + emoji.length
    })
  }

  // ── Attachments ─────────────────────────────────────────────────────────────

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    try {
      const images: string[] = []
      for (const file of files) {
        const { url } = await chatService.uploadFile(file)
        if (file.type.startsWith('video/')) {
          await onSend(url, 'video')
        } else {
          images.push(url)
        }
      }
      if (images.length === 1) await onSend(images[0], 'image')
      else if (images.length > 1) await onSend(JSON.stringify(images), 'image')
    } catch {
      toast.error('Tải lên thất bại')
    } finally {
      setUploading(false)
    }
  }

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const { url, filename, size } = await chatService.uploadFile(file)
      await onSend(JSON.stringify({ url, name: filename || file.name, size }), 'file')
    } catch {
      toast.error('Tải lên thất bại')
    } finally {
      setUploading(false)
    }
  }

  // ── Voice recording ───────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    recordTimerRef.current = null
  }, [])

  const startRecording = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Trình duyệt không hỗ trợ ghi âm')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      cancelledRef.current = false
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (cancelledRef.current) return
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size === 0) return
        setUploading(true)
        try {
          const ext = (recorder.mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm'
          const { url } = await chatService.uploadFile(blob, `voice_${Date.now()}.${ext}`)
          await onSend(url, 'voice')
        } catch {
          toast.error('Gửi ghi âm thất bại')
        } finally {
          setUploading(false)
        }
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    } catch {
      toast.error('Không thể truy cập micro')
    }
  }

  const stopAndSend = () => {
    stopTimer()
    setRecording(false)
    recorderRef.current?.stop()
  }

  const cancelRecording = () => {
    cancelledRef.current = true
    stopTimer()
    setRecording(false)
    recorderRef.current?.stop()
  }

  const fmtSeconds = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const busy = disabled || sending || uploading

  return (
    <div className="border-t bg-background">
      {/* Reply banner */}
      {replyingTo && !editingMessage && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b text-sm">
          <Reply className="size-3.5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-primary">
              Trả lời {replyingTo.senderName || ''}
            </p>
            <p className="truncate text-xs text-muted-foreground">{replyingTo.content}</p>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onCancelReply}>
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Edit mode banner */}
      {editingMessage && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b text-sm">
          <Pencil className="size-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground flex-1 truncate text-xs">
            Đang chỉnh sửa: {editingMessage.content}
          </span>
          <Button variant="ghost" size="icon-xs" onClick={onCancelEdit}>
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleImagePick}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFilePick}
      />

      {recording ? (
        <div className="flex items-center gap-3 p-3">
          <Mic className="size-5 animate-pulse text-red-500" />
          <span className="flex-1 text-sm text-muted-foreground">
            Đang ghi âm… {fmtSeconds(recordSeconds)}
          </span>
          <Button variant="ghost" size="icon" onClick={cancelRecording}>
            <Trash2 className="size-4" />
          </Button>
          <Button size="icon" onClick={stopAndSend} className="shrink-0">
            <Send className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-1 p-3">
          {/* Emoji */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" disabled={busy}>
                <Smile className="size-5 text-pon-cyan" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" side="top" align="start">
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJIS.map((emoji, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="rounded p-1 text-lg leading-none transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Attach */}
          {!editingMessage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0" disabled={busy}>
                  <Paperclip className="size-5 text-pon-peach" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top">
                <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                  <ImagePlus className="size-4" />
                  Ảnh / Video
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <FileText className="size-4" />
                  Tệp tin
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              editingMessage
                ? 'Chỉnh sửa tin nhắn... (Enter để lưu, Esc để hủy)'
                : 'Nhập tin nhắn... (Enter để gửi, Shift+Enter xuống dòng)'
            }
            className="min-h-10 max-h-32 resize-none"
            rows={1}
            disabled={disabled || sending}
          />

          {value.trim() || editingMessage ? (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!value.trim() || busy}
              className="shrink-0"
              variant={editingMessage ? 'outline' : 'default'}
            >
              {editingMessage ? <Pencil className="size-4" /> : <Send className="size-4" />}
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={startRecording}
              disabled={busy}
              className="shrink-0"
              title="Ghi âm"
            >
              <Mic className="size-5 text-pon-cyan" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
