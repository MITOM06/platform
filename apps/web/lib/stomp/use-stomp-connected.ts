'use client'

import { useEffect, useState } from 'react'
import { stompService } from './client'

/**
 * Subscribe to the singleton STOMP connection state. Returns `true` while the
 * socket is connected. Effects that set up `stompService.subscribe(...)` should
 * depend on this value so they re-run — and therefore re-subscribe — after a
 * reconnect, instead of holding a subscription bound to a dead socket.
 */
export function useStompConnected(): boolean {
  const [connected, setConnected] = useState(() => stompService.isConnected())
  useEffect(() => stompService.onStateChange(setConnected), [])
  return connected
}
