'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageSquare, MonitorUp, MoreHorizontal, NotebookPen, Settings2, ShieldCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { isManager } from '@/lib/meetings/permissions'
import type { LayoutMode } from '@/lib/meetings/stage-layout'
import { useMeetingRoomStore, type RoomPanel } from '@/lib/store/meeting.store'
import { RoomDevicesDialog } from './RoomDevicesDialog'

/** Id of the host-controls block at the end of the People panel (Task 19). */
export const MANAGE_SECTION_ID = 'meeting-manage'

interface Props {
  /** Phone: People / Chat / Notes / Present live in this menu instead of the bar. */
  compact: boolean
  /** Present item (phone only): undefined = this browser cannot share. */
  share?: { allowed: boolean; on: boolean; toggle(): void }
  /** Phone: what the hidden panel buttons would badge (people waiting, unread chat) — read aloud. */
  attention?: string[]
}

/** Phone: the panel buttons (and Present) that do not fit in the bar. */
function CompactPanelItems({ open, share }: { open: (panel: Exclude<RoomPanel, null>) => void; share: Props['share'] }) {
  const t = useTranslations('meeting')
  return (
    <>
      <DropdownMenuItem onSelect={() => open('people')}>
        <Users aria-hidden />
        {t('people')}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => open('chat')}>
        <MessageSquare aria-hidden />
        {t('chat')}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => open('notes')}>
        <NotebookPen aria-hidden />
        {t('notes')}
      </DropdownMenuItem>
      {share ? (
        <DropdownMenuItem disabled={!share.allowed && !share.on} onSelect={share.toggle}>
          <MonitorUp aria-hidden />
          {share.on ? t('stopPresenting') : share.allowed ? t('shareStart') : t('shareDisabled')}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
    </>
  )
}

/** "More options": layout, devices, host controls — plus the panels on phones. */
export function ControlBarMore({ compact, share, attention = [] }: Props) {
  const t = useTranslations('meeting')
  const [devicesOpen, setDevicesOpen] = useState(false)
  const layout = useMeetingRoomStore((s) => s.layout)
  const manager = isManager(useMeetingRoomStore((s) => s.myRole))
  const open = (panel: Exclude<RoomPanel, null>) => useMeetingRoomStore.getState().setPanel(panel)
  const openManage = () => {
    open('people')
    // The panel mounts on the next frames; then bring the host block into view.
    setTimeout(() => document.getElementById(MANAGE_SECTION_ID)?.scrollIntoView({ block: 'start' }), 50)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="relative size-11 rounded-full"
            aria-label={t('more')}
            title={t('more')}
            data-panel-toggle="more"
          >
            <MoreHorizontal className="size-5" aria-hidden />
            {attention.length ? (
              <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-primary">
                {attention.map((text) => (
                  <span key={text} className="sr-only">{text}</span>
                ))}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56">
          {compact ? <CompactPanelItems open={open} share={share} /> : null}
          <DropdownMenuLabel className="text-xs text-muted-foreground">{t('layout')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={layout}
            onValueChange={(v) => useMeetingRoomStore.getState().setLayout(v === 'spotlight' ? 'spotlight' : ('grid' satisfies LayoutMode))}
          >
            <DropdownMenuRadioItem value="grid">{t('layoutGrid')}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="spotlight">{t('layoutSpotlight')}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDevicesOpen(true)}>
            <Settings2 aria-hidden />
            {t('devicesTitle')}
          </DropdownMenuItem>
          {manager ? (
            <DropdownMenuItem onSelect={openManage}>
              <ShieldCheck aria-hidden />
              {t('manageTitle')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <RoomDevicesDialog open={devicesOpen} onOpenChange={setDevicesOpen} />
    </>
  )
}
