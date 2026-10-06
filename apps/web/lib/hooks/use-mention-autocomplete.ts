'use client'

import { useState, type Dispatch, type KeyboardEvent, type RefObject, type SetStateAction } from 'react'
import { useMentionParticipants } from '@/lib/hooks/use-mention-participants'
import type { Conversation } from '@/lib/api/types'

export interface MentionCandidate {
  id: string
  name: string
}

interface Args {
  conversation?: Conversation
  value: string
  setValue: Dispatch<SetStateAction<string>>
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

/**
 * `@name` autocomplete for the group composer (mirror Flutter mention_list.dart).
 * Extracted from MessageInput.tsx to keep it under the 400-line limit; behaviour
 * is unchanged.
 */
export function useMentionAutocomplete({ conversation, value, setValue, textareaRef }: Args) {
  const participants = useMentionParticipants(conversation)
  const [candidates, setCandidates] = useState<MentionCandidate[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [query, setQuery] = useState<{ start: number; end: number; text: string } | null>(null)

  /** Re-evaluate the popover after the textarea changed. */
  const updateFromInput = (val: string, cursor: number) => {
    const match = val.slice(0, cursor).match(/@([a-zA-Z0-9_]*)$/)
    if (!match || conversation?.type !== 'group') {
      setQuery(null)
      return
    }
    const q = match[1].toLowerCase()
    const next = participants.filter((p) => p.name.toLowerCase().includes(q))
    if (next.length === 0) {
      setQuery(null)
      return
    }
    setCandidates(next)
    setQuery({ start: match.index!, end: cursor, text: q })
    setActiveIndex(0)
  }

  const insert = (candidate: MentionCandidate) => {
    if (!query) return
    const el = textareaRef.current
    const before = value.slice(0, query.start)
    const after = value.slice(query.end)
    const inserted = `@${candidate.name} `
    setValue(before + inserted + after)
    setQuery(null)
    if (el) {
      requestAnimationFrame(() => {
        el.focus()
        el.selectionStart = el.selectionEnd = before.length + inserted.length
      })
    }
  }

  /** Keyboard navigation while the popover is open. Returns true when consumed. */
  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!query) return false
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % candidates.length)
        return true
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + candidates.length) % candidates.length)
        return true
      case 'Enter':
      case 'Tab':
        e.preventDefault()
        insert(candidates[activeIndex])
        return true
      case 'Escape':
        e.preventDefault()
        setQuery(null)
        return true
      default:
        return false
    }
  }

  return {
    isOpen: !!query && candidates.length > 0,
    hasQuery: !!query,
    candidates,
    activeIndex,
    setActiveIndex,
    updateFromInput,
    handleKey,
    insert,
  }
}
