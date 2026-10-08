'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { MeetingSession } from '@/components/meeting/room/MeetingSession'
import { RoomStatusScreen } from '@/components/meeting/room/RoomStatusScreen'
import { useMeetingByCode } from '@/lib/hooks/use-meetings'
import { parseMeetingCodeInput } from '@/lib/meetings/meeting-code'
import { parseMeetingError } from '@/lib/meetings/meeting-errors'
import { initialPhase } from '@/lib/meetings/room-phase'

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** /meet/[code] — full-screen meeting: pre-join → (waiting) → room, or a status screen. */
export default function MeetPage() {
  const { code: raw } = useParams<{ code: string }>()
  const router = useRouter()
  const code = parseMeetingCodeInput(safeDecode(raw ?? ''))
  const query = useMeetingByCode(code)
  const meeting = query.data
  // A failed background refetch must not replace a meeting that is already loaded.
  const loadError = query.error && !meeting ? parseMeetingError(query.error) : null
  const phase = code ? initialPhase(meeting, loadError) : 'notFound'

  // An ended or cancelled meeting is not an error: show its details (attendance, notes).
  useEffect(() => {
    if (phase === 'ended' && meeting) router.replace(`/meetings/${encodeURIComponent(meeting.id)}`)
  }, [phase, meeting, router])

  if (!meeting || phase === 'ended') {
    if (phase !== 'loading' && phase !== 'ended') {
      const kind = phase === 'notFound' || phase === 'unavailable' ? phase : 'error'
      return <RoomStatusScreen kind={kind} onRetry={() => void query.refetch()} />
    }
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background" aria-busy="true">
        <Loader2 className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
      </div>
    )
  }

  return (
    <div className="h-dvh w-full overflow-hidden">
      <MeetingSession key={meeting.id} meeting={meeting} />
    </div>
  )
}
