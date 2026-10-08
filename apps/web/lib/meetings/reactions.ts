import { REACTION_EMOJIS, type ReactionEmoji } from '@/lib/api/meeting-types'

/**
 * Reactions travel peer-to-peer over the LiveKit data channel (lossy), never
 * through the server. Anything a peer sends is untrusted: only the six emoji
 * are accepted, in an exact `{"e":"…"}` envelope.
 */

export const REACTION_TOPIC = 'reaction'
const MAX_BYTES = 64
const ALLOWED: ReadonlySet<string> = new Set<string>(REACTION_EMOJIS)

export function encodeReaction(e: ReactionEmoji): Uint8Array {
  // Copy into this realm's Uint8Array (TextEncoder may hand back another realm's in tests/workers).
  return Uint8Array.from(new TextEncoder().encode(JSON.stringify({ e })))
}

export function decodeReaction(payload: Uint8Array): ReactionEmoji | null {
  if (payload.byteLength > MAX_BYTES) return null
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(payload))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const keys = Object.keys(parsed)
    if (keys.length !== 1 || keys[0] !== 'e') return null
    const e = (parsed as { e: unknown }).e
    return typeof e === 'string' && ALLOWED.has(e) ? (e as ReactionEmoji) : null
  } catch {
    return null
  }
}

/** `allow(now)` is true at most once per `intervalMs`. */
export function createReactionThrottle(intervalMs = 1000): (nowMs: number) => boolean {
  let last = Number.NEGATIVE_INFINITY
  return (nowMs) => {
    if (nowMs - last < intervalMs) return false
    last = nowMs
    return true
  }
}
