'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useLocale, useNow, useTranslations } from 'next-intl'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Meeting } from '@/lib/api/meeting-types'
import { useMediaPreview } from '@/lib/hooks/use-media-preview'
import { loadDevicePrefs, pickDeviceId, safeLocalStorage, saveDevicePrefs } from '@/lib/meetings/devices'
import type { MeetingRoomController } from '@/lib/meetings/meeting-room-controller'
import { isManager, prejoinIntent } from '@/lib/meetings/permissions'
import { formatMeetingRange } from '@/lib/meetings/schedule'
import { useCallStore } from '@/lib/store/call.store'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { DeviceSelects } from './DeviceSelects'
import { PrejoinPreview } from './PrejoinPreview'

interface Props {
  meeting: Meeting
  controller: MeetingRoomController
  /** joining / connecting: everything disabled, the main button spins. */
  busy: boolean
  /** Already humanized; '' when unknown. */
  myName: string
  myAvatarUrl?: string
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/** Device check before entering: preview, mic/camera, devices, then Join / Ask to join. */
export function PreJoinLobby({ meeting, controller, busy, myName, myAvatarUrl }: Props) {
  const t = useTranslations('meeting')
  const locale = useLocale()
  const now = useNow({ updateInterval: 30_000 })
  const attendee = !isManager(meeting.viewerRole)
  const muteOnEntry = meeting.settings.muteOnEntry && attendee
  const [prefs] = useState(() => {
    const stored = loadDevicePrefs(safeLocalStorage())
    return muteOnEntry ? { ...stored, micOn: false } : stored
  })
  const preview = useMediaPreview(prefs, !busy)
  const inCall = useCallStore(
    (s) => s.status === 'outgoing' || s.status === 'connected' || s.groupCallId !== null,
  )
  const intent = prejoinIntent(meeting)
  const startsLater =
    meeting.scheduledStart && Date.parse(meeting.scheduledStart) > now.getTime()
      ? formatMeetingRange(locale, meeting.scheduledStart)
      : null

  const join = () => {
    const audioDeviceId = pickDeviceId(preview.devices.audioinput, preview.audioInput)
    const videoDeviceId = pickDeviceId(preview.devices.videoinput, preview.videoInput)
    saveDevicePrefs(
      {
        audioInput: preview.audioInput,
        videoInput: preview.videoInput,
        audioOutput: preview.audioOutput,
        micOn: preview.mic,
        camOn: preview.camera,
      },
      safeLocalStorage(),
    )
    preview.release()
    useMeetingRoomStore.getState().setAudioOutput(preview.audioOutput)
    void controller.join({ mic: preview.mic, camera: preview.camera, audioDeviceId, videoDeviceId })
  }

  return (
    <div className="h-dvh w-full overflow-y-auto bg-background">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-8 md:grid-cols-[1fr_320px] md:items-center md:py-16">
        <div className="min-w-0 space-y-4">
          <PrejoinPreview preview={preview} myName={myName || t('you')} myAvatarUrl={myAvatarUrl} disabled={busy} />
          <DeviceSelects
            devices={preview.devices}
            audioInput={preview.audioInput}
            videoInput={preview.videoInput}
            audioOutput={preview.audioOutput}
            onSelect={preview.selectDevice}
            disabled={busy}
          />
        </div>
        <div className="min-w-0 space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('prejoinTitle')}</p>
            <h1 className="text-xl font-semibold break-words">{meeting.title?.trim() || t('untitled')}</h1>
            {startsLater ? <p className="text-sm text-muted-foreground">{t('prejoinStartsAt', { time: startsLater })}</p> : null}
            {myName ? <p className="text-sm text-muted-foreground">{t('prejoinJoiningAs', { name: myName })}</p> : null}
          </div>
          {inCall ? <Notice>{t('prejoinInCall')}</Notice> : null}
          {intent === 'locked' ? <Notice>{t('prejoinLockedHint')}</Notice> : null}
          {muteOnEntry ? <Notice>{t('prejoinMuteOnEntry')}</Notice> : null}
          {preview.error ? <Notice>{t(preview.error === 'blocked' ? 'mediaBlocked' : 'mediaUnavailable')}</Notice> : null}
          <Button className="w-full" size="lg" disabled={busy || inCall} onClick={join}>
            {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {intent === 'ask' ? t('askToJoin') : t('joinNow')}
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/meetings">{t('backToList')}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
