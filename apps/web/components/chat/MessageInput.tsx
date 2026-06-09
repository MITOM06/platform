'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Message } from '@/lib/api/types'

interface Props {
  onSend: (content: string) => Promise<void>
  onTypingChange?: (isTyping: boolean) => void
  disabled?: boolean
  editingMessage?: Message | null
  onCancelEdit?: () => void
}

export function MessageInput({ onSend, onTypingChange, disabled, editingMessage, onCancelEdit }: Props) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      await onSend(content)
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
    if (e.key === 'Escape' && editingMessage) {
      onCancelEdit?.()
    }
  }

  return (
    <div className="border-t bg-background">
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

      <div className="flex items-end gap-2 p-3">
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
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!value.trim() || disabled || sending}
          className="shrink-0"
          variant={editingMessage ? 'outline' : 'default'}
        >
          {editingMessage ? <Pencil className="size-4" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
