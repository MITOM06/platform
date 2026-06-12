'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  BellOff, Bell, Archive, ArchiveX, Trash2, Eraser, Timer, ImageIcon,
  CheckCheck, BookMarked, User, Users, Phone, Video, ShieldOff, Shield,
} from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { chatService } from '@/lib/api/chat'
import type { Conversation } from '@/lib/api/types'

interface Props {
  conversation: Conversation
  currentUserId: string
  open: boolean
  onClose: () => void
  onOpenProfile?: () => void
  onOpenGroupInfo?: () => void
}

interface RowButtonProps {
  onClick?: () => void
  icon: React.ReactNode
  label: string
  danger?: boolean
  disabled?: boolean
  saving?: boolean
}

function RowButton({ onClick, icon, label, danger = false, disabled = false, saving = false }: RowButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      className={`flex items-center gap-3 text-sm rounded-lg px-2 py-2.5 transition-colors w-full text-left ${
        danger
          ? 'text-destructive hover:bg-destructive/10'
          : disabled
          ? 'text-muted-foreground cursor-not-allowed'
          : 'hover:bg-muted/50'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

const WALLPAPER_PRESETS = [
  { id: 'default', label: 'Default', bg: 'bg-background border border-muted' },
  { id: 'sunset', label: 'Sunset', bg: 'bg-gradient-to-br from-orange-400 to-purple-600' },
  { id: 'midnight', label: 'Midnight', bg: 'bg-gradient-to-br from-indigo-900 to-slate-900' },
  { id: 'sweet_pink', label: 'Sweet Pink', bg: 'bg-gradient-to-br from-pink-300 to-red-400' },
  { id: 'neon_teal', label: 'Neon Teal', bg: 'bg-gradient-to-br from-teal-900 to-cyan-800' },
  { id: 'dark_shadow', label: 'Dark Shadow', bg: 'bg-gradient-to-br from-zinc-800 to-zinc-950' },
]

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

  const otherUserId = isDirect
    ? conversation.participants.find((p) => p !== currentUserId)
    : null

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
      <SheetContent side="right" className="w-80 sm:w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('settingsTitle')}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-1 px-6 pb-6">
          <Separator className="mb-2" />

          {/* Mark read / unread */}
          <RowButton saving={saving}
            onClick={handleMarkRead}
            icon={<CheckCheck className="size-4" />}
            label={t('markRead')}
          />
          <RowButton saving={saving}
            onClick={handleMarkUnread}
            icon={<BookMarked className="size-4" />}
            label={t('markUnread')}
          />

          <Separator className="my-1" />

          {/* Mute / unmute */}
          <RowButton saving={saving}
            onClick={handleMuteToggle}
            icon={isMuted ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            label={isMuted ? t('unmuteNotifications') : t('muteNotifications')}
          />

          {/* View profile / group info */}
          {isDirect && onOpenProfile && (
            <RowButton saving={saving}
              onClick={() => { onOpenProfile(); onClose() }}
              icon={<User className="size-4" />}
              label={t('viewProfile')}
            />
          )}
          {!isDirect && onOpenGroupInfo && (
            <RowButton saving={saving}
              onClick={() => { onOpenGroupInfo(); onClose() }}
              icon={<Users className="size-4" />}
              label={t('groupInfo')}
            />
          )}

          {/* Voice / video call (1:1 only, disabled with coming soon title) */}
          {isDirect && (
            <>
              <span title={t('callComingSoon')}>
                <RowButton saving={saving} icon={<Phone className="size-4" />} label={t('voiceCall')} disabled />
              </span>
              <span title={t('callComingSoon')}>
                <RowButton saving={saving} icon={<Video className="size-4" />} label={t('videoCall')} disabled />
              </span>
            </>
          )}

          {/* Block / Unblock (1:1 only) */}
          {isDirect && (
            <RowButton saving={saving}
              onClick={handleBlockToggle}
              icon={isBlocked ? <Shield className="size-4" /> : <ShieldOff className="size-4" />}
              label={isBlocked ? t('unblockUser') : t('blockUser')}
              danger={!isBlocked}
            />
          )}

          <Separator className="my-1" />

          {/* Archive */}
          <RowButton saving={saving}
            onClick={handleArchiveToggle}
            icon={isArchived ? <ArchiveX className="size-4" /> : <Archive className="size-4" />}
            label={isArchived ? t('unarchive') : t('archive')}
          />

          <Separator className="my-1" />

          {/* Auto-delete timer */}
          <div className="space-y-3 px-2 py-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Timer className="size-4" />
              {t('autoDelete')}
            </div>
            <Slider
              min={0}
              max={autoDeleteOptions.length - 1}
              step={1}
              value={[sliderValue]}
              onValueChange={([v]) => handleAutoDelete(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              {autoDeleteOptions.map((o, i) => (
                <span key={i} className={i === sliderValue ? 'text-primary font-medium' : ''}>
                  {o.label}
                </span>
              ))}
            </div>
          </div>

          <Separator className="my-1" />

          {/* Wallpaper Selection */}
          <div className="space-y-3 px-2 py-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="size-4" />
              {t('wallpaper')}
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
                  <span className="truncate max-w-full text-foreground/80">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator className="my-1" />

          {/* Clear history */}
          <RowButton saving={saving}
            onClick={() => setConfirmClearOpen(true)}
            icon={<Eraser className="size-4" />}
            label={t('clearHistory')}
          />

          <Separator className="my-1 border-border/60 border-[2px]" />

          {/* Delete conversation */}
          <RowButton saving={saving}
            onClick={handleDelete}
            icon={<Trash2 className="size-4" />}
            label={t('deleteConversation')}
            danger
          />
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
