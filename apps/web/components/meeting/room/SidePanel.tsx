'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'
import { useMeetingRoomStore, type RoomPanel } from '@/lib/store/meeting.store'
import { MeetingChatPanel } from './MeetingChatPanel'
import { NotesPanel } from './NotesPanel'
import { ParticipantsPanel } from './ParticipantsPanel'

const TITLE: Record<Exclude<RoomPanel, null>, 'peopleTitle' | 'chatTitle' | 'notes'> = {
  people: 'peopleTitle',
  chat: 'chatTitle',
  notes: 'notes',
}

/** The control-bar button that opened `panel` (phone: the More button). */
function opener(panel: RoomPanel): HTMLElement | null {
  if (!panel) return null
  return (
    document.querySelector<HTMLElement>(`[data-panel-toggle="${panel}"]`) ??
    document.querySelector<HTMLElement>('[data-panel-toggle="more"]')
  )
}

function PanelBody({ panel }: { panel: Exclude<RoomPanel, null> }): ReactNode {
  if (panel === 'people') return <ParticipantsPanel />
  if (panel === 'chat') return <MeetingChatPanel />
  return <NotesPanel />
}

/** People / chat / notes: a 360px column on md+, a bottom sheet on phones. Exactly one is mounted. */
export function SidePanel() {
  const t = useTranslations('meeting')
  const tc = useTranslations('common')
  const panel = useMeetingRoomStore((s) => s.panel)
  const isMobile = useIsMobile()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)

  // Opening a column moves focus into it (the sheet does this itself).
  useEffect(() => {
    if (panel && !isMobile) headingRef.current?.focus()
  }, [panel, isMobile])

  const close = () => {
    returnTo.current = opener(panel)
    useMeetingRoomStore.getState().setPanel(null)
    if (!isMobile) returnTo.current?.focus()
  }

  if (isMobile) {
    return (
      <Sheet open={panel !== null} onOpenChange={(open) => (open ? undefined : close())}>
        <SheetContent
          side="bottom"
          className="h-[85dvh] max-h-[85dvh] gap-0 rounded-t-2xl p-0 pb-safe"
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            returnTo.current?.focus()
          }}
        >
          <SheetTitle className="border-b border-border/60 px-4 py-3 text-base font-semibold">
            {panel ? t(TITLE[panel]) : ''}
          </SheetTitle>
          <SheetDescription className="sr-only">{panel ? t(TITLE[panel]) : ''}</SheetDescription>
          <div className="flex min-h-0 flex-1 flex-col">{panel ? <PanelBody panel={panel} /> : null}</div>
        </SheetContent>
      </Sheet>
    )
  }

  if (!panel) return null
  return (
    <aside aria-labelledby="meeting-panel-title" className="hidden w-[360px] shrink-0 flex-col border-l border-border/60 bg-card md:flex">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4">
        <h2 id="meeting-panel-title" ref={headingRef} tabIndex={-1} className="text-base font-semibold outline-none">
          {t(TITLE[panel])}
        </h2>
        <Button variant="ghost" size="icon" aria-label={tc('close')} title={tc('close')} onClick={close}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <PanelBody panel={panel} />
      </div>
    </aside>
  )
}
