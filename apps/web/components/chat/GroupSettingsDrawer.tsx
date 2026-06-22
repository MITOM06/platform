'use client'
/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  UserPlus, Pencil, Check, X, LogOut, Camera, FolderOpen, Images, Bot,
  Palette, SmilePlus, Users, PenLine,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { chatService } from '@/lib/api/chat'
import { authService } from '@/lib/api/auth'
import {
  useQuickReaction, setQuickReaction, quickReactionSystemMessage,
} from '@/lib/quick-reaction'
import { absoluteMediaUrl } from '@/lib/media'
import { WallpaperPickerModal } from './WallpaperPickerModal'
import { GroupMemberRow } from './group/GroupMemberRow'
import { NicknamesModal } from './group/NicknamesModal'
import { setNickname, nicknameSystemMessage, useNicknames } from '@/lib/nicknames'
import { PinnedMessagesSection } from './PinnedMessagesSection'
import type { Conversation, UserSearchResult } from '@/lib/api/types'
import { useRouter } from 'next/navigation'

const QUICK_REACTION_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '😍', '👏', '💯', '😎',
]

interface Props {
  conversation: Conversation
  currentUserId: string
  open: boolean
  onClose: () => void
}

export function GroupSettingsDrawer({ conversation, currentUserId, open, onClose }: Props) {
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
  const isAdmin = conversation.admins.includes(currentUserId)
  const quickReaction = useQuickReaction(conversation.id)

  // Nickname editing covers every human group member (AI bot excluded). Stored
  // client-local + broadcast via `system.nickname.changed:` (same as direct chats).
  const AI_BOT_ID = 'ai-bot-000000000000000000000001'
  const nicknameParticipantIds = conversation.participants.filter((p) => p !== AI_BOT_ID)
  const nicknameMap = useNicknames(conversation.id)

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
      const results = await authService.searchUsers(q.trim())
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

  const triggerCls = 'hover:no-underline py-2 data-[state=open]:text-pon-cyan'
  const itemBtnCls = 'flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors'

  return (
    <>
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-80 sm:w-[360px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('groupSettingsTitle')}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col px-5 pb-6">
          {/* Group header & avatar */}
          <div className="flex flex-col items-center py-4 space-y-3">
            <div className="relative group">
              <Avatar className="size-20">
                {conversation.avatarUrl ? (
                  <img src={absoluteMediaUrl(conversation.avatarUrl)} alt={t('groupAvatarAlt')} className="w-full h-full object-cover" />
                ) : (
                  <AvatarFallback className="text-2xl bg-gradient-to-br from-pon-cyan to-pon-peach text-white">
                    {(conversation.name ?? 'Group')[0]?.toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              {isAdmin && (
                <label className="absolute bottom-0 right-0 p-1.5 bg-pon-cyan text-black rounded-full cursor-pointer shadow-sm hover:scale-110 transition-transform">
                  <Camera className="size-3.5" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={saving} />
                </label>
              )}
            </div>
            <span className="font-semibold text-lg">{conversation.name ?? t('groupNoName')}</span>
            <p className="text-xs text-muted-foreground">{t('membersCount', { count: conversation.participants.length })}</p>
          </div>

          <hr className="border-border/60" />

          <Accordion type="multiple" className="w-full px-1 space-y-2 mt-2">
            {/* Chat Info — members + add member */}
            <AccordionItem value="info" className="border-none">
              <AccordionTrigger className={triggerCls}>
                <span className="font-semibold text-sm">{t('chatInfoCategory')}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                  <Users className="size-3.5" />
                  {t('groupMembers', { count: conversation.participants.length })}
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto px-1">
                  {conversation.participants.map((uid) => (
                    <GroupMemberRow
                      key={uid}
                      uid={uid}
                      isMemberAdmin={conversation.admins.includes(uid)}
                      canRemove={isAdmin && uid !== currentUserId}
                      onRemove={() => handleRemoveMember(uid)}
                      saving={saving}
                      adminLabel={t('groupAdmin')}
                    />
                  ))}
                </div>

                {isAdmin && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1 px-1">
                      <UserPlus className="size-3.5" /> {t('groupAddMember')}
                    </p>
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearchUsers(e.target.value)}
                      placeholder={t('groupSearchPlaceholder')}
                      className="h-8 text-sm"
                    />
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {searchResults.map((user) => {
                        const uid = user._id ?? user.id ?? ''
                        return (
                          <button
                            key={uid}
                            onClick={() => handleAddMember(user)}
                            disabled={saving}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-sm text-left"
                          >
                            <Avatar className="size-7 shrink-0">
                              <AvatarFallback className="text-xs">
                                {user.displayName[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{user.displayName}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Pinned Messages */}
            {conversation.pinnedMessages.length > 0 && (
              <AccordionItem value="pinned" className="border-none">
                <AccordionTrigger className={triggerCls}>
                  <span className="font-semibold text-sm">{t('pinnedMessages')}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-1">
                  <PinnedMessagesSection
                    conversationId={conversation.id}
                    pinnedMessages={conversation.pinnedMessages}
                    onJump={onClose}
                  />
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Customize Chat — rename, avatar, wallpaper, quick reaction */}
            <AccordionItem value="customize" className="border-none">
              <AccordionTrigger className={triggerCls}>
                <span className="font-semibold text-sm">{t('customizeChatCategory')}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1 space-y-1">
                {isAdmin && (
                  editingName ? (
                    <div className="flex gap-2 px-2 py-1.5">
                      <Input
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button size="icon-sm" onClick={handleSaveName} disabled={saving}>
                        <Check className="size-4" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => setEditingName(false)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingName(true)} className={itemBtnCls}>
                      <Pencil className="size-4 text-muted-foreground" />
                      <span>{t('renameGroup')}</span>
                    </button>
                  )
                )}
                <button onClick={() => setNicknamesOpen(true)} className={itemBtnCls}>
                  <PenLine className="size-4 text-muted-foreground" />
                  <span>{t('editNicknames')}</span>
                </button>
                <button onClick={() => setWallpaperOpen(true)} className={itemBtnCls}>
                  <Palette className="size-4 text-muted-foreground" />
                  <span>{t('wallpaper')}</span>
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={itemBtnCls}>
                      <SmilePlus className="size-4 text-muted-foreground" />
                      <span className="flex-1">{t('quickReaction')}</span>
                      <span className="text-lg leading-none">{quickReaction}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="end" side="top">
                    <p className="text-xs text-muted-foreground px-1 pb-2">{t('quickReactionPickTitle')}</p>
                    <div className="grid grid-cols-6 gap-1">
                      {QUICK_REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handlePickQuickReaction(emoji)}
                          className={`p-1.5 rounded-lg text-lg flex items-center justify-center transition-colors hover:bg-muted ${
                            quickReaction === emoji ? 'bg-pon-cyan/15 ring-1 ring-pon-cyan' : ''
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </AccordionContent>
            </AccordionItem>

            {/* Files & Media */}
            <AccordionItem value="media" className="border-none">
              <AccordionTrigger className={triggerCls}>
                <span className="font-semibold text-sm">{t('filesAndMediaCategory')}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1 space-y-1">
                <button onClick={() => { onClose(); router.push(`/shared-media/${conversation.id}`) }} className={itemBtnCls}>
                  <Images className="size-4 text-pon-cyan" />
                  <span>{t('groupSharedMedia')}</span>
                </button>
                <button onClick={() => { onClose(); router.push(`/kb/${conversation.id}`) }} className={itemBtnCls}>
                  <FolderOpen className="size-4 text-pon-peach" />
                  <span>{t('groupKnowledgeBase')}</span>
                </button>
              </AccordionContent>
            </AccordionItem>

            {/* Privacy & Support */}
            <AccordionItem value="privacy" className="border-none">
              <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-red-500">
                <span className="font-semibold text-sm">{t('privacyAndSupportCategory')}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1 space-y-1">
                {isAdmin && (
                  <button onClick={() => { onClose(); router.push(`/ai-persona?conversationId=${conversation.id}`) }} className={itemBtnCls}>
                    <Bot className="size-4 text-[#B47FFF]" />
                    <span>{t('groupAiPersona')}</span>
                  </button>
                )}
                <button
                  onClick={handleLeaveGroup}
                  disabled={saving}
                  className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-destructive/10 text-destructive rounded-lg text-sm transition-colors"
                >
                  <LogOut className="size-4" />
                  <span>{t('groupLeave')}</span>
                </button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>

    {/* Wallpaper picker — same upload+preview flow as direct chats (W-15.2) */}
    <WallpaperPickerModal
      conversationId={conversation.id}
      open={wallpaperOpen}
      onClose={() => setWallpaperOpen(false)}
    />

    {/* Nicknames modal — self + all members (same transport as direct chats) */}
    <NicknamesModal
      open={nicknamesOpen}
      onClose={() => setNicknamesOpen(false)}
      participantIds={nicknameParticipantIds}
      currentUserId={currentUserId}
      nicknames={nicknameMap}
      onSave={saveNickname}
      saving={saving}
    />
    </>
  )
}
