import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack,
  type TrackPublication,
} from 'livekit-client'

/** One other person in the room, as the call UI needs them. */
export interface RemotePeer {
  identity: string
  /** Display name from the token; '' when unknown — never the raw identity. */
  name: string
  stream: MediaStream
  speaking: boolean
  micMuted: boolean
  camMuted: boolean
  poorConnection: boolean
}

/** The browser refused (or has no) microphone/camera. Maps to `media_error`. */
export class MediaAccessError extends Error {
  constructor() {
    super('media access refused')
  }
}

/** Could not reach or join the room. Maps to `failed`. */
export class RoomConnectError extends Error {
  constructor() {
    super('room connection failed')
  }
}

const MEDIA_ERRORS = new Set([
  'NotAllowedError',
  'NotFoundError',
  'NotReadableError',
  'OverconstrainedError',
  'SecurityError',
])

/**
 * A thin, UI-agnostic wrapper over a LiveKit `Room`, shared by calls and
 * meetings. It turns LiveKit's participant/track events into plain
 * `MediaStream`s per person, so existing call components keep working with
 * `<video srcObject>` and never see LiveKit types or error text.
 */
export class LiveKitSession {
  onLocalStream: ((s: MediaStream) => void) | null = null
  onPeersChanged: ((peers: RemotePeer[]) => void) | null = null
  onReconnecting: ((reconnecting: boolean) => void) | null = null
  onLocalPoorConnection: ((poor: boolean) => void) | null = null
  /** Fired only when the room drops on its own — never after `disconnect()`. */
  onDisconnected: ((reason: 'failed') => void) | null = null

  private room: Room | null = null
  private leaving = false
  private local: MediaStream | null = null
  private remote = new Map<string, RemotePeer>()

  async connect(url: string, token: string, opts: { video: boolean }): Promise<void> {
    const room = new Room({ adaptiveStream: true, dynacast: true })
    this.room = room
    this.leaving = false
    this.wire(room)
    try {
      await room.connect(url, token)
    } catch {
      this.leaving = true
      this.room = null
      throw new RoomConnectError()
    }
    try {
      await room.localParticipant.setMicrophoneEnabled(true)
      if (opts.video) await room.localParticipant.setCameraEnabled(true)
    } catch (err) {
      const name = (err as { name?: unknown } | null)?.name
      this.disconnect()
      if (typeof name === 'string' && MEDIA_ERRORS.has(name)) throw new MediaAccessError()
      throw new RoomConnectError()
    }
    room.remoteParticipants.forEach((p) => this.ensurePeer(p))
    this.refreshLocal()
    this.emitPeers()
  }

  localStream(): MediaStream | null {
    return this.local
  }

  peer(identity: string): RemotePeer | undefined {
    return this.remote.get(identity)
  }

  peers(): RemotePeer[] {
    return Array.from(this.remote.values())
  }

  async setMic(on: boolean): Promise<void> {
    await this.room?.localParticipant.setMicrophoneEnabled(on)
    this.refreshLocal()
  }

  async setCamera(on: boolean): Promise<void> {
    await this.room?.localParticipant.setCameraEnabled(on)
    this.refreshLocal()
  }

  disconnect(): void {
    const room = this.room
    this.leaving = true
    this.room = null
    this.remote.clear()
    this.local = null
    void room?.disconnect()
  }

  private wire(room: Room): void {
    room
      .on(RoomEvent.ParticipantConnected, (p: Participant) => {
        this.ensurePeer(p)
        this.emitPeers()
      })
      .on(RoomEvent.ParticipantDisconnected, (p: Participant) => {
        this.remote.delete(p.identity)
        this.emitPeers()
      })
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: TrackPublication, p: Participant) => {
        const peer = this.ensurePeer(p)
        peer.stream.addTrack(track.mediaStreamTrack)
        this.setMuted(peer, pub, false)
        this.emitPeers()
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub: TrackPublication, p: Participant) => {
        this.remote.get(p.identity)?.stream.removeTrack(track.mediaStreamTrack)
        this.emitPeers()
      })
      .on(RoomEvent.TrackMuted, (pub: TrackPublication, p: Participant) => this.onMute(pub, p, true))
      .on(RoomEvent.TrackUnmuted, (pub: TrackPublication, p: Participant) => this.onMute(pub, p, false))
      .on(RoomEvent.LocalTrackPublished, () => this.refreshLocal())
      .on(RoomEvent.LocalTrackUnpublished, () => this.refreshLocal())
      .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const ids = new Set(speakers.map((s) => s.identity))
        this.remote.forEach((peer) => (peer.speaking = ids.has(peer.identity)))
        this.emitPeers()
      })
      .on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, p: Participant) => {
        const poor = quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost
        if (p.isLocal) {
          this.onLocalPoorConnection?.(poor)
          return
        }
        const peer = this.remote.get(p.identity)
        if (peer) {
          peer.poorConnection = poor
          this.emitPeers()
        }
      })
      .on(RoomEvent.Reconnecting, () => this.onReconnecting?.(true))
      .on(RoomEvent.Reconnected, () => this.onReconnecting?.(false))
      .on(RoomEvent.Disconnected, () => {
        if (this.leaving) return
        this.leaving = true
        this.room = null
        this.onDisconnected?.('failed')
      })
  }

  private onMute(pub: TrackPublication, p: Participant, muted: boolean): void {
    const peer = this.remote.get(p.identity)
    if (!peer) return
    this.setMuted(peer, pub, muted)
    this.emitPeers()
  }

  private setMuted(peer: RemotePeer, pub: TrackPublication, muted: boolean): void {
    if (pub.source === Track.Source.Microphone) peer.micMuted = muted
    if (pub.source === Track.Source.Camera) peer.camMuted = muted
  }

  private ensurePeer(p: Participant): RemotePeer {
    let peer = this.remote.get(p.identity)
    if (!peer) {
      peer = {
        identity: p.identity,
        name: p.name ?? '',
        stream: new MediaStream(),
        speaking: false,
        micMuted: false,
        camMuted: false,
        poorConnection: false,
      }
      this.remote.set(p.identity, peer)
    }
    return peer
  }

  private refreshLocal(): void {
    const lp = this.room?.localParticipant
    if (!lp) return
    const tracks = [Track.Source.Microphone, Track.Source.Camera]
      .map((source) => lp.getTrackPublication(source)?.track?.mediaStreamTrack)
      .filter((t): t is MediaStreamTrack => !!t)
    this.local = new MediaStream(tracks)
    this.onLocalStream?.(this.local)
  }

  private emitPeers(): void {
    this.onPeersChanged?.(this.peers())
  }
}
