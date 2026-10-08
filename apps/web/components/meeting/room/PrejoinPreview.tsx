'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MediaPreview } from '@/lib/hooks/use-media-preview'
import { BigAvatar } from './BigAvatar'
import { MicLevel } from './MicLevel'

interface Props {
  preview: MediaPreview
  /** Already humanized. */
  myName: string
  myAvatarUrl?: string
  disabled: boolean
}

interface ToggleProps {
  on: boolean
  onLabel: string
  offLabel: string
  disabled: boolean
  onToggle(): void
  children: ReactNode
}

/** Round 44px media toggle: secondary when on, destructive when off (like Meet). */
function MediaToggle({ on, onLabel, offLabel, disabled, onToggle, children }: ToggleProps) {
  const label = on ? offLabel : onLabel
  return (
    <Button
      type="button"
      size="icon"
      variant={on ? 'secondary' : 'destructive'}
      className="size-11 rounded-full"
      aria-pressed={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onToggle}
    >
      {children}
    </Button>
  )
}

/** Mirrored self-view with the mic/camera toggles and the live mic level. */
export function PrejoinPreview({ preview, myName, myAvatarUrl, disabled }: Props) {
  const t = useTranslations('meeting')
  const videoRef = useRef<HTMLVideoElement>(null)
  const { stream, mic, camera } = preview
  const showVideo = camera && !!stream?.getVideoTracks().length

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream, showVideo])

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-950">
        {showVideo ? (
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            className="size-full -scale-x-100 object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3">
            <BigAvatar name={myName} avatarUrl={myAvatarUrl} />
            <p className="text-sm text-white/80">{t('prejoinCameraOff')}</p>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-3">
          <MediaToggle
            on={mic}
            onLabel={t('micOn')}
            offLabel={t('micOff')}
            disabled={disabled}
            onToggle={() => preview.setMic(!mic)}
          >
            {mic ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </MediaToggle>
          <MediaToggle
            on={camera}
            onLabel={t('camOn')}
            offLabel={t('camOff')}
            disabled={disabled}
            onToggle={() => preview.setCamera(!camera)}
          >
            {camera ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </MediaToggle>
        </div>
      </div>
      {mic && stream?.getAudioTracks().length ? (
        <div className="rounded-md bg-neutral-950 px-3 py-2">
          <MicLevel stream={stream} />
        </div>
      ) : null}
    </div>
  )
}
