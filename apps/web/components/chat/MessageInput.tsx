'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Pencil, Mic } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useQuickReaction } from '@/lib/quick-reaction'
import { useVoiceRecorder } from '@/lib/hooks/use-voice-recorder'
import { useStagedAttachments } from '@/lib/hooks/use-staged-attachments'
import { useMentionParticipants } from '@/lib/hooks/use-mention-participants'
import { AI_BOT_ID } from '@/lib/constants'
import { FILE_TOO_LARGE } from '@/lib/api/chat'
import { EmojiStickerPicker } from '@/components/chat/EmojiStickerPicker'
import { MediaPreviewStrip } from '@/components/chat/MediaPreviewStrip'
import {
  ReplyBanner, EditBanner, RecordingBar, AttachMenu, SlashSuggestion, MentionPopover,
} from '@/components/chat/MessageInputParts'
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

  const participants = useMentionParticipants(conversation)
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

  const {
    pendingAttachments,
    isAllHD,
    stageImages,
    stageFile,
    removeAttachment,
    toggleAllHD,
    flushAttachments,
  } = useStagedAttachments()

  // Mentions state
  const [mentionCandidates, setMentionCandidates] = useState<{ id: string; name: string }[]>([])
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionQuery, setMentionQuery] = useState<{ start: number, end: number, text: string } | null>(null)

  // Grow the textarea to fit content, capped at max-h-32 (128px). Driven by JS
  // (not `field-sizing-content`) so the empty box doesn't grow to the placeholder.
  const resizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

  // Populate textarea when entering edit mode
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingMessage) {
        setValue(editingMessage.content)
        textareaRef.current?.focus()
      } else {
        setValue('')
      }
      resizeTextarea()
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
    resizeTextarea()

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
    // Staged attachments take priority: upload + send, then stop (text isn't
    // sent in the same action — matches Messenger/Zalo).
    if (pendingAttachments.length > 0 && !editingMessage) {
      if (sending) return
      setSending(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      onTypingChange?.(false)
      try {
        await flushAttachments(onSend)
      } catch (err) {
        const tooLarge = err instanceof Error && err.message === FILE_TOO_LARGE
        toast.error(tooLarge ? t('uploadTooLarge') : t('uploadError'))
      } finally {
        setSending(false)
      }
      return
    }

    const content = value.trim()
    if (!content || sending) return
    setSending(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    onTypingChange?.(false)
    try {
      await onSend(content, 'text')
      setValue('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      textareaRef.current?.focus()
    } finally {
      setSending(false)
    }
  }

  // `/new` slash command: send it as a plain text message. ai-service intercepts
  // it to start a fresh session (mirrors the AiSessionPanel "new" button).
  const sendSlashNew = async () => {
    if (sending) return
    setSending(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    onTypingChange?.(false)
    try {
      await onSend('/new', 'text')
      setValue('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      textareaRef.current?.focus()
    } finally {
      setSending(false)
    }
  }

  // Show the `/new` suggestion only in 1-1 (direct) AI conversations, when the
  // input is exactly '/', and not while editing or mentioning. In GROUP AI
  // conversations a bare `/new` never starts a session (chat-service only routes
  // `@AI`-mentioned messages), so we hide the suggestion there.
  const isDirectAiConversation =
    conversation?.type !== 'group' &&
    (conversation?.participants?.includes(AI_BOT_ID) ?? false)
  const showSlashSuggestion =
    isDirectAiConversation && value === '/' && !editingMessage && !mentionQuery

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

  const busy = disabled || sending || uploading

  return (
    <div className="flex flex-col border-t bg-background pb-safe">
      {/* Reply banner */}
      {replyingTo && !editingMessage && (
        <ReplyBanner replyingTo={replyingTo} onCancelReply={onCancelReply} />
      )}

      {/* Edit mode banner */}
      {editingMessage && (
        <EditBanner editingMessage={editingMessage} onCancelEdit={onCancelEdit} />
      )}

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={stageImages}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={stageFile}
      />

      {/* Staged attachments preview (above the composer row) */}
      {!editingMessage && (
        <MediaPreviewStrip
          attachments={pendingAttachments}
          isAllHD={isAllHD}
          onRemove={removeAttachment}
          onToggleAllHD={toggleAllHD}
          onAddMore={() => imageInputRef.current?.click()}
        />
      )}

      {recording ? (
        <RecordingBar
          recordSeconds={recordSeconds}
          onCancel={cancelRecording}
          onStopAndSend={stopAndSend}
        />
      ) : (
        <div className="flex items-end gap-1 p-2 md:p-3">
          {/* Attach — left side */}
          {!editingMessage && (
            <AttachMenu
              disabled={busy}
              onPickImage={() => imageInputRef.current?.click()}
              onPickFile={() => fileInputRef.current?.click()}
            />
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
              className="min-h-10 max-h-32 resize-none w-full [field-sizing:fixed]"
              rows={1}
              disabled={disabled || sending}
            />

            {/* `/new` slash suggestion (AI conversations) */}
            {showSlashSuggestion && (
              <SlashSuggestion disabled={busy} onSelect={sendSlashNew} />
            )}

            {/* Mention Popover */}
            {mentionQuery && mentionCandidates.length > 0 && (
              <MentionPopover
                candidates={mentionCandidates}
                activeIndex={mentionIndex}
                onSelect={insertMention}
                onHover={setMentionIndex}
              />
            )}
          </div>

          {/* Emoji — right side, adjacent to Send/Mic */}
          <EmojiStickerPicker
            disabled={busy}
            onInsertEmoji={insertEmoji}
            onSendSticker={(sticker) => onSend(sticker, 'sticker')}
          />

          {/* Send (when text OR staged attachments present) OR Mic+👍 (when empty) */}
          {value.trim() || editingMessage || pendingAttachments.length > 0 ? (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={(!value.trim() && pendingAttachments.length === 0) || busy}
              className="shrink-0 transition-transform duration-[180ms] active:scale-95 tap"
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
                className="shrink-0 tap"
                title={t('attachVoice')}
              >
                <Mic className="size-5 text-pon-cyan" />
              </Button>
              <button
                onClick={() => onSend(quickReaction, 'text')}
                disabled={busy}
                className="size-9 shrink-0 flex items-center justify-center text-xl transition-transform hover:scale-110 active:scale-95 tap"
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
