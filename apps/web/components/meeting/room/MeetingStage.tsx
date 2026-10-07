'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useShallow } from 'zustand/react/shallow'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'
import { computeStage, gridColumns } from '@/lib/meetings/stage-layout'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { MeetingTile } from './MeetingTile'
import { useRoom } from './room-context'

/** The stage: a big tile + strip (pin / share / speaker mode), or the grid. */
export function MeetingStage() {
  const { controller, myId } = useRoom()
  const isMobile = useIsMobile()
  const s = useMeetingRoomStore(
    useShallow((st) => ({
      peers: st.peers,
      screen: st.screen,
      layout: st.layout,
      pinnedKey: st.pinnedKey,
      activeSpeakerId: st.activeSpeakerId,
    })),
  )

  const stage = useMemo(
    () =>
      computeStage({
        mode: s.layout,
        pinnedKey: s.pinnedKey,
        localIdentity: myId,
        remoteIds: s.peers.map((p) => p.identity),
        screenSharers: [...(s.screen ? [myId] : []), ...s.peers.filter((p) => p.screen).map((p) => p.identity)],
        activeSpeakerId: s.activeSpeakerId,
        maxTiles: isMobile ? 6 : 25,
      }),
    [s, myId, isMobile],
  )

  // Stop receiving the camera of people without a tile; resume when they get one back.
  const hiddenKey = stage.hiddenIds.join('\n')
  const disabled = useRef<Set<string>>(new Set())
  useEffect(() => {
    const hidden = new Set(hiddenKey ? hiddenKey.split('\n') : [])
    hidden.forEach((id) => {
      if (!disabled.current.has(id)) controller.setPeerVideoEnabled(id, false)
    })
    disabled.current.forEach((id) => {
      if (!hidden.has(id)) controller.setPeerVideoEnabled(id, true)
    })
    disabled.current = hidden
  }, [hiddenKey, controller])

  if (stage.main) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2 p-2 md:flex-row">
        <div className="min-h-0 min-w-0 flex-1">
          <MeetingTile tile={stage.main} variant="main" />
        </div>
        {stage.strip.length ? (
          <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto md:w-[200px] md:flex-col md:overflow-x-hidden md:overflow-y-auto">
            {stage.strip.map((tile) => (
              <MeetingTile key={tile.key} tile={tile} variant="strip" />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const count = stage.grid.length + (stage.overflow > 0 ? 1 : 0)
  const cols = gridColumns(count, isMobile)
  const rows = Math.max(1, Math.ceil(count / cols))
  return (
    <div
      className="grid h-full gap-2 p-2"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {stage.grid.map((tile) => (
        <MeetingTile key={tile.key} tile={tile} variant="grid" />
      ))}
      {stage.overflow > 0 ? <OverflowTile count={stage.overflow} /> : null}
    </div>
  )
}

/** "+N": everyone without a tile is listed in the People panel. */
function OverflowTile({ count }: { count: number }) {
  const t = useTranslations('meeting')
  return (
    <button
      type="button"
      aria-label={t('overflowMore', { count })}
      onClick={() => useMeetingRoomStore.getState().setPanel('people')}
      className="flex h-full w-full items-center justify-center rounded-lg border border-white/10 bg-neutral-900 text-2xl font-semibold text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-white"
    >
      {t('overflowTiles', { count })}
    </button>
  )
}
