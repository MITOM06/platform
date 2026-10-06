'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { chatService } from '@/lib/api/chat'
import { chatErrorMessage } from '@/lib/api/chat-errors'
import { authService } from '@/lib/api/auth'
import { applySharedConversationUpdate } from '@/lib/realtime/conversation-cache'
import { setNickname, nicknameSystemMessage } from '@/lib/nicknames'
import { setQuickReaction, quickReactionSystemMessage } from '@/lib/quick-reaction'
import type { Conversation, UserSearchResult } from '@/lib/api/types'
import { isHumanUserId } from '@/lib/hooks/use-display-names'

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
    } catch (err) {
      toast.error(chatErrorMessage(err, t, 'groupNameError'))
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
        return isHumanUserId(uid) && !conversation.participants.includes(uid)
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
    } catch (err) {
      toast.error(chatErrorMessage(err, t, 'groupAddError'))
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
    } catch (err) {
      toast.error(chatErrorMessage(err, t, 'groupRemoveError'))
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
    } catch (err) {
      toast.error(chatErrorMessage(err, t, 'groupLeaveError'))
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
    } catch (err) {
      toast.error(chatErrorMessage(err, t, 'groupAvatarError'))
    } finally {
      setSaving(false)
    }
  }

  // F4 — promote / demote a group admin. The server answers with the caller's
  // view; the shared CONVERSATION_UPDATED broadcast keeps everyone else in sync.
  const changeAdmin = async (userId: string, promote: boolean) => {
    setSaving(true)
    try {
      const updated = promote
        ? await chatService.promoteAdmin(conversation.id, userId)
        : await chatService.demoteAdmin(conversation.id, userId)
      applySharedConversationUpdate(queryClient, updated, currentUserId)
      toast.success(promote ? t('groupMakeAdminSuccess') : t('groupRemoveAdminSuccess'))
    } catch (err) {
      toast.error(chatErrorMessage(err, t, 'actionError'))
    } finally {
      setSaving(false)
    }
  }
  // F5 — admins list / unlist the group in Explore.
  const handleTogglePublic = async (next: boolean) => {
    setSaving(true)
    try {
      const updated = await chatService.setPublicChannel(conversation.id, next)
      applySharedConversationUpdate(queryClient, updated, currentUserId)
      toast.success(next ? t('groupPublicOnSuccess') : t('groupPublicOffSuccess'))
    } catch (err) {
      toast.error(chatErrorMessage(err, t, 'actionError'))
    } finally {
      setSaving(false)
    }
  }

  const handlePromoteAdmin = (userId: string) => changeAdmin(userId, true)
  const handleDemoteAdmin = (userId: string) => changeAdmin(userId, false)

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
    handlePromoteAdmin,
    handleDemoteAdmin,
    handleTogglePublic,
  }
}
