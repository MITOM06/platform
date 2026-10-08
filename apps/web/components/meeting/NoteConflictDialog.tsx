'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Textarea } from '@/components/ui/textarea'
import type { MeetingNote } from '@/lib/api/meeting-types'
import { personName } from '@/lib/meetings/display'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The newer version someone else saved. */
  latest: MeetingNote
  /** The text being typed — shown editable so it can be merged by hand. */
  draft: string
  onKeepMine: () => void
  onTakeTheirs: () => void
  onSaveMerged: (text: string) => void
}

/** Compare the newer version with mine; keep mine, take theirs, or save a hand-merged text. */
export function NoteConflictDialog(props: Props) {
  const t = useTranslations('meeting')
  return (
    <ResponsiveModal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('notesConflictTitle')}
      description={t('notesConflictDesc')}
      desktopClassName="sm:max-w-3xl"
    >
      {/* Mounted only while open, so the merge box starts from the current draft each time. */}
      {props.open ? <ConflictBody {...props} /> : null}
    </ResponsiveModal>
  )
}

function ConflictBody({ latest, draft, onOpenChange, onKeepMine, onTakeTheirs, onSaveMerged }: Props) {
  const t = useTranslations('meeting')
  const mineId = useId()
  const [merged, setMerged] = useState(draft)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const close = () => onOpenChange(false)
  const author = latest.updatedBy ? personName(latest.updatedBy, t('someone')) : null

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-1.5">
          <h3 className="text-sm font-medium">
            {t('notesConflictTheirs')}
            {author ? <span className="ml-1 font-normal text-muted-foreground">· {author}</span> : null}
          </h3>
          <pre className="max-h-72 min-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/40 p-3 font-sans text-sm">
            {latest.content}
          </pre>
        </section>
        <section className="space-y-1.5">
          <label htmlFor={mineId} className="text-sm font-medium">
            {t('notesConflictMine')}
          </label>
          <Textarea
            id={mineId}
            value={merged}
            onChange={(e) => setMerged(e.target.value)}
            className="max-h-72 min-h-40 text-base md:text-sm"
          />
        </section>
      </div>
      {confirmDiscard ? (
        <p role="status" className="text-xs text-destructive">
          {t('notesConflictDiscardWarning')}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (!confirmDiscard) {
              setConfirmDiscard(true)
              return
            }
            onTakeTheirs()
            close()
          }}
        >
          {t('notesConflictTakeTheirs')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onKeepMine()
            close()
          }}
        >
          {t('notesConflictKeepMine')}
        </Button>
        <Button
          type="button"
          onClick={() => {
            onSaveMerged(merged)
            close()
          }}
        >
          {t('notesConflictSaveMerged')}
        </Button>
      </div>
    </div>
  )
}
