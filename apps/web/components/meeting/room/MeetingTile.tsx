'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Hand, MicOff, MonitorUp, MoreVertical, Pin, PinOff, Shield, SignalLow } from 'lucide-react'
import { VideoTile } from '@/components/call/VideoTile'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { safeDisplayName } from '@/lib/chat/names'
import { useMeetingHands, useMeetingRoster } from '@/lib/hooks/use-meetings'
import { isManager } from '@/lib/meetings/permissions'
import type { StageTile } from '@/lib/meetings/stage-layout'
import { useShallow } from 'zustand/react/shallow'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { useRoom } from './room-context'

export type TileVariant = 'main' | 'grid' | 'strip'

const SIZE: Record<TileVariant, string> = {
  main: 'group h-full aspect-auto',
  grid: 'group h-full aspect-auto',
  strip: 'group w-[120px] shrink-0 md:w-full',
}

function Badge({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span role="img" aria-label={label} title={label} className="flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full bg-black/55 px-1.5 text-xs text-white">
      {children}
    </span>
  )
}

/** One stage tile: a camera or a screen share, mine or someone else's. Audio plays in RemoteAudio. */
export function MeetingTile({ tile, variant }: { tile: StageTile; variant: TileVariant }) {
  const t = useTranslations('meeting')
  const { meeting, controller, myName, myAvatarUrl } = useRoom()
  const peer = useMeetingRoomStore((s) => (tile.isLocal ? undefined : s.peers.find((p) => p.identity === tile.identity)))
  const local = useMeetingRoomStore(
    useShallow((s) => ({ stream: s.localStream, screen: s.localScreen, mic: s.mic, camera: s.camera })),
  )
  const pinned = useMeetingRoomStore((s) => s.pinnedKey === tile.key)
  const roster = useMeetingRoster(meeting.id, true).data
  const hands = useMeetingHands(meeting.id, true).data
  const entry = roster?.find((r) => r.userId === tile.identity)
  const handIndex = hands?.findIndex((h) => h.userId === tile.identity) ?? -1

  const name = tile.isLocal
    ? myName || t('you')
    : safeDisplayName(peer?.name, tile.identity) ?? safeDisplayName(entry?.displayName, tile.identity) ?? t('participantFallback')
  const screenTile = tile.kind === 'screen'

  if (screenTile && tile.isLocal && variant === 'main') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-lg border border-white/10 bg-neutral-900 p-4 text-white">
        <MonitorUp className="size-8 text-white/70" aria-hidden />
        <p className="text-sm font-medium">{t('presenting')}</p>
        <Button variant="secondary" onClick={() => void controller.toggleScreenShare()}>
          {t('stopPresenting')}
        </Button>
      </div>
    )
  }

  const label = screenTile
    ? tile.isLocal ? t('presenting') : t('presentingName', { name })
    : tile.isLocal && myName ? t('nameWithYou', { name: myName }) : name
  const stream = screenTile ? (tile.isLocal ? local.screen : (peer?.screen ?? null)) : tile.isLocal ? local.stream : (peer?.stream ?? null)
  const video = screenTile || (tile.isLocal ? local.camera : !peer?.camMuted)
  const micMuted = tile.isLocal ? !local.mic : !!peer?.micMuted

  const badges = (
    <>
      {!screenTile && peer?.poorConnection ? (
        <Badge label={t('poorConnectionPeer')}><SignalLow className="size-3.5" aria-hidden /></Badge>
      ) : null}
      {!screenTile && isManager(entry?.role) ? (
        <Badge label={t('hostBadge')}><Shield className="size-3.5" aria-hidden /></Badge>
      ) : null}
      {!screenTile && handIndex >= 0 ? (
        <Badge label={t('handRaisedLabel')}><Hand className="size-3.5" aria-hidden />{handIndex + 1}</Badge>
      ) : null}
      {!screenTile && micMuted ? (
        <Badge label={t('micMutedLabel')}><MicOff className="size-3.5" aria-hidden /></Badge>
      ) : null}
      <TileMenu tileKey={tile.key} name={label} pinned={pinned} />
    </>
  )

  return (
    <VideoTile
      stream={stream}
      name={name}
      video={video}
      muted
      mirror={tile.isLocal && !screenTile}
      label={label}
      speaking={!screenTile && !!peer?.speaking}
      fit={screenTile ? 'contain' : 'cover'}
      avatarUrl={tile.isLocal ? myAvatarUrl : peer?.avatarUrl}
      badges={badges}
      className={SIZE[variant]}
    />
  )
}

function TileMenu({ tileKey, name, pinned }: { tileKey: string; name: string; pinned: boolean }) {
  const t = useTranslations('meeting')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('tileMenu', { name })}
          className="flex size-7 items-center justify-center rounded-full bg-black/55 text-white transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <MoreVertical className="size-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => useMeetingRoomStore.getState().togglePin(tileKey)}>
          {pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
          {pinned ? t('unpin') : t('pin')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
