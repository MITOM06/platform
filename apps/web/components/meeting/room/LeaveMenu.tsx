'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LogOut, PhoneOff, XCircle } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { isManager } from '@/lib/meetings/permissions'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { useRoom } from './room-context'

const LEAVE_CLASS = 'size-11 rounded-full md:w-auto md:px-4'

/**
 * Attendee: one Leave button. Host / co-host: Leave meeting (the meeting goes on,
 * nothing is ended) or End meeting for all (confirmed).
 */
export function LeaveMenu() {
  const t = useTranslations('meeting')
  const { controller } = useRoom()
  const manager = isManager(useMeetingRoomStore((s) => s.myRole))
  const [confirmEnd, setConfirmEnd] = useState(false)

  if (!manager) {
    return (
      <Button variant="destructive" className={LEAVE_CLASS} aria-label={t('leave')} title={t('leave')} onClick={() => controller.leave()}>
        <PhoneOff className="size-5" aria-hidden />
        <span className="hidden md:inline">{t('leave')}</span>
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="destructive" className={LEAVE_CLASS} aria-label={t('leave')} title={t('leave')}>
            <PhoneOff className="size-5" aria-hidden />
            <span className="hidden md:inline">{t('leave')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuItem onSelect={() => controller.leave()}>
            <LogOut aria-hidden />
            {t('leaveMeeting')}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmEnd(true)}>
            <XCircle aria-hidden />
            {t('endForAll')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title={t('endConfirmTitle')}
        description={t('endConfirmDesc')}
        confirmLabel={t('endForAll')}
        onConfirm={() => void controller.endForAll()}
      />
    </>
  )
}
