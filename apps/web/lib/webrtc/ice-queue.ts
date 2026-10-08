/**
 * ICE candidates a 1-on-1 peer connection cannot take yet, applied once the
 * offer/answer is in:
 * - early: trickled by a caller right after its offer, while we are still
 *   ringing and have no connection — kept only from that caller. Dropping them
 *   made calls across NATs connect without audio;
 * - pending: arrived before the remote description was set.
 */
export class IceQueue {
  private expectingFrom: string | null = null
  private early: RTCIceCandidateInit[] = []
  private pending: RTCIceCandidateInit[] = []
  private remoteSet = false

  /** A call from `from` is ringing (or crossed ours): keep its candidates. */
  expect(from: string): void {
    this.expectingFrom = from
    this.early = []
  }

  /** A connection to `peerId` now exists: its early candidates wait for the remote description. */
  attach(peerId: string): void {
    this.remoteSet = false
    this.pending = this.expectingFrom === peerId ? [...this.early] : []
    this.expectingFrom = null
    this.early = []
  }

  /** Route a remote candidate; `pc` is null while we have no connection yet. */
  async add(pc: RTCPeerConnection | null, candidate: RTCIceCandidateInit, from?: string): Promise<void> {
    if (!pc) {
      if (from && from === this.expectingFrom) this.early.push(candidate)
      return
    }
    if (!this.remoteSet) {
      this.pending.push(candidate)
      return
    }
    await pc.addIceCandidate(candidate)
  }

  /** The remote description is in: apply what waited, skipping malformed late candidates. */
  async flush(pc: RTCPeerConnection | null): Promise<void> {
    this.remoteSet = true
    const ready = this.pending
    this.pending = []
    for (const c of ready) {
      try {
        await pc?.addIceCandidate(c)
      } catch {
        // ignore malformed late candidates
      }
    }
  }

  reset(): void {
    this.expectingFrom = null
    this.early = []
    this.pending = []
    this.remoteSet = false
  }
}
