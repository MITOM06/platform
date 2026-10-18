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
import { FILE_TOO_LARGE, MAX_UPLOAD_BYTES } from '@/lib/api/chat'
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
  onSend: (content: string, type?: MessageType) => Promise<void>
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
    stageFiles,
    stageFile,
    removeAttachment,
    toggleAllHD,
    flushAttachments,
  } = useStagedAttachments()

  const mention = useMentionAutocomplete({
    conversation,
    value,
    setValue,
    textareaRef,
  })

  const resizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return

    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

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

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus()
  }, [replyingTo])

  // Show a larger warning toast without a close button.
  const showUploadTooLargeWarning = () => {
    toast.error(t('uploadTooLarge'), {
      duration: 3000,
      closeButton: false,
      className: 'upload-warning-toast',
    })
  }

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

  // Paste images from clipboard.
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (editingMessage || disabled || sending || uploading) return

    const imageFiles = Array.from(e.clipboardData.items)
      .filter(
        (item) => item.kind === 'file' && item.type.startsWith('image/'),
      )
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)

    if (imageFiles.length === 0) return

    e.preventDefault()

    const result = stageFiles(imageFiles)

    if (result.tooLarge) {
      showUploadTooLargeWarning()
    }
  }

  // Stage images/videos and warn when a selected file is too large.
  const handleStageImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''

    const result = stageFiles(files)

    if (result.tooLarge) {
      showUploadTooLargeWarning()
    }
  }

  // Warn when a document exceeds the upload limit.
  const handleStageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (file && file.size > MAX_UPLOAD_BYTES) {
      e.target.value = ''
      showUploadTooLargeWarning()
      return
    }

    stageFile(e)
  }

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

  const sendQuick = (content: string, type: MessageType) => {
    onSend(content, type).catch((err) => {
      if (!isReportedSendError(err)) {
        toast.error(t('sendMessageError'))
      }
    })
  }

  const handleSend = async () => {
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

          if (tooLarge) {
            showUploadTooLargeWarning()
          } else {
            toast.error(t('uploadError'))
          }
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

  // /new slash command.
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
      {replyingTo && !editingMessage && (
        <ReplyBanner
          replyingTo={replyingTo}
          senderName={replyIsOwn ? t('you') : replySenderName}
          onCancelReply={onCancelReply}
        />
      )}

      {editingMessage && (
        <EditBanner
          editingMessage={editingMessage}
          onCancelEdit={onCancelEdit}
        />
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleStageImages}
      />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleStageFile}
      />

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

            {showSlashSuggestion && (
              <SlashSuggestion
                disabled={busy}
                onSelect={sendSlashNew}
              />
            )}

            {mention.isOpen && (
              <MentionPopover
                candidates={mention.candidates}
                activeIndex={mention.activeIndex}
                onSelect={mention.insert}
                onHover={mention.setActiveIndex}
              />
            )}
          </div>

          <EmojiStickerPicker
            disabled={busy}
            onInsertEmoji={insertEmoji}
            onSendSticker={(sticker) => sendQuick(sticker, 'sticker')}
          />

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