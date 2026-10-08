import { describe, it, expect } from 'vitest'
import type { MeetingNote } from '@/lib/api/meeting-types'
import {
  canAutosave, hasUnsavedText, initialNoteState, needsRefetch, noteReducer, savePayload,
  type NoteAction, type NoteState,
} from '@/lib/meetings/note-sync'

const note = (content: string, version: number, by = 'Minh'): MeetingNote =>
  ({ scope: 'shared', content, version, updatedBy: { userId: 'u2', displayName: by }, updatedAt: 't' })
const run = (...actions: NoteAction[]): NoteState => actions.reduce(noteReducer, initialNoteState)

describe('noteReducer', () => {
  it('loads a note as clean', () => {
    const s = run({ type: 'loaded', note: note('base', 1) })
    expect(s).toMatchObject({ status: 'clean', baseVersion: 1, baseContent: 'base', draft: 'base' })
    expect(canAutosave(s)).toBe(false)
  })

  it('becomes dirty on edit and clean again when the edit is undone', () => {
    const dirty = run({ type: 'loaded', note: note('base', 1) }, { type: 'edit', draft: 'base!' })
    expect(dirty.status).toBe('dirty')
    expect(canAutosave(dirty)).toBe(true)
    expect(savePayload(dirty)).toEqual({ content: 'base!', version: 1 })
    expect(noteReducer(dirty, { type: 'edit', draft: 'base' }).status).toBe('clean')
  })

  it('keeps typing that happens while a save is in flight', () => {
    const s = run(
      { type: 'loaded', note: note('a', 1) },
      { type: 'edit', draft: 'ab' },
      { type: 'saveStarted' },
      { type: 'edit', draft: 'abc' },
      { type: 'saveSucceeded', note: note('ab', 2) },
    )
    expect(s).toMatchObject({ status: 'dirty', baseVersion: 2, baseContent: 'ab', draft: 'abc' })
    expect(savePayload(s)).toEqual({ content: 'abc', version: 2 })
  })

  it('marks a save as saved when nothing changed meanwhile', () => {
    const s = run({ type: 'loaded', note: note('a', 1) }, { type: 'edit', draft: 'ab' }, { type: 'saveStarted' },
      { type: 'saveSucceeded', note: note('ab', 2) })
    expect(s).toMatchObject({ status: 'saved', baseVersion: 2, draft: 'ab' })
    // the query cache echoes the saved note back — nothing changes (still "Saved")
    expect(noteReducer(s, { type: 'loaded', note: note('ab', 2) })).toBe(s)
  })

  describe('409 conflict', () => {
    const conflicted = run(
      { type: 'loaded', note: note('base', 1) },
      { type: 'edit', draft: 'base + mine' },
      { type: 'saveStarted' },
      { type: 'saveConflicted', latest: note('base + theirs', 2) },
    )

    it('never loses the text being typed', () => {
      expect(conflicted).toMatchObject({ status: 'conflict', draft: 'base + mine', baseVersion: 1 })
      expect(conflicted.latest?.content).toBe('base + theirs')
      expect(canAutosave(conflicted)).toBe(false)
      expect(hasUnsavedText(conflicted)).toBe(true)
      const typing = noteReducer(conflicted, { type: 'edit', draft: 'base + mine!' })
      expect(typing).toMatchObject({ status: 'conflict', draft: 'base + mine!' })
    })

    it('"keep mine" rebases the draft on the newer version so the next save overwrites it', () => {
      const s = noteReducer(conflicted, { type: 'keepMine' })
      expect(s).toMatchObject({ status: 'dirty', baseVersion: 2, baseContent: 'base + theirs', draft: 'base + mine', latest: null })
      expect(savePayload(s)).toEqual({ content: 'base + mine', version: 2 })
    })

    it('"use newer version" adopts their text', () => {
      const s = noteReducer(conflicted, { type: 'takeTheirs' })
      expect(s).toMatchObject({ status: 'clean', baseVersion: 2, draft: 'base + theirs', latest: null })
    })

    it('"save merged" saves the merged text on top of the newer version', () => {
      const s = noteReducer(conflicted, { type: 'saveMerged', draft: 'base + theirs + mine' })
      expect(s).toMatchObject({ status: 'dirty', baseVersion: 2, draft: 'base + theirs + mine' })
      expect(savePayload(s)).toEqual({ content: 'base + theirs + mine', version: 2 })
    })

    it('a reload during the conflict does not touch the draft', () => {
      const s = noteReducer(conflicted, { type: 'loaded', note: note('base + theirs + more', 3) })
      expect(s).toMatchObject({ status: 'conflict', draft: 'base + mine' })
      expect(s.remoteNewer).toEqual({ version: 3, updatedBy: { userId: 'u2', displayName: 'Minh' } })
    })
  })

  describe('remote updates (meet.notes.updated)', () => {
    it('asks a clean editor to refetch, then applies the new version', () => {
      const s = run({ type: 'loaded', note: note('a', 1) }, { type: 'remoteUpdated', version: 2 })
      expect(needsRefetch(s)).toBe(true)
      const after = noteReducer(s, { type: 'loaded', note: note('a+b', 2) })
      expect(after).toMatchObject({ status: 'clean', draft: 'a+b', baseVersion: 2, remoteNewer: null })
      expect(needsRefetch(after)).toBe(false)
    })

    it('only flags a dirty editor — its text stays', () => {
      const s = run({ type: 'loaded', note: note('a', 1) }, { type: 'edit', draft: 'mine' },
        { type: 'remoteUpdated', version: 2, updatedBy: { userId: 'u2', displayName: 'Minh' } })
      expect(s).toMatchObject({ status: 'dirty', draft: 'mine' })
      expect(s.remoteNewer?.updatedBy?.displayName).toBe('Minh')
      expect(needsRefetch(s)).toBe(false)
      expect(noteReducer(s, { type: 'loaded', note: note('theirs', 2) }).draft).toBe('mine')
    })

    it('ignores its own echo and older versions', () => {
      const s = run({ type: 'loaded', note: note('a', 3) })
      expect(noteReducer(s, { type: 'remoteUpdated', version: 3 })).toBe(s)
      expect(noteReducer(s, { type: 'remoteUpdated', version: 2 })).toBe(s)
    })
  })

  it('a failed save keeps the text and can be retried', () => {
    const failed = run({ type: 'loaded', note: note('a', 1) }, { type: 'edit', draft: 'ab' }, { type: 'saveStarted' },
      { type: 'saveFailed', errorKey: { key: 'errNetwork' } })
    expect(failed).toMatchObject({ status: 'error', draft: 'ab', errorKey: { key: 'errNetwork' } })
    expect(canAutosave(failed)).toBe(false)
    expect(noteReducer(failed, { type: 'retry' }).status).toBe('dirty')
    expect(noteReducer(failed, { type: 'edit', draft: 'abc' })).toMatchObject({ status: 'dirty', errorKey: null })
  })
})
