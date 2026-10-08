import type { MeetingNote, MeetingNoteInput, MeetingPerson } from '@/lib/api/meeting-types'
import type { MessageKey } from './meeting-errors'

/**
 * Note editor state machine (shared + private meeting notes).
 *
 * The one rule: what the user typed is never overwritten. Saves are optimistic-concurrency
 * (`version`); a 409 keeps the draft and offers keep-mine / take-theirs / save-merged.
 * Typing during a save stays as a new dirty draft on top of the saved version.
 */

export type NoteStatus = 'loading' | 'clean' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error'

export interface RemoteNewer {
  version: number
  updatedBy?: MeetingPerson
}

export interface NoteState {
  status: NoteStatus
  /** Version the draft is based on (sent as `version`). */
  baseVersion: number
  baseContent: string
  /** What the user sees — never overwritten while they have edits. */
  draft: string
  savingDraft: string | null
  /** The other version during a conflict. */
  latest: MeetingNote | null
  remoteNewer: RemoteNewer | null
  errorKey: MessageKey | null
}

export const initialNoteState: NoteState = {
  status: 'loading',
  baseVersion: 0,
  baseContent: '',
  draft: '',
  savingDraft: null,
  latest: null,
  remoteNewer: null,
  errorKey: null,
}

export type NoteAction =
  | { type: 'loaded'; note: MeetingNote }
  | { type: 'edit'; draft: string }
  | { type: 'saveStarted' }
  | { type: 'saveSucceeded'; note: MeetingNote }
  | { type: 'saveConflicted'; latest: MeetingNote }
  | { type: 'saveFailed'; errorKey: MessageKey }
  | { type: 'retry' }
  | { type: 'remoteUpdated'; version: number; updatedBy?: MeetingPerson }
  | { type: 'keepMine' }
  | { type: 'takeTheirs' }
  | { type: 'saveMerged'; draft: string }

/** Drop the "newer version exists" flag once our base caught up with it. */
const settledRemote = (remote: RemoteNewer | null, version: number) =>
  remote && remote.version > version ? remote : null

/** Rebase the draft on `note` (after a conflict was resolved). */
function rebase(s: NoteState, note: MeetingNote, draft: string): NoteState {
  return {
    ...s,
    status: draft === note.content ? 'clean' : 'dirty',
    baseVersion: note.version,
    baseContent: note.content,
    draft,
    latest: null,
    remoteNewer: settledRemote(s.remoteNewer, note.version),
    errorKey: null,
  }
}

function onLoaded(s: NoteState, note: MeetingNote): NoteState {
  if (s.status !== 'loading' && note.version <= s.baseVersion) return s
  const replaceable =
    s.status === 'loading' ||
    s.status === 'clean' ||
    s.status === 'saved' ||
    (s.status === 'error' && s.draft === s.baseContent)
  if (replaceable) {
    return {
      ...initialNoteState,
      status: 'clean',
      baseVersion: note.version,
      baseContent: note.content,
      draft: note.content,
    }
  }
  return { ...s, remoteNewer: { version: note.version, updatedBy: note.updatedBy } }
}

function onEdit(s: NoteState, draft: string): NoteState {
  if (s.status === 'loading') return s
  if (s.status === 'conflict' || s.status === 'saving') return { ...s, draft }
  return { ...s, draft, status: draft === s.baseContent ? 'clean' : 'dirty', errorKey: null }
}

export function noteReducer(s: NoteState, a: NoteAction): NoteState {
  switch (a.type) {
    case 'loaded':
      return onLoaded(s, a.note)
    case 'edit':
      return onEdit(s, a.draft)
    case 'saveStarted':
      return { ...s, status: 'saving', savingDraft: s.draft, errorKey: null }
    case 'saveSucceeded':
      return {
        ...s,
        status: s.draft === a.note.content ? 'saved' : 'dirty',
        baseVersion: a.note.version,
        baseContent: a.note.content,
        savingDraft: null,
        remoteNewer: settledRemote(s.remoteNewer, a.note.version),
        errorKey: null,
      }
    case 'saveConflicted':
      return { ...s, status: 'conflict', latest: a.latest, savingDraft: null }
    case 'saveFailed':
      return { ...s, status: 'error', errorKey: a.errorKey, savingDraft: null }
    case 'retry':
      return s.status === 'error' ? { ...s, status: 'dirty', errorKey: null } : s
    case 'remoteUpdated':
      if (a.version <= s.baseVersion) return s
      if (s.remoteNewer && s.remoteNewer.version >= a.version) return s
      return { ...s, remoteNewer: { version: a.version, updatedBy: a.updatedBy } }
    case 'keepMine':
      return s.latest ? rebase(s, s.latest, s.draft) : s
    case 'takeTheirs':
      return s.latest ? rebase(s, s.latest, s.latest.content) : s
    case 'saveMerged':
      return s.latest ? rebase(s, s.latest, a.draft) : s
    default:
      return s
  }
}

export function canAutosave(s: NoteState): boolean {
  return s.status === 'dirty'
}

export function savePayload(s: NoteState): MeetingNoteInput {
  return { content: s.draft, version: s.baseVersion }
}

/** A newer version exists and nothing local would be lost by loading it. */
export function needsRefetch(s: NoteState): boolean {
  return !!s.remoteNewer && (s.status === 'clean' || s.status === 'saved')
}

export function hasUnsavedText(s: NoteState): boolean {
  return s.draft !== s.baseContent || s.status === 'saving' || s.status === 'conflict'
}
