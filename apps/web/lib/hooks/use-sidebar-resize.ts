'use client'

import { useEffect, useRef } from 'react'
import { useUiStore, SIDEBAR_MIN_WIDTH } from '@/lib/store/ui.store'

// ── Resizable sidebar (desktop only) ──────────────────────────────────────
// Width lives in the UI store (single source of truth shared with the
// ConversationHeader collapse toggle) and is applied via a CSS variable so
// mobile stays full-width (`w-full`) and only `md:w-[var(--sidebar-w)]` picks
// up the dynamic value.
//
// Extracted from app/(main)/layout.tsx to keep that file under the 400-line
// limit; behaviour is identical to the inline version.
export function useSidebarResize(): {
  sidebarWidth: number
  handleDragStart: (e: React.MouseEvent) => void
} {
  const sidebarWidth = useUiStore((s) => s.sidebarWidth)
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  // Restore persisted width on mount (post-hydration — localStorage/window are
  // unavailable during SSR). `persist: false` so we don't rewrite what we read.
  useEffect(() => {
    const stored = localStorage.getItem('pon-sidebar-width')
    if (stored) {
      const w = parseInt(stored, 10)
      if (!isNaN(w) && w >= SIDEBAR_MIN_WIDTH && w <= window.innerWidth * 0.8) {
        setSidebarWidth(w, false)
      }
    }
  }, [setSidebarWidth])

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = useUiStore.getState().sidebarWidth

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const delta = ev.clientX - dragStartX.current
      const next = Math.min(
        Math.max(dragStartWidth.current + delta, SIDEBAR_MIN_WIDTH),
        window.innerWidth * 0.8,
      )
      // Live update without persisting on every frame.
      setSidebarWidth(next, false)
    }
    const onUp = () => {
      isDragging.current = false
      // Persist the final width once, on release.
      setSidebarWidth(useUiStore.getState().sidebarWidth, true)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return { sidebarWidth, handleDragStart }
}
