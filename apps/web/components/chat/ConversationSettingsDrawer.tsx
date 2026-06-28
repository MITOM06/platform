'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Sheet, SheetContent,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { chatService } from '@/lib/api/chat'
import { authService } from '@/lib/api/auth'
import { WallpaperPickerModal } from './WallpaperPickerModal'
import { SettingsHeader } from './group/SettingsHeader'
import { AiAssistantSection } from './group/AiAssistantSection'
import { ActionOptionsSection } from './group/ActionOptionsSection'
import { CustomizeChatSection } from './group/CustomizeChatSection'
import { FilesMediaSection } from './group/FilesMediaSection'
import { PrivacySupportSection } from './group/PrivacySupportSection'
import { PinnedMessagesSection } from './PinnedMessagesSection'
import { MuteDurationPicker } from './MuteDurationPicker'
import { setNickname, nicknameSystemMessage, useNicknames } from '@/lib/nicknames'
import {
  useQuickReaction, setQuickReaction, quickReactionSystemMessage,
} from '@/lib/quick-reaction'
import type { Conversation } from '@/lib/api/types'

interface Props {
  conversation: Conversation
  currentUserId: string
  open: boolean
  onClose: () => void
  onOpenProfile?: () => void
  onOpenGroupInfo?: () => void
  onSearch?: () => void
  onOpenSharedMedia?: () => void
}

function getInitial(name?: string): string {
  return name?.[0]?.toUpperCase() ?? '?'
}

export function ConversationSettingsDrawer({
  conversation,
  currentUserId,
  open,
  onClose,
  onOpenProfile,
  onOpenGroupInfo,
  onSearch,
  onOpenSharedMedia,
}: Props) {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [wallpaperOpen, setWallpaperOpen] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [muteDurationOpen, setMuteDurationOpen] = useState(false)

  const isMuted = conversation.isMuted
  const isArchived = conversation.isArchived
  const isDirect = conversation.type === 'direct'
  const isGroup = conversation.type === 'group'
  const isAI = conversation.participants.includes('ai-bot-000000000000000000000001')

  const otherUserId = isDirect && !isAI
    ? conversation.participants.find((p) => p !== currentUserId)
    : null

  // Nickname editing covers every human participant (self + others), AI bot excluded.
  const AI_BOT_ID = 'ai-bot-000000000000000000000001'
  const nicknameParticipantIds = conversation.participants.filter((p) => p !== AI_BOT_ID)
  const nicknameMap = useNicknames(conversation.id)

  const quickReaction = useQuickReaction(conversation.id)

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

  const { data: otherUser } = useQuery({
    queryKey: ['user', otherUserId],
    queryFn: () => otherUserId ? authService.getUser(otherUserId) : null,
    enabled: !!otherUserId,
  })

  const displayName = isGroup
    ? (conversation.name || t('conversationDefault'))
    : isAI
      ? t('aiAssistant')
      : (otherUser?.displayName || t('conversationDefault'))
  const avatarUrl = isGroup ? conversation.avatarUrl : otherUser?.avatarUrl
  const avatarLetter = getInitial(displayName)

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

  const handleBlockToggle = async () => {
    if (!otherUserId) return
    setSaving(true)
    try {
      if (isBlocked) {
        await chatService.unblockUser(otherUserId)
        await chatService.blockRestoreConversation(conversation.id)
        setIsBlocked(false)
        invalidateAll()
        toast.success(t('unblockSuccess'))
      } else {
        await chatService.blockUser(otherUserId)
        await chatService.blockArchiveConversation(conversation.id)
        setIsBlocked(true)
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

  return (
    <>
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[min(90vw,320px)] sm:w-[360px] overflow-y-auto p-0">
        <div className="flex flex-col h-full bg-background">
          {/* Header */}
          <div className="h-14 px-4 flex items-center border-b shrink-0">
            <span className="font-bold text-base">{t('settingsTitle')}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pt-6 space-y-6">
            <SettingsHeader
              displayName={displayName}
              avatarUrl={avatarUrl ?? undefined}
              avatarLetter={avatarLetter}
              isDirect={isDirect}
              isAI={isAI}
              isMuted={isMuted}
              muteExpiresAt={conversation.muteExpiresAt ?? undefined}
              saving={saving}
              onOpenProfile={onOpenProfile ? () => { onOpenProfile(); onClose() } : undefined}
              onMuteToggle={handleMuteToggle}
              onSearch={onSearch ? () => { onSearch(); onClose() } : undefined}
            />

            <hr className="border-border/60" />

            {/* Accordions */}
            <Accordion type="multiple" className="w-full px-1 space-y-2">

              {/* AI Assistant — bot-specific controls (replaces person-only items) */}
              {isAI && (
                <AiAssistantSection conversationId={conversation.id} onClose={onClose} />
              )}

              {/* Pinned Messages */}
              {conversation.pinnedMessages.length > 0 && (
                <AccordionItem value="pinned" className="border-none">
                  <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-pon-cyan">
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

              {/* Action Options (React-specific: Mark read, Archive, Auto-Delete) */}
              <ActionOptionsSection
                saving={saving}
                isArchived={isArchived}
                autoDeleteOptions={autoDeleteOptions}
                sliderValue={sliderValue}
                onMarkRead={handleMarkRead}
                onMarkUnread={handleMarkUnread}
                onArchiveToggle={handleArchiveToggle}
                onAutoDelete={handleAutoDelete}
              />

              {/* Customize Chat */}
              <CustomizeChatSection
                isDirect={isDirect}
                isGroup={isGroup}
                otherUserId={otherUserId}
                currentUserId={currentUserId}
                participantIds={nicknameParticipantIds}
                nicknames={nicknameMap}
                saving={saving}
                quickReaction={quickReaction}
                onOpenWallpaper={() => setWallpaperOpen(true)}
                onPickQuickReaction={handlePickQuickReaction}
                onSaveNickname={saveNickname}
                onOpenGroupInfo={onOpenGroupInfo}
                onCloseDrawer={onClose}
              />

              {/* Files & Media */}
              <FilesMediaSection onOpenSharedMedia={() => { onOpenSharedMedia?.(); onClose() }} />

              {/* Privacy & Support */}
              <PrivacySupportSection
                isDirect={isDirect}
                isGroup={isGroup}
                isAI={isAI}
                isBlocked={isBlocked}
                saving={saving}
                onBlockToggle={handleBlockToggle}
                onLeaveGroup={handleLeaveGroup}
                onClearHistory={() => setConfirmClearOpen(true)}
                onDelete={handleDelete}
              />

            </Accordion>
          </div>
        </div>
      </SheetContent>
    </Sheet>

    {/* Wallpaper picker */}
    <WallpaperPickerModal
      conversationId={conversation.id}
      open={wallpaperOpen}
      onClose={() => setWallpaperOpen(false)}
    />

    {/* Mute duration picker */}
    <MuteDurationPicker
      open={muteDurationOpen}
      onClose={() => setMuteDurationOpen(false)}
      onSelect={handleMuteWithDuration}
    />

    {/* Confirmation dialog for Clear History */}
    <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('clearHistory')}</DialogTitle>
          <DialogDescription>{t('clearHistoryConfirm')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmClearOpen(false)}>
            {tCommon('cancel')}
          </Button>
          <Button variant="destructive" onClick={handleClearHistory} disabled={saving}>
            {tCommon('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
