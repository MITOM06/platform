'use client'

import { useCallback, useEffect } from 'react'
import { canEditSharedNote } from '@/lib/meetings/permissions'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { NotesEditor } from '../NotesEditor'
import { useRoom } from './room-context'

/**
 * Meeting notes in the room. Edit rights follow my CURRENT room role and the live
 * `attendeesCanEditNotes` setting; `meet.notes.updated` arrives via the store.
 * Closing the panel saves on unmount (useNoteEditor); leaving / ending the meeting
 * saves through the flush registered with the controller.
 */
export function NotesPanel() {
  const { meeting, controller } = useRoom()
  const myRole = useMeetingRoomStore((s) => s.myRole)
  const sharedRemote = useMeetingRoomStore((s) => s.sharedNoteRemote)
  const register = useCallback((flush: () => Promise<void>) => controller.registerNotesFlush(flush), [controller])
  useEffect(() => () => controller.registerNotesFlush(null), [controller])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <NotesEditor
        meetingId={meeting.id}
        canEditShared={canEditSharedNote(myRole, meeting.settings)}
        sharedRemote={sharedRemote}
        onFlushReady={register}
      />
    </div>
  )
}
