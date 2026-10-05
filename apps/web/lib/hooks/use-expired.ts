'use client'

import { useEffect, useState } from 'react'

/** setTimeout overflows past ~24.8 days; longer waits re-arm in steps. */
const MAX_DELAY_MS = 2_000_000_000

/**
 * True once [expires] (epoch ms) has passed; re-renders exactly at that moment
 * (no polling, no `Date.now()` during render). `null` never expires.
 */
export function useExpired(expires: number | null): boolean {
  const [expired, setExpired] = useState(() => expires !== null && Date.now() >= expires)
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (expires === null || expired) return
    const remaining = expires - Date.now()
    const timer = setTimeout(
      () => (remaining <= MAX_DELAY_MS ? setExpired(true) : setStep((s) => s + 1)),
      Math.max(0, Math.min(remaining, MAX_DELAY_MS)),
    )
    return () => clearTimeout(timer)
  }, [expires, expired, step])
  return expired
}
