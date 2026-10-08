'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, SignalLow, WifiOff } from 'lucide-react'
import type { Meeting } from '@/lib/api/meeting-types'
import { useMeetingHands, useMeetingLobby, useMeetingRoster } from '@/lib/hooks/use-meetings'
import { useMeetingShortcuts } from '@/lib/hooks/use-meeting-shortcuts'
import type { MeetingRoomController } from '@/lib/meetings/meeting-room-controller'
import { isManager } from '@/lib/meetings/permissions'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { useStompConnected } from '@/lib/stomp/use-stomp-connected'
import { ControlBar } from './ControlBar'
import { MeetingStage } from './MeetingStage'
import { ReactionOverlay } from './ReactionOverlay'
import { RemoteAudio } from './RemoteAudio'
import { RoomContext, type RoomContextValue } from './room-context'
import { SidePanel } from './SidePanel'

interface Props {
  meeting: Meeting
  controller: MeetingRoomController
  myId: string
  myName: string
  myAvatarUrl?: string
}

/** Connection notices over the stage: LiveKit reconnecting / unstable, STOMP offline. */
function RoomBanners({ realtimeConnected }: { realtimeConnected: boolean }) {
  const t = useTranslations('meeting')
  const reconnecting = useMeetingRoomStore((s) => s.reconnecting)
  const poor = useMeetingRoomStore((s) => s.poorConnection)
  const notice = reconnecting
    ? { icon: <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />, text: t('reconnecting') }
    : !realtimeConnected
      ? { icon: <WifiOff className="size-4" aria-hidden />, text: t('realtimeOffline') }
      : poor
        ? { icon: <SignalLow className="size-4" aria-hidden />, text: t('poorConnection') }
        : null
  return (
    <div role="status" className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
      {notice ? (
        <p className="flex max-w-full items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white">
          {notice.icon}
          <span>{notice.text}</span>
        </p>
      ) : null}
    </div>
  )
}

/** Managers: a toast when more people start waiting while the People panel is closed. */
function useLobbyToast(meetingId: string) {
  const t = useTranslations('meeting')
  const manager = isManager(useMeetingRoomStore((s) => s.myRole))
  const count = useMeetingLobby(meetingId, manager).data?.length ?? 0
  const prev = useRef(count)
  useEffect(() => {
    const was = prev.current
    prev.current = count
    if (count <= was || useMeetingRoomStore.getState().panel === 'people') return
    toast(t('lobbyWaiting', { count }), {
      action: { label: t('notifOpen'), onClick: () => useMeetingRoomStore.getState().setPanel('people') },
    })
  }, [count, t])
}

/** The room itself: stage + side panel + control bar. Remote audio plays outside the tiles. */
export function MeetingRoom({ meeting, controller, myId, myName, myAvatarUrl }: Props) {
  const t = useTranslations('meeting')
  const realtimeConnected = useStompConnected()
  // Seed the roster (roles, names) and hands for everyone who renders them.
  useMeetingRoster(meeting.id, true)
  const raised = !!useMeetingHands(meeting.id, true).data?.some((h) => h.userId === myId)
  useMeetingShortcuts(controller, raised)
  useLobbyToast(meeting.id)

  const room = useMemo<RoomContextValue>(
    () => ({ meeting, controller, myId, myName, myAvatarUrl, realtimeConnected }),
    [meeting, controller, myId, myName, myAvatarUrl, realtimeConnected],
  )
  const title = meeting.title?.trim() || t('untitled')

  return (
    <RoomContext.Provider value={room}>
      <div className="flex h-dvh w-full flex-col bg-background">
        <div className="flex min-h-0 flex-1">
          <main className="relative min-w-0 flex-1 bg-neutral-950" aria-label={title}>
            <RoomBanners realtimeConnected={realtimeConnected} />
            <MeetingStage />
            <ReactionOverlay />
          </main>
          <SidePanel />
        </div>
        <ControlBar />
        <RemoteAudio />
      </div>
    </RoomContext.Provider>
  )
}
