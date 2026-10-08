'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  /** A stream with the microphone track (the pre-join preview). */
  stream: MediaStream | null
}

/** How often the meter's ARIA value is updated (the bar itself follows every frame). */
const ARIA_EVERY_MS = 250

/**
 * Live microphone level. The bar is driven straight on the DOM from an
 * AnalyserNode in requestAnimationFrame — no React state per frame.
 */
export function MicLevel({ stream }: Props) {
  const t = useTranslations('meeting')
  const meterRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const track = stream?.getAudioTracks()[0]
    const Ctx = typeof window === 'undefined' ? undefined : window.AudioContext
    if (!stream || !track || !Ctx) return
    const ctx = new Ctx()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    let frame = 0
    let lastAria = 0
    const tick = (now: number) => {
      analyser.getByteTimeDomainData(data)
      let peak = 0
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128))
      const level = Math.min(1, (peak / 128) * 2.5)
      if (barRef.current) barRef.current.style.transform = `scaleX(${level})`
      if (meterRef.current && now - lastAria > ARIA_EVERY_MS) {
        lastAria = now
        meterRef.current.setAttribute('aria-valuenow', String(Math.round(level * 100)))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      void ctx.close().catch(() => undefined)
    }
  }, [stream])

  return (
    <div
      ref={meterRef}
      role="meter"
      aria-label={t('micLevel')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/20"
    >
      <div ref={barRef} className="h-full w-full origin-left scale-x-0 rounded-full bg-primary" />
    </div>
  )
}
