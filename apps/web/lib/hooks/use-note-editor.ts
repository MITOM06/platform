'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { meetingsApi } from '@/lib/api/meetings'
import type { NoteScope } from '@/lib/api/meeting-types'
import { meetingKeys } from '@/lib/meetings/cache-updates'
import { meetingErrorKey, noteConflictLatest, parseMeetingError } from '@/lib/meetings/meeting-errors'
import {
  canAutosave,
  initialNoteState,
  needsRefetch,
  noteReducer,
  savePayload,
  type NoteState,
  type RemoteNewer,
} from '@/lib/meetings/note-sync'
import { useMeetingNote } from './use-meetings'

/** Autosave fires this long after the last keystroke. */
export const NOTE_AUTOSAVE_MS = 2000

export interface NoteEditor {
  state: NoteState
  readOnly: boolean
  /** The note could not be loaded (403 removed / guest, network…). */
  loadError: unknown
  edit(draft: string): void
  retry(): void
  keepMine(): void
  takeTheirs(): void
  saveMerged(draft: string): void
  /** Save now if dirty (panel close, leaving the room). */
  flush(): Promise<void>
}

export function useNoteEditor(
  meetingId: string,
  scope: NoteScope,
  opts: { enabled: boolean; canEdit: boolean; remote?: RemoteNewer | null },
): NoteEditor {
  const queryClient = useQueryClient()
  const query = useMeetingNote(meetingId, scope, opts.enabled)
  const [state, dispatch] = useReducer(noteReducer, initialNoteState)

  // Server data → reducer, adjusted during render (no dispatch inside an effect):
  // each new query result / remote signal is applied exactly once.
  const [appliedAt, setAppliedAt] = useState(0)
  if (query.data && query.dataUpdatedAt !== appliedAt) {
    setAppliedAt(query.dataUpdatedAt)
    dispatch({ type: 'loaded', note: query.data })
  }
  const remote = opts.remote ?? null
  const [appliedRemote, setAppliedRemote] = useState<number | null>(null)
  if (remote && remote.version !== appliedRemote) {
    setAppliedRemote(remote.version)
    dispatch({ type: 'remoteUpdated', version: remote.version, updatedBy: remote.updatedBy })
  }

  // Latest state for callbacks (timers, unmount) — read only outside render.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })
  const savingRef = useRef(false)

  const save = useCallback(async () => {
    const current = stateRef.current
    if (savingRef.current || !canAutosave(current)) return
    savingRef.current = true
    dispatch({ type: 'saveStarted' })
    try {
      const note = await meetingsApi.putNote(meetingId, scope, savePayload(current))
      dispatch({ type: 'saveSucceeded', note })
      queryClient.setQueryData(meetingKeys.note(meetingId, scope), note)
    } catch (err) {
      const latest = noteConflictLatest(err)
      if (latest) dispatch({ type: 'saveConflicted', latest })
      else dispatch({ type: 'saveFailed', errorKey: meetingErrorKey(parseMeetingError(err), 'note') })
    } finally {
      savingRef.current = false
    }
  }, [meetingId, scope, queryClient])

  // Autosave 2s after the last change.
  const autosave = canAutosave(state) && opts.canEdit
  useEffect(() => {
    if (!autosave) return
    const timer = setTimeout(() => void save(), NOTE_AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [autosave, state.draft, save])

  // A newer version exists and nothing local would be lost: load it.
  const refetchNeeded = needsRefetch(state)
  const { refetch } = query
  useEffect(() => {
    if (refetchNeeded) void refetch()
  }, [refetchNeeded, refetch])

  // Leaving with unsaved text: best-effort save.
  useEffect(() => () => void save(), [save])

  return {
    state,
    readOnly: !opts.canEdit,
    loadError: query.error,
    edit: (draft) => dispatch({ type: 'edit', draft }),
    retry: () => dispatch({ type: 'retry' }),
    keepMine: () => dispatch({ type: 'keepMine' }),
    takeTheirs: () => dispatch({ type: 'takeTheirs' }),
    saveMerged: (draft) => dispatch({ type: 'saveMerged', draft }),
    flush: save,
  }
}
