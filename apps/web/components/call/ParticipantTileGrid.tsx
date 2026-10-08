'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useCallStore } from '@/lib/store/call.store'
import { groupCallManager } from '@/lib/webrtc/group-call-manager'
import type { CallParticipant } from '@/lib/api/types'
import { useAuthStore } from '@/lib/store/auth.store'
import { useCallNames } from '@/lib/hooks/use-call-names'
import { VideoTile } from './VideoTile'

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
  const speakingIds = useCallStore((s) => s.speakingIds)

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
        speaking: speakingIds.includes(p.userId),
      }))
  }, [roster, currentUser?.id, streamsVersion, speakingIds, resolveName, t])

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
        <VideoTile
          key={r.peerId}
          stream={r.stream}
          name={r.name}
          video={isVideo}
          muted={false}
          speaking={r.speaking}
        />
      ))}
    </div>
  )
}
