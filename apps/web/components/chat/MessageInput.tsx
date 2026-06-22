'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Send, X, Pencil, Paperclip, ImagePlus, FileText, Mic, Trash2, Reply,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authService } from '@/lib/api/auth'
import { useQuickReaction } from '@/lib/quick-reaction'
import { useVoiceRecorder } from '@/lib/hooks/use-voice-recorder'
import { useFileAttachments } from '@/lib/hooks/use-file-attachments'
import { useAuthStore } from '@/lib/store/auth.store'
import { EmojiStickerPicker } from '@/components/chat/EmojiStickerPicker'
import type { Message, MessageType, Conversation } from '@/lib/api/types'

interface Props {
  onSend: (content: string, type?: MessageType) => Promise<void>
  onTypingChange?: (isTyping: boolean) => void
  disabled?: boolean
  editingMessage?: Message | null
  onCancelEdit?: () => void
  replyingTo?: Message | null
  onCancelReply?: () => void
  conversation?: Conversation
}

export function MessageInput({
  onSend,
  onTypingChange,
  disabled,
  editingMessage,
  onCancelEdit,
  replyingTo,
  onCancelReply,
  conversation,
}: Props) {
  const t = useTranslations('chat')
  const quickReaction = useQuickReaction(conversation?.id ?? '')
  const currentUserId = useAuthStore((s) => s.user?.id)

  // Resolve group participant userIds → display names for @mentions. Mirrors
  // Flutter (mention_list.dart) which filters + inserts by display name. The
  // AI bot and self are excluded from the candidate list.
  const queryClient = useQueryClient()
  const mentionableIds = (conversation?.type === 'group'
    ? conversation.participants.filter(
        (p) => p !== currentUserId && p !== 'ai-bot-000000000000000000000001',
      )
    : []
  )
  // Resolve all mentionable participants in ONE batched request (was an N+1
  // useQueries fanning out one request per participant → 429s), then seed the
  // per-id `['user', id]` cache so other consumers (useUser) hit cache too.
  const mentionKey = [...mentionableIds].sort().join(',')
  const { data: batchedUsers } = useQuery({
    queryKey: ['users-batch', mentionKey],
    queryFn: () => authService.getUsers(mentionableIds),
    enabled: mentionableIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
  useEffect(() => {
    batchedUsers?.forEach((u) => queryClient.setQueryData(['user', u.id], u))
  }, [batchedUsers, queryClient])
  const participants = mentionableIds.map((uid) => {
    const cached = queryClient.getQueryData<{ displayName?: string }>(['user', uid])
    return { id: uid, name: cached?.displayName ?? uid }
  })
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { recording, recordSeconds, startRecording, stopAndSend, cancelRecording } =
    useVoiceRecorder({
      onSend,
      onUploadingChange: setUploading,
      labels: {
        unsupported: t('recordingUnsupported'),
        sendError: t('voiceSendError'),
        micError: t('micError'),
      },
    })

  const { handleImagePick, handleFilePick } = useFileAttachments({
    onSend,
    onUploadingChange: setUploading,
    uploadErrorLabel: t('uploadError'),
  })

  // Mentions state
  const [mentionCandidates, setMentionCandidates] = useState<{ id: string; name: string }[]>([])
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionQuery, setMentionQuery] = useState<{ start: number, end: number, text: string } | null>(null)

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
    const val = e.target.value
    setValue(val)

    // Check for mention
    const cursor = e.target.selectionStart
    const textBeforeCursor = val.slice(0, cursor)
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/)

    if (match && conversation && conversation.type === 'group') {
      const q = match[1].toLowerCase()
      const candidates = participants.filter((p) => p.name.toLowerCase().includes(q))
      if (candidates.length > 0) {
        setMentionCandidates(candidates)
        setMentionQuery({ start: match.index!, end: cursor, text: q })
        setMentionIndex(0)
      } else {
        setMentionQuery(null)
      }
    } else {
      setMentionQuery(null)
    }

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
    if (mentionQuery) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => (i + 1) % mentionCandidates.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(mentionCandidates[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
    }

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

  const insertMention = (candidate: { id: string; name: string }) => {
    if (!mentionQuery) return
    const el = textareaRef.current
    const before = value.slice(0, mentionQuery.start)
    const after = value.slice(mentionQuery.end)
    const inserted = `@${candidate.name} `
    setValue(before + inserted + after)
    setMentionQuery(null)

    if (el) {
      requestAnimationFrame(() => {
        el.focus()
        el.selectionStart = el.selectionEnd = before.length + inserted.length
      })
    }
  }

  const fmtSeconds = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const busy = disabled || sending || uploading

  return (
    <div className="flex flex-col border-t bg-background" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Reply banner */}
      {replyingTo && !editingMessage && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b text-sm">
          <Reply className="size-3.5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-primary">
              {t('replyTo', { name: replyingTo.senderName || '' })}
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
            {t('editing', { content: editingMessage.content })}
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
            {t('recording', { time: fmtSeconds(recordSeconds) })}
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
          {/* Attach — left side */}
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
                  {t('attachImageVideo')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <FileText className="size-4" />
                  {t('attachFile')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="relative flex-1 min-w-0">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={
                editingMessage
                  ? t('editPlaceholder')
                  : t('inputPlaceholder')
              }
              className="min-h-10 max-h-32 resize-none w-full"
              rows={1}
              disabled={disabled || sending}
            />

            {/* Mention Popover */}
            {mentionQuery && mentionCandidates.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-48 max-h-48 overflow-y-auto bg-popover border rounded-xl shadow-lg z-50">
                <div className="p-1 space-y-0.5">
                  {mentionCandidates.map((candidate, idx) => (
                    <button
                      key={candidate.id}
                      onClick={() => insertMention(candidate)}
                      onMouseEnter={() => setMentionIndex(idx)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg truncate transition-colors ${
                        idx === mentionIndex ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      {candidate.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Emoji — right side, adjacent to Send/Mic */}
          <EmojiStickerPicker
            disabled={busy}
            onInsertEmoji={insertEmoji}
            onSendSticker={(sticker) => onSend(sticker, 'sticker')}
          />

          {/* Send (when text present) OR Mic+👍 (when empty) */}
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
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={startRecording}
                disabled={busy}
                className="shrink-0"
                title={t('attachVoice')}
              >
                <Mic className="size-5 text-pon-cyan" />
              </Button>
              <button
                onClick={() => onSend(quickReaction, 'text')}
                disabled={busy}
                className="size-9 shrink-0 flex items-center justify-center text-xl transition-transform hover:scale-110 active:scale-95"
                title={t('quickSend')}
              >
                {quickReaction}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
