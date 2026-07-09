'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { chatService } from '@/lib/api/chat'
import type { Message, MessageType } from '@/lib/api/types'

type SelectionGroup = 'text' | 'image' | 'file'

const TYPE_LABEL_KEY: Record<SelectionGroup, string> = {
  text: 'msgTypeText',
  image: 'msgTypeImage',
  file: 'msgTypeFile',
}

/**
 * Collapse the full message-type space into the three groups that can be
 * multi-selected together. image/video → image; file → file; everything else
 * (text, ai, sticker, call_log, system) → text.
 */
export function classifyType(msgType: MessageType): SelectionGroup {
  if (msgType === 'image' || msgType === 'video') return 'image'
  if (msgType === 'file') return 'file'
  return 'text'
}

interface OptimisticUpdate {
  (updated: Partial<Message> & { id: string }): void
}

/**
 * Multi-select state + bulk actions (delete-for-me, recall, forward) for the
 * conversation thread. Enforces a single selection type: once the first message
 * is picked, mismatched types are rejected with a localized toast.
 */
export function useMultiSelect(
  messages: Message[],
  currentUserId: string | undefined,
  onForwardSingle: (message: Message) => void,
  onOptimisticUpdate: OptimisticUpdate,
) {
  const t = useTranslations('chat')
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedBaseType, setSelectedBaseType] = useState<SelectionGroup | null>(null)

  const enterMultiSelect = useCallback(() => setMultiSelectMode(true), [])

  const exitMultiSelect = useCallback(() => {
    setMultiSelectMode(false)
    setSelectedIds(new Set())
    setSelectedBaseType(null)
  }, [])

  const toggleSelect = useCallback(
    (message: Message) => {
      const mType = classifyType(message.type)

      if (selectedIds.has(message.id)) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(message.id)
          if (next.size === 0) setSelectedBaseType(null)
          return next
        })
        return
      }

      if (selectedBaseType !== null && mType !== selectedBaseType) {
        toast.warning(
          t('multiSelectTypeWarning', { type: t(TYPE_LABEL_KEY[selectedBaseType]) }),
          { duration: 2500 },
        )
        return
      }

      setSelectedIds((prev) => new Set(prev).add(message.id))
      if (selectedBaseType === null) setSelectedBaseType(mType)
    },
    [selectedIds, selectedBaseType, t],
  )

  // All selected messages are the current user's own and still recallable.
  const canRecall =
    selectedIds.size > 0 &&
    [...selectedIds].every((id) => {
      const m = messages.find((msg) => msg.id === id)
      return !!m && m.senderId === currentUserId && !m.recalled
    })

  const handleMultiDelete = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    try {
      await Promise.all(ids.map((id) => chatService.deleteForMe(id)))
      ids.forEach((id) => onOptimisticUpdate({ id, deletedFor: ['__me__'] }))
      exitMultiSelect()
      toast.success(t('multiDeleted', { count: ids.length }))
    } catch {
      toast.error(t('deleteError'))
    }
  }, [selectedIds, onOptimisticUpdate, exitMultiSelect, t])

  const handleMultiRecall = useCallback(async () => {
    const own = messages.filter(
      (m) => selectedIds.has(m.id) && m.senderId === currentUserId && !m.recalled,
    )
    if (own.length === 0) return
    try {
      await Promise.all(own.map((m) => chatService.recallMessage(m.id)))
      exitMultiSelect()
      toast.success(t('multiRecalled', { count: own.length }))
    } catch {
      toast.error(t('recallError'))
    }
  }, [selectedIds, messages, currentUserId, exitMultiSelect, t])

  const handleMultiForward = useCallback(() => {
    const selected = messages.filter((m) => selectedIds.has(m.id))
    if (selected.length === 1) {
      onForwardSingle(selected[0])
      exitMultiSelect()
    } else {
      toast.info(t('multiForwardHint'))
    }
  }, [selectedIds, messages, onForwardSingle, exitMultiSelect, t])

  return {
    multiSelectMode,
    selectedIds,
    canRecall,
    enterMultiSelect,
    exitMultiSelect,
    toggleSelect,
    handleMultiDelete,
    handleMultiRecall,
    handleMultiForward,
  }
}
