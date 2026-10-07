'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authService } from '@/lib/api/auth'
import { meetingsApi } from '@/lib/api/meetings'
import type {
  DepartmentOption,
  Meeting,
  MeetingInput,
  MeetingListScope,
  NoteScope,
} from '@/lib/api/meeting-types'
import { useDepartments } from '@/lib/hooks/use-admin'
import { useHasCapability } from '@/lib/hooks/use-capabilities'
import {
  meetingKeys,
  replaceInList,
  rosterFromMeeting,
  upsertUpcoming,
  type MeetingListData,
} from '@/lib/meetings/cache-updates'
import { parseMeetingError } from '@/lib/meetings/meeting-errors'
import { applyMeetingEnded } from '@/lib/meetings/room-events'

/**
 * TanStack Query hooks for meetings. STOMP events patch these caches through
 * lib/meetings/cache-updates.ts; mutations patch them on success — nothing here
 * invalidates with a refetch. Errors are mapped by the caller (meetingErrorMessage).
 */

/** 4xx are answers, not glitches: never retry them. */
const noRetryOnClientError = (count: number, err: unknown) => {
  const s = parseMeetingError(err).status
  return !(s && s >= 400 && s < 500) && count < 2
}

export function useMeetingList(scope: MeetingListScope) {
  return useInfiniteQuery({
    queryKey: meetingKeys.list(scope),
    queryFn: ({ pageParam }) => meetingsApi.list(scope, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasNext ? last.content.at(-1)?.id : undefined),
    retry: noRetryOnClientError,
  })
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: meetingKeys.detail(id ?? ''),
    queryFn: () => meetingsApi.get(id ?? ''),
    enabled: !!id,
    retry: noRetryOnClientError,
  })
}

export function useMeetingByCode(code: string | null) {
  return useQuery({
    queryKey: meetingKeys.byCode(code ?? ''),
    queryFn: () => meetingsApi.byCode(code ?? ''),
    enabled: !!code,
    retry: noRetryOnClientError,
  })
}

/** Seeded from the meeting's open attendance; `meet.roster` keeps it current. */
export function useMeetingRoster(id: string, enabled: boolean) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: meetingKeys.roster(id),
    queryFn: async () => {
      const m = await meetingsApi.get(id)
      qc.setQueryData(meetingKeys.detail(id), m)
      return rosterFromMeeting(m)
    },
    enabled,
    staleTime: Infinity,
    retry: noRetryOnClientError,
  })
}

/** Seeded by GET /hands; `meet.hands` keeps it current. */
export function useMeetingHands(id: string, enabled: boolean) {
  return useQuery({
    queryKey: meetingKeys.hands(id),
    queryFn: () => meetingsApi.hands(id),
    enabled,
    staleTime: Infinity,
    retry: noRetryOnClientError,
  })
}

/**
 * Who waits to be let in (host/co-host only — `enabled` false for everyone else).
 * Seeded by GET /lobby; `meet.lobby` on the personal queue keeps it current, and a
 * refetch resyncs it after a STOMP reconnect.
 */
export function useMeetingLobby(id: string, enabled: boolean) {
  return useQuery({
    queryKey: meetingKeys.lobby(id),
    queryFn: () => meetingsApi.lobby(id),
    enabled,
    staleTime: Infinity,
    retry: noRetryOnClientError,
  })
}

/** Chat history, newest page first; `before` = the oldest line of the last page. */
export function useMeetingMessages(id: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: meetingKeys.messages(id),
    queryFn: ({ pageParam }) => meetingsApi.messages(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasNext ? last.content.at(-1)?.id : undefined),
    enabled,
    retry: noRetryOnClientError,
  })
}

export function useMeetingNote(id: string, scope: NoteScope, enabled: boolean) {
  return useQuery({
    queryKey: meetingKeys.note(id, scope),
    queryFn: () => meetingsApi.getNote(id, scope),
    enabled,
    retry: noRetryOnClientError,
  })
}

/** Departments the caller may attach a meeting to (auth-service, gap B1). */
export function useMyDepartments(enabled = true) {
  return useQuery({
    queryKey: meetingKeys.myDepartments,
    queryFn: () => authService.getMyDepartments(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: noRetryOnClientError,
  })
}

/**
 * Departments a meeting can be attached to: the caller's own (gap B1) plus, for
 * MANAGE_DEPARTMENTS holders, every department (the server allows both). Sorted by name.
 */
export function useMeetingDepartmentOptions(): DepartmentOption[] {
  const canManage = useHasCapability('MANAGE_DEPARTMENTS')
  const { data: mine = [] } = useMyDepartments()
  const { data: all = [] } = useDepartments(canManage)
  const byId = new Map<string, DepartmentOption>()
  for (const d of mine) byId.set(d.id, d)
  if (canManage) for (const d of all) if (d.name) byId.set(d._id, { id: d._id, name: d.name })
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function useStoreMeeting() {
  const qc = useQueryClient()
  return (m: Meeting) => {
    qc.setQueryData(meetingKeys.detail(m.id), m)
    qc.setQueryData(meetingKeys.byCode(m.code), m)
    if (m.status !== 'ENDED') {
      qc.setQueryData<MeetingListData>(meetingKeys.list('upcoming'), (d) => upsertUpcoming(d, m))
    }
    qc.setQueryData<MeetingListData>(meetingKeys.list('past'), (d) => replaceInList(d, m))
  }
}

export function useCreateMeeting() {
  const store = useStoreMeeting()
  return useMutation({
    mutationFn: (input: MeetingInput = {}) => meetingsApi.create(input),
    onSuccess: store,
  })
}

export function useUpdateMeeting(id: string) {
  const store = useStoreMeeting()
  return useMutation({
    mutationFn: (input: MeetingInput) => meetingsApi.update(id, input),
    onSuccess: store,
  })
}

export function useCancelMeeting(meeting: Pick<Meeting, 'id'>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => meetingsApi.cancel(meeting.id),
    onSuccess: () => applyMeetingEnded(qc, meeting.id, new Date().toISOString(), true),
  })
}

export function useEndMeeting(meeting: Pick<Meeting, 'id'>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => meetingsApi.end(meeting.id),
    onSuccess: () => applyMeetingEnded(qc, meeting.id, new Date().toISOString(), false),
  })
}
