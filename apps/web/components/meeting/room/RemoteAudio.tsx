'use client'

import { useEffect, useRef } from 'react'
import { supportsSpeakerSelection } from '@/lib/meetings/devices'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'

type SinkAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }

/** One `<audio>` per stream: every video tile is muted, so people without a tile are still heard. */
function AudioStream({ stream, sinkId }: { stream: MediaStream; sinkId?: string }) {
  const ref = useRef<SinkAudio>(null)
  useEffect(() => {
    const el = ref.current
    if (el && el.srcObject !== stream) el.srcObject = stream
  }, [stream])
  useEffect(() => {
    const el = ref.current
    if (!el || !sinkId || !supportsSpeakerSelection() || !el.setSinkId) return
    el.setSinkId(sinkId).catch(() => undefined) // unplugged / not allowed: keep the default output
  }, [sinkId])
  return <audio ref={ref} autoPlay />
}

/** Everyone's voice (+ the sound of their screen share), routed to the chosen speaker. */
export function RemoteAudio() {
  const peers = useMeetingRoomStore((s) => s.peers)
  const sinkId = useMeetingRoomStore((s) => s.audioOutputId)
  return (
    <div aria-hidden className="hidden">
      {peers.map((p) => (
        <AudioStream key={p.identity} stream={p.stream} sinkId={sinkId} />
      ))}
      {peers.map((p) =>
        p.screen ? <AudioStream key={`${p.identity}:screen`} stream={p.screen} sinkId={sinkId} /> : null,
      )}
    </div>
  )
}
