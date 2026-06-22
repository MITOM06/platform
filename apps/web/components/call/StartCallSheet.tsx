'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Phone, Video, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { CallMedia } from '@/lib/api/types'
import { useAuthStore } from '@/lib/store/auth.store'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  conversationId: string
  onClose: () => void
}

/**
 * Start-call dialog for group conversations (Track A §3). Lets the starter
 * choose audio/video and toggle the AI notetaker, then publishes `call.start`
 * via the group manager. Only the starter sees the notetaker toggle.
 */
export function StartCallSheet({ open, conversationId, onClose }: Props) {
  const t = useTranslations('call')
  const currentUser = useAuthStore((s) => s.user)
  const [media, setMedia] = useState<CallMedia>('video')
  const [aiNotetaker, setAiNotetaker] = useState(false)

  const start = () => {
    const userId = currentUser?.id
    if (!userId) return
    void import('@/lib/webrtc/group-call-manager').then((m) =>
      m.groupCallManager.startCall(conversationId, userId, media, aiNotetaker),
    )
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('startGroupCall')}</DialogTitle>
          <DialogDescription>{t('startGroupCallDesc')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <MediaChoice
            active={media === 'audio'}
            label={t('audioCall')}
            icon={<Phone className="size-6" />}
            onClick={() => setMedia('audio')}
          />
          <MediaChoice
            active={media === 'video'}
            label={t('videoCall')}
            icon={<Video className="size-6" />}
            onClick={() => setMedia('video')}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
          <Label htmlFor="ai-notetaker" className="flex items-center gap-2 cursor-pointer">
            <Sparkles className="size-4 text-pon-cyan" />
            <span className="flex flex-col">
              <span className="text-sm font-medium">{t('aiNotetaker')}</span>
              <span className="text-xs text-muted-foreground">{t('aiNotetakerDesc')}</span>
            </span>
          </Label>
          <Switch id="ai-notetaker" checked={aiNotetaker} onCheckedChange={setAiNotetaker} />
        </div>

        <Button onClick={start} className="mt-2 w-full gap-2">
          {media === 'video' ? <Video className="size-4" /> : <Phone className="size-4" />}
          {t('startCall')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function MediaChoice({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors',
        active ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
