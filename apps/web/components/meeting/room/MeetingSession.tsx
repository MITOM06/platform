'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Meeting } from '@/lib/api/meeting-types'
import { meetingsApi } from '@/lib/api/meetings'
import { safeDisplayName } from '@/lib/chat/names'
import { useLobbyExit } from '@/lib/hooks/use-lobby-exit'
import { useMeetingRoomStomp } from '@/lib/hooks/use-meeting-room-stomp'
import { MeetingRoomController } from '@/lib/meetings/meeting-room-controller'
import { LiveKitSession } from '@/lib/rtc/livekit-session'
import { useAuthStore } from '@/lib/store/auth.store'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { stompService } from '@/lib/stomp/client'
import { MeetingRoom } from './MeetingRoom'
import { PreJoinLobby } from './PreJoinLobby'
import { RoomStatusScreen } from './RoomStatusScreen'
import { WaitingScreen } from './WaitingScreen'

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** `c-` + 12 random base62 characters (the server's clientId format). */
function newClientId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return `c-${Array.from(bytes, (b) => BASE62[b % 62]).join('')}`
}

/** Owns the room controller for one meeting and switches screens by phase. */
export function MeetingSession({ meeting }: { meeting: Meeting }) {
  const t = useTranslations('meeting')
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [controller] = useState(
    () =>
      new MeetingRoomController(meeting, user?.id ?? '', {
        api: meetingsApi,
        queryClient,
        publish: (d, b) => stompService.publish(d, b),
        isRealtimeConnected: () => stompService.isConnected(),
        createSession: () => new LiveKitSession(),
        now: () => Date.now(),
        newClientId,
        // Captures the first render's `t`: a locale switch mid-meeting keeps the old language for toasts.
        notify: (level, m) => {
          const text = t(m.key, m.values)
          if (level === 'error') toast.error(text)
          else toast(text)
        },
      }),
  )

  // StrictMode-safe: activate → dispose → activate on the same instance.
  useEffect(() => {
    controller.activate()
    return () => controller.dispose()
  }, [controller])

  const phase = useMeetingRoomStore((s) => s.phase)
  useMeetingRoomStomp({
    controller,
    meetingId: meeting.id,
    code: meeting.code,
    active: phase === 'connecting' || phase === 'inRoom',
  })

  useLobbyExit(controller, phase === 'waiting')

  // The meeting is over: say so once and show its details (attendance, notes).
  const endedHandled = useRef(false)
  useEffect(() => {
    if (phase !== 'ended' || endedHandled.current) return
    endedHandled.current = true
    toast(t('endedToast'))
    router.replace(`/meetings/${encodeURIComponent(meeting.id)}`)
  }, [phase, meeting.id, router, t])

  const myName = safeDisplayName(user?.displayName, user?.id) ?? ''

  switch (phase) {
    case 'loading':
    case 'ended':
      return <div className="h-dvh w-full bg-background" aria-busy="true" />
    case 'prejoin':
    case 'joining':
    case 'connecting':
      return (
        <PreJoinLobby
          meeting={meeting}
          controller={controller}
          busy={phase !== 'prejoin'}
          myName={myName}
          myAvatarUrl={user?.avatarUrl}
        />
      )
    case 'waiting':
      return (
        <WaitingScreen
          meeting={meeting}
          controller={controller}
          myName={myName || t('you')}
          myAvatarUrl={user?.avatarUrl}
        />
      )
    case 'inRoom':
      return (
        <MeetingRoom
          meeting={meeting}
          controller={controller}
          myId={user?.id ?? ''}
          myName={myName}
          myAvatarUrl={user?.avatarUrl}
        />
      )
    default:
      return <RoomStatusScreen kind={phase} meetingId={meeting.id} onRetry={() => void controller.rejoin()} />
  }
}
