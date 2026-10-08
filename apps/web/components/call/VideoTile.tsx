'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { absoluteMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

function initial(name: string): string {
  return name?.[0]?.toUpperCase() ?? '?'
}

export interface VideoTileProps {
  stream: MediaStream | null
  name: string
  video: boolean
  muted: boolean
  mirror?: boolean
  label?: string
  /** Active speaker (LiveKit calls): highlighted with the accent ring. */
  speaking?: boolean
  /** Small icons in the top-right corner (mic off, raised hand…). */
  badges?: ReactNode
  /** 'contain' for screen shares (nothing cropped). Default 'cover'. */
  fit?: 'cover' | 'contain'
  /** Shown instead of the first letter while there is no video. */
  avatarUrl?: string
  className?: string
}

/**
 * A single video (or avatar) tile bound to a MediaStream. Shared by group calls
 * (ParticipantTileGrid) and meetings (MeetingTile): with only the call props set,
 * the DOM and classes are exactly the call tile's.
 */
export function VideoTile({
  stream,
  name,
  video,
  muted,
  mirror,
  label,
  speaking,
  badges,
  fit = 'cover',
  avatarUrl,
  className,
}: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])

  const hasVideoTrack = video && !!stream?.getVideoTracks().some((t) => t.enabled)

  return (
    <div
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-neutral-900',
        speaking && 'ring-2 ring-primary',
        className,
      )}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={cn(
          'h-full w-full',
          fit === 'contain' ? 'object-contain' : 'object-cover',
          !hasVideoTrack && 'opacity-0',
          mirror && '-scale-x-100',
        )}
      />
      {!hasVideoTrack && (
        <div className="absolute inset-0 flex items-center justify-center">
          {avatarUrl ? (
            <Avatar className="size-16 ring-2 ring-white/10">
              <AvatarImage src={absoluteMediaUrl(avatarUrl)} alt="" />
              <AvatarFallback className="bg-primary/40 text-2xl font-semibold text-white">{initial(name)}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/40 text-2xl font-semibold text-white ring-2 ring-white/10">
              {initial(name)}
            </div>
          )}
        </div>
      )}
      {badges ? <div className="absolute top-2 right-2 flex items-center gap-1">{badges}</div> : null}
      <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium text-white">
        {label ?? name}
      </span>
    </div>
  )
}
