
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
import { useMentionAutocomplete } from '@/lib/hooks/use-mention-autocomplete'
import { AI_BOT_ID } from '@/lib/constants'
import { FILE_TOO_LARGE } from '@/lib/api/chat'
import { isReportedSendError } from '@/lib/chat/send-error'
import { useAuthStore } from '@/lib/store/auth.store'
import { useSenderDisplayName } from '@/lib/hooks/use-display-names'
import { EmojiStickerPicker } from '@/components/chat/EmojiStickerPicker'
import { MediaPreviewStrip } from '@/components/chat/MediaPreviewStrip'
import {
  ReplyBanner,
  EditBanner,
  RecordingBar,
  AttachMenu,
  SlashSuggestion,
  MentionPopover,
} from '@/components/chat/MessageInputParts'
import type { Message, MessageType, Conversation } from '@/lib/api/types'

interface Props {
  /** Send a NEW message. Rejects (after its own toast) when the send failed. */
  onSend: (content: string, type?: MessageType) => Promise<void>
  /** Submit the edit of `editingMessage` (text only). Rejects on failure. */
  onEditSubmit?: (content: string) => Promise<void>
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
  onEditSubmit,
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
  const replyIsOwn = !!replyingTo && replyingTo.senderId === currentUserId
  const replySenderName = useSenderDisplayName(
    replyingTo?.senderId,
    conversation?.id,
    !!replyingTo && !replyIsOwn,
  )

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
    stageFiles,
    stageFile,
    removeAttachment,
    toggleAllHD,
    flushAttachments,
  } = useStagedAttachments()

  const mention = useMentionAutocomplete({ conversation, value, setValue, textareaRef })

  // Grow the textarea to fit content, capped at max-h-32 (128px).
  const resizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

  // Populate textarea when entering edit mode.
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

  // Focus when starting a reply.
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus()
  }, [replyingTo])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setValue(val)
    resizeTextarea()

    mention.updateFromInput(val, e.target.selectionStart)

    if (onTypingChange && !editingMessage) {
      onTypingChange(true)

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      typingTimeoutRef.current = setTimeout(() => onTypingChange(false), 3000)
    }
  }

  // Paste images from the clipboard, such as screenshots copied with Snipping Tool.
  // Normal text pasting continues to work as usual.
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (editingMessage || disabled || sending || uploading) return

    const imageFiles = Array.from(e.clipboardData.items)
      .filter(
        (item) => item.kind === 'file' && item.type.startsWith('image/'),
      )
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)

    // If the clipboard doesn't contain an image, let the browser paste normally.
    if (imageFiles.length === 0) return

    e.preventDefault()

    const result = stageFiles(imageFiles)

    if (result.tooLarge) {
      toast.error(t('uploadTooLarge'))
    }
  }

  // Send (or submit the edit of) a text message.
  // The box is cleared ONLY on success.
  const sendText = async (content: string) => {
    if (sending) return

    setSending(true)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    onTypingChange?.(false)

    try {
      if (editingMessage && onEditSubmit) {
        await onEditSubmit(content)
      } else {
        await onSend(content, 'text')
      }

      setValue('')

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (err) {
      if (!isReportedSendError(err)) {
        toast.error(t('sendMessageError'))
      }
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  // Stickers / quick reaction.
  const sendQuick = (content: string, type: MessageType) => {
    onSend(content, type).catch((err) => {
      if (!isReportedSendError(err)) {
        toast.error(t('sendMessageError'))
      }
    })
  }

  const handleSend = async () => {
    // Staged attachments take priority over text.
    if (pendingAttachments.length > 0 && !editingMessage) {
      if (sending) return

      setSending(true)

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      onTypingChange?.(false)

      try {
        await flushAttachments(onSend)
      } catch (err) {
        if (!isReportedSendError(err)) {
          const tooLarge =
            err instanceof Error && err.message === FILE_TOO_LARGE

          toast.error(tooLarge ? t('uploadTooLarge') : t('uploadError'))
        }
      } finally {
        setSending(false)
      }

      return
    }

    const content = value.trim()
    if (!content) return

    await sendText(content)
  }

  // `/new` slash command.
  const sendSlashNew = () => sendText('/new')

  const isDirectAiConversation =
    conversation?.type !== 'group' &&
    (conversation?.participants?.includes(AI_BOT_ID) ?? false)

  const showSlashSuggestion =
    isDirectAiConversation &&
    value === '/' &&
    !editingMessage &&
    !mention.hasQuery

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention.handleKey(e)) return

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

  const busy = disabled || sending || uploading

  return (
    <div className="flex flex-col border-t bg-background pb-safe">
      {/* Reply banner */}
      {replyingTo && !editingMessage && (
        <ReplyBanner
          replyingTo={replyingTo}
          senderName={replyIsOwn ? t('you') : replySenderName}
          onCancelReply={onCancelReply}
        />
      )}

      {/* Edit mode banner */}
      {editingMessage && (
        <EditBanner
          editingMessage={editingMessage}
          onCancelEdit={onCancelEdit}
        />
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

      {/* Staged attachments preview */}
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
              onPaste={handlePaste}
              placeholder={
                editingMessage
                  ? t('editPlaceholder')
                  : t('inputPlaceholder')
              }
              className="min-h-10 max-h-32 resize-none w-full [field-sizing:fixed]"
              rows={1}
              disabled={disabled || sending}
            />

            {/* `/new` slash suggestion */}
            {showSlashSuggestion && (
              <SlashSuggestion
                disabled={busy}
                onSelect={sendSlashNew}
              />
            )}

            {/* Mention Popover */}
            {mention.isOpen && (
              <MentionPopover
                candidates={mention.candidates}
                activeIndex={mention.activeIndex}
                onSelect={mention.insert}
                onHover={mention.setActiveIndex}
              />
            )}
          </div>

          {/* Emoji */}
          <EmojiStickerPicker
            disabled={busy}
            onInsertEmoji={insertEmoji}
            onSendSticker={(sticker) => sendQuick(sticker, 'sticker')}
          />

          {/* Send OR Mic + quick reaction */}
          {value.trim() || editingMessage || pendingAttachments.length > 0 ? (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={
                (!value.trim() && pendingAttachments.length === 0) || busy
              }
              className="shrink-0 transition-transform duration-[180ms] active:scale-95 tap"
              variant={editingMessage ? 'outline' : 'default'}
            >
              {editingMessage ? (
                <Pencil className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
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
                <Mic className="size-5 text-primary" />
              </Button>

              <button
                onClick={() => sendQuick(quickReaction, 'text')}
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
