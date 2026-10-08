'use client'

import { useEffect } from 'react'

interface LobbyRoom {
  leaveLobbyOnExit(): void
  onRealtimeReconnected(): Promise<void>
}

/**
 * While waiting in the lobby: closing the tab drops the lobby entry (React unmount does not
 * run on unload — the request goes out with keepalive), and a page restored from the
 * back/forward cache asks to join again.
 */
export function useLobbyExit(room: LobbyRoom, waiting: boolean): void {
  useEffect(() => {
    if (!waiting) return
    const onHide = () => room.leaveLobbyOnExit()
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void room.onRealtimeReconnected()
    }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('pageshow', onShow)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('pageshow', onShow)
    }
  }, [room, waiting])
}
