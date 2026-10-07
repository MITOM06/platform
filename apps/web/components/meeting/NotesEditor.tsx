'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MarkdownContent } from '@/components/chat/MarkdownContent'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { MEETING_LIMITS, type NoteScope } from '@/lib/api/meeting-types'
import { useNoteEditor, type NoteEditor } from '@/lib/hooks/use-note-editor'
import { personName } from '@/lib/meetings/display'
import type { RemoteNewer } from '@/lib/meetings/note-sync'
import { cn } from '@/lib/utils'
import { NoteConflictDialog } from './NoteConflictDialog'

interface Props {
  meetingId: string
  canEditShared: boolean
  /** `meet.notes.updated` while in the room; the detail page passes nothing. */
  sharedRemote?: RemoteNewer | null
  /** In the room: receives "save both tabs now" (used when leaving / ending the meeting). */
  onFlushReady?(flush: () => Promise<void>): void
  className?: string
}

type Flush = () => Promise<void>

/** Shared + private meeting notes: Markdown, autosave 2s, conflicts never lose text. */
export function NotesEditor({ meetingId, canEditShared, sharedRemote, onFlushReady, className }: Props) {
  const t = useTranslations('meeting')
  const [tab, setTab] = useState<NoteScope>('shared')
  // Only fetch a tab once it has been opened.
  const [opened, setOpened] = useState<ReadonlySet<NoteScope>>(() => new Set(['shared']))
  const flushes = useRef(new Map<NoteScope, Flush>())
  const registerFlush = useCallback((scope: NoteScope, flush: Flush) => {
    flushes.current.set(scope, flush)
  }, [])
  useEffect(() => {
    onFlushReady?.(async () => {
      await Promise.all([...flushes.current.values()].map((f) => f()))
    })
  }, [onFlushReady])

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        const scope: NoteScope = v === 'private' ? 'private' : 'shared'
        setTab(scope)
        setOpened((s) => (s.has(scope) ? s : new Set([...s, scope])))
      }}
      className={className}
    >
      <TabsList>
        <TabsTrigger value="shared">{t('notesShared')}</TabsTrigger>
        <TabsTrigger value="private">{t('notesPrivate')}</TabsTrigger>
      </TabsList>
      <TabsContent value="shared" forceMount hidden={tab !== 'shared'} className="mt-3">
        <NoteTab meetingId={meetingId} scope="shared" enabled={opened.has('shared')} canEdit={canEditShared} remote={sharedRemote} registerFlush={registerFlush} />
      </TabsContent>
      <TabsContent value="private" forceMount hidden={tab !== 'private'} className="mt-3">
        <NoteTab meetingId={meetingId} scope="private" enabled={opened.has('private')} canEdit registerFlush={registerFlush} />
      </TabsContent>
    </Tabs>
  )
}

function NoteTab({ meetingId, scope, enabled, canEdit, remote, registerFlush }: {
  meetingId: string
  scope: NoteScope
  enabled: boolean
  canEdit: boolean
  remote?: RemoteNewer | null
  registerFlush(scope: NoteScope, flush: Flush): void
}) {
  const t = useTranslations('meeting')
  const editor = useNoteEditor(meetingId, scope, { enabled, canEdit, remote })
  const { flush } = editor
  useEffect(() => registerFlush(scope, flush), [registerFlush, scope, flush])
  const [preview, setPreview] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const { state } = editor
  const label = scope === 'shared' ? t('notesShared') : t('notesPrivate')

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
          {preview ? t('notesWrite') : t('notesPreview')}
        </Button>
        <SaveStatus editor={editor} />
      </div>
      {scope === 'private' ? <p className="text-xs text-muted-foreground">{t('notesPrivateHint')}</p> : null}
      {editor.readOnly ? <p className="text-xs text-muted-foreground">{t('notesReadOnly')}</p> : null}
      {state.remoteNewer && state.status !== 'conflict' && state.status !== 'clean' && state.status !== 'saved' ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs">
          {state.remoteNewer.updatedBy
            ? t('notesRemoteNewer', { name: personName(state.remoteNewer.updatedBy, t('someone')) })
            : t('notesRemoteNewerUnknown')}
        </p>
      ) : null}
      {state.status === 'conflict' ? (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm font-medium">{t('notesConflictTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('notesConflictDesc')}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setReviewing(true)}>
            {t('notesConflictReview')}
          </Button>
        </div>
      ) : null}
      {preview ? (
        <div className="min-h-60 rounded-md border border-border/60 p-3">
          <MarkdownContent content={state.draft} />
        </div>
      ) : (
        <Textarea
          aria-label={label}
          value={state.draft}
          onChange={(e) => editor.edit(e.target.value)}
          readOnly={editor.readOnly}
          disabled={state.status === 'loading'}
          maxLength={MEETING_LIMITS.note}
          placeholder={t('notesPlaceholder')}
          className="min-h-60 resize-y text-base md:text-sm"
        />
      )}
      {state.draft.length > 45_000 ? (
        <p className="text-right text-xs tabular-nums text-muted-foreground">
          {t('notesCounter', { count: state.draft.length, max: MEETING_LIMITS.note })}
        </p>
      ) : null}
      {state.latest ? (
        <NoteConflictDialog
          open={reviewing}
          onOpenChange={setReviewing}
          latest={state.latest}
          draft={state.draft}
          onKeepMine={editor.keepMine}
          onTakeTheirs={editor.takeTheirs}
          onSaveMerged={editor.saveMerged}
        />
      ) : null}
    </div>
  )
}

function SaveStatus({ editor }: { editor: NoteEditor }) {
  const t = useTranslations('meeting')
  const { status, errorKey } = editor.state
  const text =
    status === 'saving'
      ? t('notesSaving')
      : status === 'saved'
        ? t('notesSaved')
        : status === 'dirty' || status === 'conflict'
          ? t('notesUnsaved')
          : status === 'error'
            ? errorKey ? t(errorKey.key, errorKey.values) : t('notesSaveFailed')
            : ''
  return (
    <div className="flex items-center gap-2">
      <span aria-live="polite" className={cn('text-xs', status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
        {text}
      </span>
      {status === 'error' ? (
        <Button type="button" size="sm" variant="outline" onClick={editor.retry}>
          {t('notesRetry')}
        </Button>
      ) : null}
    </div>
  )
}
