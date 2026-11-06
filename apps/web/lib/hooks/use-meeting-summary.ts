'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { meetingsApi } from '@/lib/api/meetings'
import type { MeetingSummaryResponse } from '@/lib/api/meeting-types'
import { meetingKeys } from '@/lib/meetings/cache-updates'
import { parseMeetingError } from '@/lib/meetings/meeting-errors'

/** AI summary of a meeting. `meet.summary.ready` invalidates this query (realtime/meeting-queue). */
export function useMeetingSummary(id: string, enabled: boolean) {
  return useQuery({
    queryKey: meetingKeys.summary(id),
    queryFn: () => meetingsApi.summary(id),
    enabled,
    retry: (count, err) => {
      const s = parseMeetingError(err).status
      return !(s && s >= 400 && s < 500) && count < 2
    },
  })
}

/** Host/co-host regenerate. On success the cached state becomes PENDING until `meet.summary.ready`. */
export function useRegenerateSummary(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => meetingsApi.regenerateSummary(id),
    onError: (err) => {
      // Someone else already started it: our cached state is stale, show the real PENDING.
      if (parseMeetingError(err).code === 'MEETING_SUMMARY_PENDING') {
        void qc.invalidateQueries({ queryKey: meetingKeys.summary(id) })
      }
    },
    onSuccess: () => {
      qc.setQueryData<MeetingSummaryResponse>(meetingKeys.summary(id), (d) => ({
        ...(d ?? { inGroup: false }),
        state: 'PENDING',
      }))
    },
  })
}
