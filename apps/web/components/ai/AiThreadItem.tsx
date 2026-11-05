'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Conversation } from '@/lib/api/types'

interface Props {
  thread: Conversation
  active: boolean
  /** Resolves when the rename succeeded (editor closes), rejects/returns false to stay open. */
  onRename: (id: string, name: string) => Promise<boolean>
  onDelete: (thread: Conversation) => void
}

export function AiThreadItem({ thread, active, onRename, onDelete }: Props) {
  const t = useTranslations('aiThreads')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const title = thread.name?.trim() || t('untitled')

  const startEdit = () => {
    setDraft(thread.name ?? '')
    setEditing(true)
  }
  const save = async () => {
    const name = draft.trim()
    if (name === (thread.name ?? '')) return setEditing(false)
    if (await onRename(thread.id, name)) setEditing(false)
  }

  if (editing) {
    return (
      <div data-testid="ai-thread-row" className="flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1.5">
        <input
          autoFocus
          value={draft}
          maxLength={80}
          aria-label={t('rename')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
            else if (e.key === 'Escape') setEditing(false)
          }}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        />
        <button type="button" aria-label={t('save')} onClick={() => void save()}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <Check className="size-4" />
        </button>
        <button type="button" aria-label={t('cancel')} onClick={() => setEditing(false)}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      data-testid="ai-thread-row"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-1 rounded-lg px-2 transition-colors',
        active ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/70',
      )}
    >
      <Link
        href={`/conversations/${thread.id}`}
        className={cn('min-w-0 flex-1 truncate py-2.5 text-sm', active && 'font-semibold')}
        title={title}
      >
        {title}
      </Link>
      {/* Touch has no hover: always visible below md, hover/focus-revealed on desktop. */}
      <div className="flex shrink-0 items-center md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <button type="button" aria-label={t('rename')} onClick={startEdit}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <Pencil className="size-3.5" />
        </button>
        <button type="button" aria-label={t('delete')} onClick={() => onDelete(thread)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
