import { callsApi } from '@/lib/api/calls'
import type { CallTransport } from '@/lib/api/types'

/**
 * Which media path a NEW outgoing call takes. Incoming calls carry their own
 * `transport` on the ring. Read synchronously when the user taps Call, so it
 * is refreshed in the background whenever the realtime connection comes up.
 * Anything unexpected falls back to mesh — the path that needs no server.
 */
let transport: CallTransport = 'mesh'

export function getCallTransport(): CallTransport {
  return transport
}

export async function refreshCallTransport(): Promise<void> {
  try {
    const config = await callsApi.getConfig()
    transport = config.transport === 'sfu' ? 'sfu' : 'mesh'
  } catch {
    transport = 'mesh'
  }
}

/** Test-only: forget the cached value. */
export function resetCallTransportForTest(): void {
  transport = 'mesh'
}
