'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  BellOff, Bell, Archive, ArchiveX, Trash2, Eraser, Timer,
  CheckCheck, BookMarked, User, Users, ShieldOff, Shield,
  Search, Lock, Info, Palette, SmilePlus, Image as ImageIcon2, FileText, Link as LinkIcon, LogOut,
  Cake, PenLine
} from 'lucide-react'
import {
  Sheet, SheetContent,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { chatService } from '@/lib/api/chat'
import { authService } from '@/lib/api/auth'
import type { Conversation } from '@/lib/api/types'

interface Props {
  conversation: Conversation
  currentUserId: string
  open: boolean
  onClose: () => void
  onOpenProfile?: () => void
  onOpenGroupInfo?: () => void
}

const WALLPAPER_PRESETS = [
  { id: 'default', label: 'Default', bg: 'bg-background border border-muted' },
  { id: 'sunset', label: 'Sunset', bg: 'bg-gradient-to-br from-orange-400 to-purple-600' },
  { id: 'midnight', label: 'Midnight', bg: 'bg-gradient-to-br from-indigo-900 to-slate-900' },
  { id: 'sweet_pink', label: 'Sweet Pink', bg: 'bg-gradient-to-br from-pink-300 to-red-400' },
  { id: 'neon_teal', label: 'Neon Teal', bg: 'bg-gradient-to-br from-teal-900 to-cyan-800' },
  { id: 'dark_shadow', label: 'Dark Shadow', bg: 'bg-gradient-to-br from-zinc-800 to-zinc-950' },
]

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
}: Props) {
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)

  const isMuted = conversation.isMuted
  const isArchived = conversation.isArchived
  const isDirect = conversation.type === 'direct'
  const isGroup = conversation.type === 'group'

  const otherUserId = isDirect
    ? conversation.participants.find((p) => p !== currentUserId)
    : null

  const { data: otherUser } = useQuery({
    queryKey: ['user', otherUserId],
    queryFn: () => otherUserId ? authService.getUser(otherUserId) : null,
    enabled: !!otherUserId,
  })

  const displayName = isGroup
    ? (conversation.name || t('conversationDefault'))
    : (otherUser?.displayName || t('chatDefaultTitle'))
  const avatarUrl = isGroup ? conversation.avatarUrl : otherUser?.avatarUrl
  const avatarLetter = getInitial(displayName)

  const autoDeleteOptions = [
    { label: t('autoDeleteOff'), value: 0 },
    { label: t('autoDelete1h'), value: 3600 },
    { label: t('autoDelete1d'), value: 86400 },
    { label: t('autoDelete1w'), value: 604800 },
    { label: t('autoDelete1m'), value: 2592000 },
  ]

  const wallpaperPresets = WALLPAPER_PRESETS.map((p) => ({
    ...p,
    label: p.id === 'default' ? t('wallpaperDefault') : p.label,
  }))

  const [selectedWallpaper, setSelectedWallpaper] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`wallpaper-${conversation.id}`) || 'default'
    }
    return 'default'
  })

  const handleSelectWallpaper = (presetId: string) => {
    setSelectedWallpaper(presetId)
    localStorage.setItem(`wallpaper-${conversation.id}`, presetId)
    window.dispatchEvent(new Event('wallpaper-changed'))
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
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

  const handleMuteToggle = () =>
    run(
      () => isMuted
        ? chatService.unmuteConversation(conversation.id)
        : chatService.muteConversation(conversation.id),
      isMuted ? t('unmuteSuccess') : t('muteSuccess'),
    )

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
        setIsBlocked(false)
        toast.success(t('unblockSuccess'))
      } else {
        await chatService.blockUser(otherUserId)
        setIsBlocked(true)
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
    queryClient.removeQueries({ queryKey: ['messages', conversation.id], exact: true })
    queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] })
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
      <SheetContent side="right" className="w-80 sm:w-[360px] overflow-y-auto p-0">
        <div className="flex flex-col h-full bg-background">
          {/* Header */}
          <div className="h-14 px-4 flex items-center border-b shrink-0">
            <span className="font-bold text-base">{t('settingsTitle')}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pt-6 space-y-6">
            {/* Avatar & Name */}
            <div className="flex flex-col items-center gap-3">
              <Avatar className="size-24 border-2 border-border/50">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="text-3xl font-medium bg-gradient-to-br from-pon-cyan/80 to-pon-peach/80 text-white">
                  {avatarLetter}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h2 className="text-xl font-bold line-clamp-2 px-4">{displayName}</h2>
                <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <Lock className="size-3" />
                  <span>{t('endToEndEncrypted')}</span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex justify-evenly px-2">
              {isDirect && onOpenProfile && (
                <button
                  onClick={() => { onOpenProfile(); onClose() }}
                  className="flex flex-col items-center gap-1.5 w-16"
                >
                  <div className="size-10 rounded-full bg-pon-cyan/10 text-pon-cyan flex items-center justify-center">
                    <User className="size-5" />
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate w-full text-center">{t('viewProfile')}</span>
                </button>
              )}
              <button
                onClick={handleMuteToggle}
                disabled={saving}
                className="flex flex-col items-center gap-1.5 w-16"
              >
                <div className="size-10 rounded-full bg-pon-cyan/10 text-pon-cyan flex items-center justify-center">
                  {isMuted ? <BellOff className="size-5" /> : <Bell className="size-5" />}
                </div>
                <span className="text-[11px] text-muted-foreground truncate w-full text-center">
                  {isMuted ? t('unmuteNotifications') : t('muteNotifications')}
                </span>
              </button>
              <button
                className="flex flex-col items-center gap-1.5 w-16"
                onClick={() => {
                  toast.success(t('searchMessages')) // TODO: Implement search
                  onClose()
                }}
              >
                <div className="size-10 rounded-full bg-pon-cyan/10 text-pon-cyan flex items-center justify-center">
                  <Search className="size-5" />
                </div>
                <span className="text-[11px] text-muted-foreground truncate w-full text-center">{t('searchMessages')}</span>
              </button>
            </div>

            <hr className="border-border/60" />

            {/* Accordions */}
            <Accordion type="multiple" className="w-full px-1 space-y-2">
              
              {/* Chat Info */}
              <AccordionItem value="info" className="border-none">
                <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-pon-cyan">
                  <span className="font-semibold text-sm">{t('chatInfoCategory')}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-1 space-y-1">
                  {isGroup ? (
                    <div className="flex items-center gap-3 text-sm px-2 py-2">
                      <Users className="size-4 text-muted-foreground" />
                      <span>{t('membersCount', { count: conversation.participants.length })}</span>
                    </div>
                  ) : otherUser ? (
                    <>
                      {otherUser.bio && (
                        <div className="flex gap-3 text-sm px-2 py-2">
                          <Info className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{t('bio')}</span>
                            <span className="text-muted-foreground">{otherUser.bio}</span>
                          </div>
                        </div>
                      )}
                      {otherUser.dateOfBirth && (
                        <div className="flex gap-3 text-sm px-2 py-2">
                          <Cake className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{t('dateOfBirth')}</span>
                            <span className="text-muted-foreground">
                              {new Date(otherUser.dateOfBirth).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}
                </AccordionContent>
              </AccordionItem>

              {/* Action Options (React-specific: Mark read, Archive, Auto-Delete) */}
              <AccordionItem value="options" className="border-none">
                <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-pon-cyan">
                  <span className="font-semibold text-sm">{t('actionOptions')}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-1 space-y-1">
                  <button onClick={handleMarkRead} disabled={saving} className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors">
                    <CheckCheck className="size-4 text-muted-foreground" />
                    <span>{t('markRead')}</span>
                  </button>
                  <button onClick={handleMarkUnread} disabled={saving} className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors">
                    <BookMarked className="size-4 text-muted-foreground" />
                    <span>{t('markUnread')}</span>
                  </button>
                  <button onClick={handleArchiveToggle} disabled={saving} className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors">
                    {isArchived ? <ArchiveX className="size-4 text-muted-foreground" /> : <Archive className="size-4 text-muted-foreground" />}
                    <span>{isArchived ? t('unarchive') : t('archive')}</span>
                  </button>

                  {/* Auto-delete timer */}
                  <div className="px-2 py-3 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="size-4 text-muted-foreground" />
                      <span>{t('autoDelete')}</span>
                    </div>
                    <Slider
                      min={0}
                      max={autoDeleteOptions.length - 1}
                      step={1}
                      value={[sliderValue]}
                      onValueChange={([v]) => handleAutoDelete(v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                      {autoDeleteOptions.map((o, i) => (
                        <span key={i} className={i === sliderValue ? 'text-primary' : ''}>
                          {o.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Customize Chat */}
              <AccordionItem value="customize" className="border-none">
                <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-pon-cyan">
                  <span className="font-semibold text-sm">{t('customizeChatCategory')}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-1 space-y-1">
                  <div className="px-2 py-2 space-y-3">
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <Palette className="size-4 text-muted-foreground" />
                      <span>{t('wallpaper')}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {wallpaperPresets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handleSelectWallpaper(preset.id)}
                          className={`flex flex-col items-center gap-1.5 p-1.5 rounded-lg border-2 hover:opacity-95 transition-all text-[10px] font-medium ${
                            selectedWallpaper === preset.id
                              ? 'border-primary shadow-sm bg-primary/5'
                              : 'border-transparent hover:border-muted-foreground/30'
                          }`}
                        >
                          <div className={`w-full aspect-square rounded-md ${preset.bg}`} />
                          <span className="truncate w-full text-center text-foreground/80">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors" onClick={() => toast('Coming soon')}>
                    <SmilePlus className="size-4 text-muted-foreground" />
                    <span>{t('quickReaction')}</span>
                  </button>
                  <button className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors" onClick={() => toast('Coming soon')}>
                    <PenLine className="size-4 text-muted-foreground" />
                    <span>{t('nicknames')}</span>
                  </button>
                  {isGroup && onOpenGroupInfo && (
                    <>
                      <button onClick={() => { onOpenGroupInfo(); onClose() }} className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors">
                        <PenLine className="size-4 text-muted-foreground" />
                        <span>{t('renameGroup')}</span>
                      </button>
                      <button onClick={() => { onOpenGroupInfo(); onClose() }} className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors">
                        <ImageIcon2 className="size-4 text-muted-foreground" />
                        <span>{t('changeAvatar')}</span>
                      </button>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Files & Media */}
              <AccordionItem value="media" className="border-none">
                <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-pon-cyan">
                  <span className="font-semibold text-sm">{t('filesAndMediaCategory')}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-1 space-y-1">
                  <button className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors" onClick={() => toast('Coming soon')}>
                    <ImageIcon2 className="size-4 text-muted-foreground" />
                    <span>{t('tabMedia')}</span>
                  </button>
                  <button className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors" onClick={() => toast('Coming soon')}>
                    <FileText className="size-4 text-muted-foreground" />
                    <span>{t('tabFiles')}</span>
                  </button>
                  <button className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors" onClick={() => toast('Coming soon')}>
                    <LinkIcon className="size-4 text-muted-foreground" />
                    <span>{t('tabLinks')}</span>
                  </button>
                </AccordionContent>
              </AccordionItem>

              {/* Privacy & Support */}
              <AccordionItem value="privacy" className="border-none">
                <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-red-500">
                  <span className="font-semibold text-sm">{t('privacyAndSupportCategory')}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-1 space-y-1">
                  {isDirect && (
                    <button onClick={handleBlockToggle} disabled={saving} className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-destructive/10 text-destructive rounded-lg text-sm transition-colors">
                      {isBlocked ? <Shield className="size-4" /> : <ShieldOff className="size-4" />}
                      <span>{isBlocked ? t('unblockUser') : t('blockUser')}</span>
                    </button>
                  )}
                  {isGroup && (
                    <button onClick={() => toast('Coming soon')} disabled={saving} className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-destructive/10 text-destructive rounded-lg text-sm transition-colors">
                      <LogOut className="size-4" />
                      <span>{t('leaveGroup')}</span>
                    </button>
                  )}
                  <button onClick={() => setConfirmClearOpen(true)} disabled={saving} className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-destructive/10 text-destructive rounded-lg text-sm transition-colors">
                    <Eraser className="size-4" />
                    <span>{t('clearHistory')}</span>
                  </button>
                  <button onClick={handleDelete} disabled={saving} className="flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-destructive/10 text-destructive rounded-lg text-sm transition-colors">
                    <Trash2 className="size-4" />
                    <span>{t('deleteConversation')}</span>
                  </button>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </div>
        </div>
      </SheetContent>
    </Sheet>

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
