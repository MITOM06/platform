'use client'

import { useEffect, useState } from 'react'

// Per-conversation quick reaction is stored client-side (mirrors Flutter's
// shared_preferences `chat_quick_reaction_<convId>`, default '👍') and synced
// across participants via `system.quick_reaction.changed:<emoji>` system
// messages. No backend field is involved — same pattern as nicknames/wallpaper.

const QUICK_REACTION_PREFIX = 'system.quick_reaction.changed:'
export const QUICK_REACTION_EVENT = 'quick-reaction-changed'
export const DEFAULT_QUICK_REACTION = '👍'

const key = (convId: string) => `chat_quick_reaction_${convId}`

export function getQuickReaction(convId: string): string {
  if (typeof window === 'undefined') return DEFAULT_QUICK_REACTION
  return localStorage.getItem(key(convId)) || DEFAULT_QUICK_REACTION
}

function writeQuickReaction(convId: string, emoji: string) {
  const value = emoji.trim() || DEFAULT_QUICK_REACTION
  localStorage.setItem(key(convId), value)
  window.dispatchEvent(new Event(QUICK_REACTION_EVENT))
}

/** Set locally (the caller is responsible for broadcasting the system message). */
export function setQuickReaction(convId: string, emoji: string) {
  writeQuickReaction(convId, emoji)
}

/** Build the system-message payload broadcast to all participants. */
export function quickReactionSystemMessage(emoji: string): string {
  return `${QUICK_REACTION_PREFIX}${emoji}`
}

/** Apply an incoming/historical `system.quick_reaction.changed:` system message. */
export function applyQuickReactionSystemMessage(convId: string, content: string): void {
  if (!content.startsWith(QUICK_REACTION_PREFIX)) return
  // Emoji has no ':' — everything after the first ':' is the emoji.
  const emoji = content.slice(QUICK_REACTION_PREFIX.length)
  if (emoji) writeQuickReaction(convId, emoji)
}

/** Reactive read of a conversation's quick reaction. */
export function useQuickReaction(convId: string): string {
  const [emoji, setEmoji] = useState<string>(DEFAULT_QUICK_REACTION)
  useEffect(() => {
    const update = () => setEmoji(getQuickReaction(convId))
    update()
    window.addEventListener(QUICK_REACTION_EVENT, update)
    return () => window.removeEventListener(QUICK_REACTION_EVENT, update)
  }, [convId])
  return emoji
}
