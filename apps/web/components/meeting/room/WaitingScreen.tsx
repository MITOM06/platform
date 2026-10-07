'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Meeting } from '@/lib/api/meeting-types'
import type { MeetingRoomController } from '@/lib/meetings/meeting-room-controller'
import { BigAvatar } from './BigAvatar'

interface Props {
  meeting: Meeting
  controller: MeetingRoomController
  /** Already humanized. */
  myName: string
  myAvatarUrl?: string
}

/** "Asking to join…" — the guest waits for a host; admission re-joins on its own. */
export function WaitingScreen({ meeting, controller, myName, myAvatarUrl }: Props) {
  const t = useTranslations('meeting')
  const [cancelling, setCancelling] = useState(false)

  const cancel = async () => {
    setCancelling(true)
    try {
      await controller.cancelWaiting()
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="relative">
          <BigAvatar name={myName} avatarUrl={myAvatarUrl} />
          <span className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border border-border/60 bg-card">
            <Loader2 className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
          </span>
        </div>
        <div className="space-y-1.5" aria-live="polite">
          <h1 className="text-xl font-semibold">{t('waitingTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('waitingDesc')}</p>
        </div>
        <p className="max-w-full truncate text-sm font-medium">{meeting.title?.trim() || t('untitled')}</p>
        <Button variant="outline" className="w-full" disabled={cancelling} onClick={() => void cancel()}>
          {t('waitingCancel')}
        </Button>
      </div>
    </div>
  )
}
