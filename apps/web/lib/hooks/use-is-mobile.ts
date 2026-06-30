'use client'

import { useEffect, useState } from 'react'

const MOBILE_QUERY = '(max-width: 767px)' // < md (768px)

/** True when the viewport is narrower than the `md` breakpoint. SSR-safe. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return isMobile
}
