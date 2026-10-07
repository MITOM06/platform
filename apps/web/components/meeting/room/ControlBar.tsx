'use client'

import { forwardRef, type ComponentProps, type ReactNode } from 'react'
import { useLocale, useNow, useTranslations } from 'next-intl'
import { Hand, MessageSquare, Mic, MicOff, MonitorOff, MonitorUp, NotebookPen, SmilePlus, Users, Video, VideoOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'
import { useMeetingHands, useMeetingLobby } from '@/lib/hooks/use-meetings'
import { supportsScreenShare } from '@/lib/meetings/devices'
import { canShareScreen, isManager } from '@/lib/meetings/permissions'
import { isMacPlatform, shortcutLabel, type ShortcutAction } from '@/lib/meetings/shortcuts'
import { useMeetingRoomStore, type RoomPanel } from '@/lib/store/meeting.store'
import { cn } from '@/lib/utils'
import { ControlBarMore } from './ControlBarMore'
import { LeaveMenu } from './LeaveMenu'
import { ReactionPicker } from './ReactionPicker'
import { useRoom } from './room-context'

type RoundProps = ComponentProps<typeof Button> & { label: string; tooltip?: string; badge?: ReactNode }

/** Round 44px icon button; `label` is its accessible name, `tooltip` the hover text. */
const RoundButton = forwardRef<HTMLButtonElement, RoundProps>(function RoundButton(
  { label, tooltip, badge, className, children, variant = 'secondary', ...props },
  ref,
) {
  return (
    <Button ref={ref} variant={variant} size="icon" aria-label={label} title={tooltip ?? label} className={cn('relative size-11 rounded-full', className)} {...props}>
      {children}
      {badge}
    </Button>
  )
})

function Dot({ srText, count }: { srText: string; count?: number }) {
  return (
    <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
      <span aria-hidden>{count ?? ''}</span>
      <span className="sr-only">{srText}</span>
    </span>
  )
}

function Clock({ code }: { code: string }) {
  const locale = useLocale()
  const now = useNow({ updateInterval: 30_000 })
  return (
    <div className="hidden min-w-0 items-center gap-2 font-mono text-xs text-muted-foreground lg:flex">
      <span>{new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(now)}</span>
      <span aria-hidden>·</span>
      <span className="truncate">{code}</span>
    </div>
  )
}

/** Opens the reaction picker above the bar. */
function ReactionButton({ label }: { label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <RoundButton label={label}>
          <SmilePlus className="size-5" aria-hidden />
        </RoundButton>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-auto p-1">
        <ReactionPicker />
      </PopoverContent>
    </Popover>
  )
}

/** Bottom bar of the meeting room. Phones keep mic, camera, hand, reaction, more, leave. */
export function ControlBar() {
  const t = useTranslations('meeting')
  const { meeting, controller, myId, realtimeConnected } = useRoom()
  const isMobile = useIsMobile()
  const mac = isMacPlatform()
  const mic = useMeetingRoomStore((s) => s.mic)
  const camera = useMeetingRoomStore((s) => s.camera)
  const screen = useMeetingRoomStore((s) => s.screen)
  const panel = useMeetingRoomStore((s) => s.panel)
  const unread = useMeetingRoomStore((s) => s.unreadChat)
  const myRole = useMeetingRoomStore((s) => s.myRole)
  const manager = isManager(myRole)
  const waiting = useMeetingLobby(meeting.id, manager).data?.length ?? 0
  const raised = !!useMeetingHands(meeting.id, true).data?.some((h) => h.userId === myId)
  const shareAllowed = canShareScreen(myRole, meeting.settings)
  const canShare = supportsScreenShare()
  const title = meeting.title?.trim() || t('untitled')

  const tip = (label: string, action: ShortcutAction) => t('withShortcut', { label, shortcut: shortcutLabel(action, mac) })
  const togglePanel = (p: Exclude<RoomPanel, null>) => useMeetingRoomStore.getState().setPanel(panel === p ? null : p)
  const toggleShare = () => void controller.toggleScreenShare()
  const attention = [
    ...(manager && waiting > 0 ? [t('lobbyWaiting', { count: waiting })] : []),
    ...(unread > 0 ? [t('chatUnread', { count: unread })] : []),
  ]

  return (
    <div role="toolbar" aria-label={title} className="flex min-h-16 shrink-0 items-center gap-1 border-t border-border/60 bg-background px-2 pb-safe md:min-h-[72px] md:gap-2 md:px-4">
      <div className="flex flex-1 basis-0 justify-start">
        <Clock code={meeting.code} />
      </div>
      <div className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto md:gap-2">
        <RoundButton label={t('deviceMic')} tooltip={tip(mic ? t('micOff') : t('micOn'), 'toggleMic')} aria-pressed={mic} variant={mic ? 'secondary' : 'destructive'} onClick={() => void controller.toggleMic()}>
          {mic ? <Mic className="size-5" aria-hidden /> : <MicOff className="size-5" aria-hidden />}
        </RoundButton>
        <RoundButton label={t('deviceCamera')} tooltip={tip(camera ? t('camOff') : t('camOn'), 'toggleCamera')} aria-pressed={camera} variant={camera ? 'secondary' : 'destructive'} onClick={() => void controller.toggleCamera()}>
          {camera ? <Video className="size-5" aria-hidden /> : <VideoOff className="size-5" aria-hidden />}
        </RoundButton>
        {canShare && !isMobile ? (
          <span title={!shareAllowed && !screen ? t('shareDisabled') : undefined}>
            <RoundButton label={t('shareStart')} tooltip={screen ? t('stopPresenting') : shareAllowed ? t('shareStart') : t('shareDisabled')} aria-pressed={screen} disabled={!shareAllowed && !screen} variant={screen ? 'default' : 'secondary'} onClick={toggleShare}>
              {screen ? <MonitorOff className="size-5" aria-hidden /> : <MonitorUp className="size-5" aria-hidden />}
            </RoundButton>
          </span>
        ) : null}
        <RoundButton label={t('raiseHand')} tooltip={tip(raised ? t('lowerHand') : t('raiseHand'), 'toggleHand')} aria-pressed={raised} disabled={!realtimeConnected} variant={raised ? 'default' : 'secondary'} onClick={() => controller.setHand(!raised)}>
          <Hand className="size-5" aria-hidden />
        </RoundButton>
        <ReactionButton label={t('reactions')} />
        <ControlBarMore
          compact={isMobile}
          share={canShare ? { allowed: shareAllowed, on: screen, toggle: toggleShare } : undefined}
          attention={isMobile ? attention : []}
        />
        <LeaveMenu />
      </div>
      <div className="flex flex-1 basis-0 justify-end gap-2">
        {!isMobile ? (
          <>
            <RoundButton label={t('people')} aria-pressed={panel === 'people'} data-panel-toggle="people" variant={panel === 'people' ? 'default' : 'ghost'} onClick={() => togglePanel('people')} badge={manager && waiting > 0 ? <Dot count={waiting} srText={t('lobbyWaiting', { count: waiting })} /> : null}>
              <Users className="size-5" aria-hidden />
            </RoundButton>
            <RoundButton label={t('chat')} aria-pressed={panel === 'chat'} data-panel-toggle="chat" variant={panel === 'chat' ? 'default' : 'ghost'} onClick={() => togglePanel('chat')} badge={unread > 0 ? <Dot srText={t('chatUnread', { count: unread })} /> : null}>
              <MessageSquare className="size-5" aria-hidden />
            </RoundButton>
            <RoundButton label={t('notes')} aria-pressed={panel === 'notes'} data-panel-toggle="notes" variant={panel === 'notes' ? 'default' : 'ghost'} onClick={() => togglePanel('notes')}>
              <NotebookPen className="size-5" aria-hidden />
            </RoundButton>
          </>
        ) : null}
      </div>
    </div>
  )
}
