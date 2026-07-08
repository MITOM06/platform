'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { chatService } from '@/lib/api/chat'
import { authService } from '@/lib/api/auth'
import { useRelationship } from '@/lib/hooks/use-relationship'
import {
  setNickname, nicknameSystemMessage,
} from '@/lib/nicknames'
import {
  setQuickReaction, quickReactionSystemMessage,
} from '@/lib/quick-reaction'
import type { Conversation } from '@/lib/api/types'

const AI_BOT_ID = 'ai-bot-000000000000000000000001'

interface Args {
  conversation: Conversation
  currentUserId: string
  onClose: () => void
}

// Owns the action-side state + handlers of ConversationSettingsDrawer (mutations,
// confirm dialogs, block override, mute duration). Extracted to keep the drawer
// component under the 400-line limit; behaviour is identical to the inline version.
export function useConversationSettings({ conversation, currentUserId, onClose }: Args) {
  const t = useTranslations('chat')
  const router = useRouter()
  const queryClient = useQueryClient()

  const [saving, setSaving] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false)
  const [wallpaperOpen, setWallpaperOpen] = useState(false)
  // Track which conversation id the local block override belongs to so the
  // derived value automatically resets when the active conversation switches.
  const [localBlockedConvId, setLocalBlockedConvId] = useState<string | null>(null)
  const [localBlockedValue, setLocalBlockedValue] = useState(false)
  const [muteDurationOpen, setMuteDurationOpen] = useState(false)

  const isMuted = conversation.isMuted
  const isArchived = conversation.isArchived
  const isDirect = conversation.type === 'direct'
  const isGroup = conversation.type === 'group'
  const isAI = conversation.participants.includes(AI_BOT_ID)

  const otherUserId = isDirect && !isAI
    ? conversation.participants.find((p) => p !== currentUserId)
    : null

  // Relationship granular — phân biệt "B chặn A" (iBlocked) vs "A chặn B" (blockedMe).
  // conversation.isBlocked là combined boolean nên không đủ để quyết định
  // hiển thị nút Block/Unblock hay chặn block ngược.
  const { relationship } = useRelationship(otherUserId ?? undefined)
  // Derived: use the local override only while we are still on the same
  // conversation; once the conversation prop switches, fall back to relationship.
  // Local override tracks B's own block/unblock action, i.e. iBlocked.
  const iBlocked =
    localBlockedConvId === conversation.id
      ? localBlockedValue
      : (relationship?.iBlocked ?? (conversation.isBlocked ?? false))
  const blockedMe = relationship?.blockedMe ?? false
  const isBlocked = iBlocked || blockedMe

  // Nickname editing covers every human participant (self + others), AI bot excluded.
  const nicknameParticipantIds = conversation.participants.filter((p) => p !== AI_BOT_ID)

  const autoDeleteOptions = [
    { label: t('autoDeleteOff'), value: 0 },
    { label: t('autoDelete1h'), value: 3600 },
    { label: t('autoDelete1d'), value: 86400 },
    { label: t('autoDelete1w'), value: 604800 },
    { label: t('autoDelete1m'), value: 2592000 },
  ]

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] })
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    queryClient.invalidateQueries({ queryKey: ['blocked-conversations'] })
    queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] })
  }

  const run = async (action: () => Promise<unknown>, success: string) => {
    setSaving(true)
    try {
      await action()
      toast.success(success)
      invalidate()
    } catch {
      toast.error(t('actionError'))
    } finally {
      setSaving(false)
    }
  }

  const saveNickname = async (targetId: string, value: string) => {
    setNickname(conversation.id, targetId, value)
    try {
      await chatService.sendMessage(
        conversation.id,
        nicknameSystemMessage(targetId, value.trim()),
        'system',
      )
    } catch {
      // local nickname still applied even if broadcast fails
    }
    toast.success(t('nicknameSuccess'))
  }

  const handlePickQuickReaction = async (emoji: string) => {
    setQuickReaction(conversation.id, emoji)
    try {
      await chatService.sendMessage(
        conversation.id,
        quickReactionSystemMessage(emoji),
        'system',
      )
    } catch {
      // local emoji still applied even if broadcast fails
    }
    toast.success(t('quickReactionSuccess'))
  }

  const handleMuteToggle = () => {
    if (isMuted) {
      run(() => chatService.unmuteConversation(conversation.id), t('unmuteSuccess'))
    } else {
      // Open the duration picker instead of muting forever immediately
      setMuteDurationOpen(true)
    }
  }

  const handleMuteWithDuration = (durationSeconds: number) => {
    setMuteDurationOpen(false)
    run(
      () => chatService.muteConversation(conversation.id, durationSeconds),
      t('muteSuccess'),
    )
  }

  const handleMarkRead = () =>
    run(() => chatService.markConversationRead(conversation.id), t('markReadSuccess'))

  const handleMarkUnread = () =>
    run(() => chatService.markConversationUnread(conversation.id), t('markUnreadSuccess'))

  const handleArchiveToggle = () =>
    run(
      () => isArchived
        ? chatService.unarchiveConversation(conversation.id)
        : chatService.archiveConversation(conversation.id),
      isArchived ? t('unarchiveSuccess') : t('archiveSuccess'),
    )

  // Blocking is destructive → confirm first. Unblocking runs directly.
  // Nếu A đã chặn B (blockedMe) → không cho B chặn ngược.
  const handleBlockButtonClick = () => {
    if (iBlocked) {
      handleBlockToggle()
    } else if (!blockedMe) {
      setBlockConfirmOpen(true)
    }
  }

  const handleBlockToggle = async () => {
    if (!otherUserId) return
    setSaving(true)
    try {
      if (iBlocked) {
        await authService.unblockUser(otherUserId)
        await chatService.blockRestoreConversation(conversation.id)
        setLocalBlockedConvId(conversation.id)
        setLocalBlockedValue(false)
        invalidateAll()
        toast.success(t('unblockSuccess'))
      } else if (!blockedMe) {
        await authService.blockUser(otherUserId)
        await chatService.blockArchiveConversation(conversation.id)
        setLocalBlockedConvId(conversation.id)
        setLocalBlockedValue(true)
        invalidateAll()
        toast.success(t('blockSuccess'))
      }
    } catch {
      toast.error(t('actionError'))
    } finally {
      setSaving(false)
    }
  }

  const handleClearHistory = async () => {
    await run(() => chatService.clearHistory(conversation.id), t('clearHistorySuccess'))
    // removeQueries drops the cached pages so the thread refetches fresh on next
    // mount — a following invalidate would be redundant.
    queryClient.removeQueries({ queryKey: ['messages', conversation.id], exact: true })
    setConfirmClearOpen(false)
  }

  const handleDelete = async () => {
    if (!confirm(t('deleteConversationConfirm'))) return
    await run(async () => {
      await chatService.deleteConversation(conversation.id)
      invalidate()
      onClose()
      router.push('/conversations')
    }, t('deleteSuccess'))
  }

  const handleLeaveGroup = async () => {
    if (!confirm(t('leaveGroupConfirm'))) return
    await run(async () => {
      await chatService.removeMember(conversation.id, currentUserId)
      invalidate()
      onClose()
      router.push('/conversations')
    }, t('leaveSuccess'))
  }

  const handleAutoDelete = async (idx: number) => {
    const seconds = autoDeleteOptions[idx]?.value ?? 0
    await run(
      () => chatService.updateSettings(conversation.id, seconds > 0 ? seconds : null),
      t('autoDeleteSuccess'),
    )
  }

  const currentAutoDeleteIdx = autoDeleteOptions.findIndex(
    (o) => o.value === (conversation.autoDeleteSeconds ?? 0),
  )
  const sliderValue = currentAutoDeleteIdx >= 0 ? currentAutoDeleteIdx : 0

  return {
    // derived flags
    iBlocked, blockedMe, isBlocked, isMuted, isArchived, isDirect, isGroup, isAI,
    otherUserId, nicknameParticipantIds, autoDeleteOptions, sliderValue,
    // ui state
    saving,
    confirmClearOpen, setConfirmClearOpen,
    blockConfirmOpen, setBlockConfirmOpen,
    wallpaperOpen, setWallpaperOpen,
    muteDurationOpen, setMuteDurationOpen,
    // handlers
    saveNickname, handlePickQuickReaction,
    handleMuteToggle, handleMuteWithDuration,
    handleMarkRead, handleMarkUnread, handleArchiveToggle,
    handleBlockButtonClick, handleBlockToggle,
    handleClearHistory, handleDelete, handleLeaveGroup, handleAutoDelete,
  }
}
