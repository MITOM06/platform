'use client'

import type { MouseEvent } from 'react'
import { REACTION_EMOJIS, type ReactionEmoji } from '@/lib/api/meeting-types'
import { useRoom } from './room-context'

const NUDGE: Keyframe[] = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-3px)' },
  { transform: 'translateX(3px)' },
  { transform: 'translateX(0)' },
]

/** The six reactions. Too fast (more than one a second) ⇒ the button nudges, nothing is sent. */
export function ReactionPicker() {
  const { controller } = useRoom()
  const send = (emoji: ReactionEmoji, e: MouseEvent<HTMLButtonElement>) => {
    if (controller.sendReaction(emoji)) return
    const el = e.currentTarget
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!calm && typeof el.animate === 'function') el.animate(NUDGE, { duration: 240 })
  }
  return (
    <div className="flex gap-1">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={emoji}
          onClick={(e) => send(emoji, e)}
          className="flex size-11 items-center justify-center rounded-full text-2xl hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
