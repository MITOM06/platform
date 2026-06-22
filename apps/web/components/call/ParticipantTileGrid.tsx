'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useCallStore } from '@/lib/store/call.store'
import { groupCallManager } from '@/lib/webrtc/group-call-manager'
import type { CallParticipant } from '@/lib/api/types'
import { useAuthStore } from '@/lib/store/auth.store'
import { useCallNames } from '@/lib/hooks/use-call-names'
import { cn } from '@/lib/utils'

function initial(name: string): string {
  return name?.[0]?.toUpperCase() ?? '?'
}

/** A single video (or avatar) tile bound to a MediaStream. */
function VideoTile({
  stream,
  name,
  video,
  muted,
  mirror,
  label,
}: {
  stream: MediaStream | null
  name: string
  video: boolean
  muted: boolean
  mirror?: boolean
  label?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])

  const hasVideoTrack = video && !!stream?.getVideoTracks().some((t) => t.enabled)

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={cn('h-full w-full object-cover', !hasVideoTrack && 'opacity-0', mirror && '-scale-x-100')}
      />
      {!hasVideoTrack && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-pon-cyan/40 to-pon-peach/40 text-2xl font-semibold text-white ring-2 ring-white/10">
            {initial(name)}
          </div>
        </div>
      )}
      <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium text-white">
        {label ?? name}
      </span>
    </div>
  )
}

/**
 * Grid of participant tiles for a group call. Renders the local preview plus
 * one tile per remote peer with a negotiated stream. Re-renders on
 * `streamsVersion` ticks so newly-arrived remote streams attach.
 */
export function ParticipantTileGrid({ youLabel }: { youLabel: string }) {
  const t = useTranslations('call')
  const currentUser = useAuthStore((s) => s.user)
  const roster = useCallStore((s) => s.roster)
  const conversationId = useCallStore((s) => s.groupConversationId)
  const media = useCallStore((s) => s.groupMedia)
  const cameraEnabled = useCallStore((s) => s.cameraEnabled)
  // streamsVersion is read so the component re-renders when peers/streams change.
  const streamsVersion = useCallStore((s) => s.streamsVersion)

  const localStream = groupCallManager.getLocalStream()
  const isVideo = media === 'video'

  // Roster broadcasts carry raw userIds; resolve them to nicknames/display names.
  const remoteIds = useMemo(
    () => roster.filter((p) => !p.leftAt && p.userId !== currentUser?.id).map((p) => p.userId),
    [roster, currentUser?.id],
  )
  const resolveName = useCallNames(conversationId, remoteIds)

  const remotes = useMemo(() => {
    void streamsVersion
    return roster
      .filter((p) => !p.leftAt && p.userId !== currentUser?.id)
      .map((p: CallParticipant) => ({
        peerId: p.userId,
        name: resolveName(p.userId) ?? t('peerFallback'),
        stream: groupCallManager.getRemoteStream(p.userId),
      }))
  }, [roster, currentUser?.id, streamsVersion, resolveName, t])

  const tileCount = remotes.length + 1
  const cols = tileCount <= 1 ? 1 : tileCount <= 4 ? 2 : 3

  return (
    <div
      className="grid w-full max-w-5xl gap-3 px-4"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      <div className="relative">
        <VideoTile
          stream={localStream}
          name={currentUser?.displayName ?? '?'}
          video={isVideo && cameraEnabled}
          muted
          mirror
          label={youLabel}
        />
      </div>
      {remotes.map((r) => (
        <VideoTile key={r.peerId} stream={r.stream} name={r.name} video={isVideo} muted={false} />
      ))}
    </div>
  )
}
