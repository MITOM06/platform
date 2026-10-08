'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMeetingRoomStore, type FloatingReaction } from '@/lib/store/meeting.store'

const FLOAT_MS = 3000
const STILL_MS = 2000
/** Screen readers hear at most one reaction per this many ms. */
const ANNOUNCE_GAP_MS = 2000

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** One emoji rising from the bottom-left (still + fading when motion is reduced). */
function Bubble({ r }: { r: FloatingReaction }) {
  const t = useTranslations('meeting')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof el.animate !== 'function') return
    const anim = reducedMotion()
      ? el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: STILL_MS, fill: 'forwards' })
      : el.animate(
          [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-60vh)', opacity: 0 },
          ],
          { duration: FLOAT_MS, easing: 'ease-out', fill: 'forwards' },
        )
    return () => anim.cancel()
  }, [])
  const name = r.mine ? t('you') : (r.name ?? t('participantFallback'))
  return (
    <div
      ref={ref}
      className="absolute bottom-4 flex flex-col items-center gap-1"
      style={{ left: `${16 + ((r.id * 37) % 96)}px` }}
    >
      <span className="text-3xl leading-none">{r.emoji}</span>
      <span className="max-w-28 truncate rounded-md bg-black/55 px-1.5 py-0.5 text-xs text-white">{name}</span>
    </div>
  )
}

/** Polite announcement of others' reactions, throttled so a burst doesn't flood the reader. */
function ReactionAnnouncer() {
  const t = useTranslations('meeting')
  const [text, setText] = useState('')
  const lastAt = useRef(0)
  useEffect(
    () =>
      useMeetingRoomStore.subscribe((s, prev) => {
        if (s.reactions === prev.reactions) return
        const newest = s.reactions.at(-1)
        if (!newest || newest.mine || prev.reactions.some((r) => r.id === newest.id)) return
        const now = Date.now()
        if (now - lastAt.current < ANNOUNCE_GAP_MS) return
        lastAt.current = now
        setText(t('reactionAria', { name: newest.name ?? t('participantFallback'), emoji: newest.emoji }))
      }),
    [t],
  )
  return (
    <div aria-live="polite" className="sr-only">
      {text}
    </div>
  )
}

/** Reactions floating over the stage (never catches clicks). */
export function ReactionOverlay() {
  const reactions = useMeetingRoomStore((s) => s.reactions)
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {reactions.map((r) => (
        <Bubble key={r.id} r={r} />
      ))}
      <ReactionAnnouncer />
    </div>
  )
}
