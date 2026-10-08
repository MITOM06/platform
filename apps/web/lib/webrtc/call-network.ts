/** How well one side receives the other's media. Sent to the peer in `call.state`. */
export type ReceiveQuality = 'good' | 'poor'

/** Whose network the call screen blames for a bad connection. */
export type NetworkNotice = 'self' | 'peer' | 'both' | null

/** Cumulative `inbound-rtp` counters for the peer's audio. */
export interface ReceiveSample {
  packetsReceived: number
  packetsLost: number
  /** Seconds. */
  jitter: number
}

const POOR_LOSS = 0.08
const POOR_JITTER_S = 0.08

/** Quality over the window between two samples: loss, jitter, or nothing arriving at all. */
export function receiveQuality(prev: ReceiveSample | null, cur: ReceiveSample): ReceiveQuality {
  if (!prev) return 'good'
  const received = cur.packetsReceived - prev.packetsReceived
  const lost = Math.max(0, cur.packetsLost - prev.packetsLost)
  const total = received + lost
  if (total <= 0) return 'poor'
  return lost / total >= POOR_LOSS || cur.jitter >= POOR_JITTER_S ? 'poor' : 'good'
}

/**
 * Peer-to-peer has no server measuring each side, so each side reports how
 * well it receives the other. Media arriving badly at one end only points at
 * the sender's uplink; both directions bad (or no report from an older app)
 * cannot be pinned on one side.
 */
export function attributeQuality(
  myReceive: ReceiveQuality,
  peerReceive: ReceiveQuality | null,
): { selfPoor: boolean; peerPoor: boolean } {
  if (peerReceive === null) {
    const poor = myReceive === 'poor'
    return { selfPoor: poor, peerPoor: poor }
  }
  return { selfPoor: peerReceive === 'poor', peerPoor: myReceive === 'poor' }
}

export function networkNotice(selfPoor: boolean, peerPoor: boolean): NetworkNotice {
  if (selfPoor && peerPoor) return 'both'
  if (selfPoor) return 'self'
  if (peerPoor) return 'peer'
  return null
}

/** Messenger-style: the call shows video while either camera is on. */
export function showsVideo(localCamera: boolean, peerCamera: boolean): boolean {
  return localCamera || peerCamera
}
