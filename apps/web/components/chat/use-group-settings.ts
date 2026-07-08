'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { chatService } from '@/lib/api/chat'
import { authService } from '@/lib/api/auth'
import { setNickname, nicknameSystemMessage } from '@/lib/nicknames'
import { setQuickReaction, quickReactionSystemMessage } from '@/lib/quick-reaction'
import type { Conversation, UserSearchResult } from '@/lib/api/types'

interface Args {
  conversation: Conversation
  currentUserId: string
  onClose: () => void
}

// Owns the action-side state + handlers of GroupSettingsDrawer (name/avatar
// edits, member add/remove, leave, nickname + quick-reaction broadcasts, modal
// toggles). Extracted to keep the drawer component under the 400-line limit;
// behaviour is identical to the inline version.
export function useGroupSettings({ conversation, currentUserId, onClose }: Args) {
  const t = useTranslations('chat')
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(conversation.name ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [saving, setSaving] = useState(false)
  const [wallpaperOpen, setWallpaperOpen] = useState(false)
  const [nicknamesOpen, setNicknamesOpen] = useState(false)

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] })
  }

  const handleSaveName = async () => {
    if (!nameValue.trim()) return
    setSaving(true)
    try {
      await chatService.updateGroup(conversation.id, nameValue.trim())
      invalidate()
      setEditingName(false)
      toast.success(t('groupNameSuccess'))
    } catch {
      toast.error(t('groupNameError'))
    } finally {
      setSaving(false)
    }
  }

  const handleSearchUsers = async (q: string) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    try {
      const { results } = await authService.searchUsers(q.trim())
      setSearchResults(results.filter((u) => {
        const uid = u._id ?? u.id ?? ''
        return !conversation.participants.includes(uid)
      }))
    } catch {
      setSearchResults([])
    }
  }

  const handleAddMember = async (user: UserSearchResult) => {
    const uid = user._id ?? user.id ?? ''
    if (!uid) return
    setSaving(true)
    try {
      await chatService.addMembers(conversation.id, [uid])
      invalidate()
      setSearchQuery('')
      setSearchResults([])
      toast.success(t('groupAddSuccess', { name: user.displayName }))
    } catch {
      toast.error(t('groupAddError'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    setSaving(true)
    try {
      await chatService.removeMember(conversation.id, userId)
      invalidate()
      toast.success(t('groupRemoveSuccess'))
    } catch {
      toast.error(t('groupRemoveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleLeaveGroup = async () => {
    if (!confirm(t('groupLeaveConfirm'))) return
    setSaving(true)
    try {
      await chatService.removeMember(conversation.id, currentUserId)
      invalidate()
      onClose()
      router.push('/')
      toast.success(t('groupLeaveSuccess'))
    } catch {
      toast.error(t('groupLeaveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSaving(true)
    try {
      const uploaded = await chatService.uploadFile(file)
      await chatService.updateGroup(conversation.id, undefined, uploaded.url)
      invalidate()
      toast.success(t('groupAvatarSuccess'))
    } catch {
      toast.error(t('groupAvatarError'))
    } finally {
      setSaving(false)
    }
  }

  const handlePickQuickReaction = async (emoji: string) => {
    setQuickReaction(conversation.id, emoji)
    try {
      await chatService.sendMessage(conversation.id, quickReactionSystemMessage(emoji), 'system')
    } catch {
      // local emoji still applied even if broadcast fails
    }
    toast.success(t('quickReactionSuccess'))
  }

  return {
    editingName, setEditingName,
    nameValue, setNameValue,
    searchQuery,
    searchResults,
    saving,
    wallpaperOpen, setWallpaperOpen,
    nicknamesOpen, setNicknamesOpen,
    saveNickname,
    handleSaveName,
    handleSearchUsers,
    handleAddMember,
    handleRemoveMember,
    handleLeaveGroup,
    handleAvatarUpload,
    handlePickQuickReaction,
  }
}
