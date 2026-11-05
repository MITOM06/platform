'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'

/**
 * Permanent "AI is taking notes" chip while the switch is on, plus a one-time
 * toast when it flips on mid-meeting (not when the room opens already on).
 */
export function AiNotesIndicator({ active }: { active: boolean }) {
  const t = useTranslations('meeting')
  const prev = useRef(active)
  useEffect(() => {
    const was = prev.current
    prev.current = active
    if (active && !was) toast.info(t('aiNotesStarted'))
  }, [active, t])

  if (!active) return null
  return (
    <p role="status" className="flex w-fit items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white">
      <Sparkles className="size-3.5" aria-hidden />
      <span>{t('aiNotesActive')}</span>
    </p>
  )
}
