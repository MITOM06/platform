'use client'

import { useCallback, useState } from 'react'
import { useSpeechTranscriber } from '@/lib/hooks/use-call-transcriber'
import { stompService } from '@/lib/stomp/client'

/**
 * Speech capture for AI meeting notes. While `active` (in the room and AI notes
 * on) and not `paused`, publishes each final line to `/app/meet.transcript`.
 * Pausing only stops recognition — the call's mic track is untouched.
 */
export function useMeetingTranscriber(
  meetingId: string | null,
  active: boolean,
): { supported: boolean; paused: boolean; setPaused(p: boolean): void } {
  const [paused, setPaused] = useState(false)
  const onFinal = useCallback(
    (text: string) => {
      if (meetingId) stompService.publish('/app/meet.transcript', { meetingId, text, ts: Date.now() })
    },
    [meetingId],
  )
  const { supported } = useSpeechTranscriber(active && !paused && !!meetingId, onFinal)
  return { supported, paused, setPaused }
}
