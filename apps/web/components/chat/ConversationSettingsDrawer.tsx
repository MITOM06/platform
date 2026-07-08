'use client'

import { useQuery } from '@tanstack/react-query'
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
import { authService } from '@/lib/api/auth'
import { WallpaperPickerModal } from './WallpaperPickerModal'
import { SettingsHeader } from './group/SettingsHeader'
import { AiAssistantSection } from './group/AiAssistantSection'
import { AiSessionPanel } from './AiSessionPanel'
import { ActionOptionsSection } from './group/ActionOptionsSection'
import { CustomizeChatSection } from './group/CustomizeChatSection'
import { FilesMediaSection } from './group/FilesMediaSection'
import { PrivacySupportSection } from './group/PrivacySupportSection'
import { PinnedMessagesSection } from './PinnedMessagesSection'
import { MuteDurationPicker } from './MuteDurationPicker'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useNicknames } from '@/lib/nicknames'
import { useQuickReaction } from '@/lib/quick-reaction'
import { useConversationSettings } from './use-conversation-settings'
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

  const s = useConversationSettings({ conversation, currentUserId, onClose })

  const nicknameMap = useNicknames(conversation.id)
  const quickReaction = useQuickReaction(conversation.id)

  const { data: otherUser } = useQuery({
    queryKey: ['user', s.otherUserId],
    queryFn: () => s.otherUserId ? authService.getUser(s.otherUserId) : null,
    enabled: !!s.otherUserId,
  })

  const displayName = s.isGroup
    ? (conversation.name || t('conversationDefault'))
    : s.isAI
      ? t('aiAssistant')
      : (otherUser?.displayName || t('conversationDefault'))
  const avatarUrl = s.isGroup ? conversation.avatarUrl : otherUser?.avatarUrl
  const avatarLetter = getInitial(displayName)

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
              isDirect={s.isDirect}
              isAI={s.isAI}
              isMuted={s.isMuted}
              muteExpiresAt={conversation.muteExpiresAt ?? undefined}
              saving={s.saving}
              onOpenProfile={onOpenProfile ? () => { onOpenProfile(); onClose() } : undefined}
              onMuteToggle={s.handleMuteToggle}
              onSearch={onSearch ? () => { onSearch(); onClose() } : undefined}
            />

            <hr className="border-border/60" />

            {/* Accordions */}
            <Accordion type="multiple" className="w-full px-1 space-y-2">

              {/* AI Assistant — bot-specific controls (replaces person-only items) */}
              {s.isAI && (
                <AiAssistantSection conversationId={conversation.id} onClose={onClose} />
              )}

              {/* AI session history — view / resume / start new session */}
              {s.isAI && (
                <AiSessionPanel conversationId={conversation.id} />
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

              {/* Action Options (Mark read/unread, Archive, Auto-Delete) — hidden
                  for AI conversations, where none of these apply. */}
              {!s.isAI && (
                <ActionOptionsSection
                  saving={s.saving}
                  isArchived={s.isArchived}
                  autoDeleteOptions={s.autoDeleteOptions}
                  sliderValue={s.sliderValue}
                  onMarkRead={s.handleMarkRead}
                  onMarkUnread={s.handleMarkUnread}
                  onArchiveToggle={s.handleArchiveToggle}
                  onAutoDelete={s.handleAutoDelete}
                />
              )}

              {/* Customize Chat */}
              <CustomizeChatSection
                isDirect={s.isDirect}
                isGroup={s.isGroup}
                otherUserId={s.otherUserId}
                currentUserId={currentUserId}
                participantIds={s.nicknameParticipantIds}
                nicknames={nicknameMap}
                saving={s.saving}
                quickReaction={quickReaction}
                onOpenWallpaper={() => s.setWallpaperOpen(true)}
                onPickQuickReaction={s.handlePickQuickReaction}
                onSaveNickname={s.saveNickname}
                onOpenGroupInfo={onOpenGroupInfo}
                onCloseDrawer={onClose}
              />

              {/* Files & Media */}
              <FilesMediaSection onOpenSharedMedia={() => { onOpenSharedMedia?.(); onClose() }} />

              {/* Privacy & Support */}
              <PrivacySupportSection
                isDirect={s.isDirect}
                isGroup={s.isGroup}
                isAI={s.isAI}
                iBlocked={s.iBlocked}
                blockedMe={s.blockedMe}
                saving={s.saving}
                onBlockToggle={s.handleBlockButtonClick}
                onLeaveGroup={s.handleLeaveGroup}
                onClearHistory={() => s.setConfirmClearOpen(true)}
                onDelete={s.handleDelete}
              />

            </Accordion>
          </div>
        </div>
      </SheetContent>
    </Sheet>

    {/* Wallpaper picker */}
    <WallpaperPickerModal
      conversationId={conversation.id}
      open={s.wallpaperOpen}
      onClose={() => s.setWallpaperOpen(false)}
    />

    {/* Mute duration picker */}
    <MuteDurationPicker
      open={s.muteDurationOpen}
      onClose={() => s.setMuteDurationOpen(false)}
      onSelect={s.handleMuteWithDuration}
    />

    {/* Confirmation dialog for Clear History */}
    <Dialog open={s.confirmClearOpen} onOpenChange={s.setConfirmClearOpen}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('clearHistory')}</DialogTitle>
          <DialogDescription>{t('clearHistoryConfirm')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => s.setConfirmClearOpen(false)}>
            {tCommon('cancel')}
          </Button>
          <Button variant="destructive" onClick={s.handleClearHistory} disabled={s.saving}>
            {tCommon('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Confirmation dialog for Block user */}
    <ConfirmDialog
      open={s.blockConfirmOpen}
      onOpenChange={s.setBlockConfirmOpen}
      title={t('blockConfirmTitle', { name: displayName })}
      description={t('blockConfirmDesc', { name: displayName })}
      confirmLabel={t('blockUser')}
      onConfirm={s.handleBlockToggle}
    />
    </>
  )
}
