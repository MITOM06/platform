import {
  ConnectionQuality,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RoomOptions,
  type TrackPublication,
} from 'livekit-client'
import {
  MEDIA_ERRORS,
  MediaAccessError,
  RoomConnectError,
  SHARE_REFUSED,
  ScreenShareError,
  errorName,
} from './livekit-errors'

export { MediaAccessError, RoomConnectError, ScreenShareError }

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
  /** From participant metadata {"avatarUrl"}; absent when none / malformed. */
  avatarUrl?: string
  /** Screen share (+ its audio) — never mixed into `stream`. */
  screen: MediaStream | null
}

export interface ConnectOptions {
  video: boolean
  /** Default true — calls keep publishing the mic on connect. */
  audio?: boolean
  audioDeviceId?: string
  videoDeviceId?: string
}

/** What this device is currently publishing. */
export interface LocalMediaState {
  mic: boolean
  camera: boolean
  screen: boolean
}

const SCREEN_SOURCES = new Set<string>([Track.Source.ScreenShare, Track.Source.ScreenShareAudio])

function avatarFromMetadata(metadata: string | undefined): string | undefined {
  if (!metadata) return undefined
  try {
    const parsed: unknown = JSON.parse(metadata)
    const url = (parsed as { avatarUrl?: unknown } | null)?.avatarUrl
    return typeof url === 'string' && url ? url : undefined
  } catch {
    return undefined
  }
}

/** Best-effort: stop (or resume) receiving one remote publication. */
function setPubEnabled(pub: RemoteTrackPublication | undefined, enabled: boolean): void {
  try {
    pub?.setEnabled(enabled)
  } catch {
    // best-effort
  }
}

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
  /**
   * Fired only when the room goes away on its own — never after `disconnect()`.
   * 'ended' = the server closed the room or removed us (the call is over);
   * 'failed' = the connection dropped and could not be resumed.
   */
  onDisconnected: ((reason: 'failed' | 'ended') => void) | null = null
  /** My mic/camera/screen changed outside my own toggle (server mute, browser "Stop sharing"). */
  onLocalMediaChanged: ((state: LocalMediaState) => void) | null = null
  onData: ((topic: string, payload: Uint8Array, fromIdentity: string | null) => void) | null = null

  private room: Room | null = null
  private leaving = false
  private local: MediaStream | null = null
  private localScreen: MediaStream | null = null
  private remote = new Map<string, RemotePeer>()
  /** Peers whose camera we do not want (hidden tiles) — re-applied to every new camera publication. */
  private videoOff = new Set<string>()

  async connect(url: string, token: string, opts: ConnectOptions): Promise<void> {
    // No adaptiveStream: it only works with track.attach(), and our call UI
    // feeds plain MediaStreams into its own <video> — with it on, remote video
    // is paused as "not visible" and never starts.
    const options: RoomOptions = { adaptiveStream: false, dynacast: true }
    if (opts.audioDeviceId) options.audioCaptureDefaults = { deviceId: opts.audioDeviceId }
    if (opts.videoDeviceId) options.videoCaptureDefaults = { deviceId: opts.videoDeviceId }
    const room = new Room(options)
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
      if (opts.audio !== false) await room.localParticipant.setMicrophoneEnabled(true)
      if (opts.video) await room.localParticipant.setCameraEnabled(true)
    } catch (err) {
      const name = errorName(err)
      this.disconnect()
      if (name && MEDIA_ERRORS.has(name)) throw new MediaAccessError()
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

  /** My own screen share (+ its audio), or null when not presenting. */
  localScreenStream(): MediaStream | null {
    return this.localScreen
  }

  localMedia(): LocalMediaState {
    const lp = this.room?.localParticipant
    if (!lp) return { mic: false, camera: false, screen: false }
    return { mic: lp.isMicrophoneEnabled, camera: lp.isCameraEnabled, screen: lp.isScreenShareEnabled }
  }

  /** Throws `ScreenShareError` when the user cancels the picker; a plain Error otherwise. */
  async setScreenShare(on: boolean): Promise<void> {
    const lp = this.room?.localParticipant
    if (!lp) return
    try {
      await lp.setScreenShareEnabled(on, { audio: true })
    } catch (err) {
      const name = errorName(err)
      if (name && SHARE_REFUSED.has(name)) throw new ScreenShareError()
      throw new Error('screen share failed')
    } finally {
      this.refreshLocal()
      this.emitLocalMedia()
    }
  }

  async switchDevice(kind: 'audioinput' | 'videoinput', deviceId: string): Promise<void> {
    await this.room?.switchActiveDevice(kind, deviceId)
    this.refreshLocal()
  }

  /** Best-effort: never throws (reactions and other ephemeral signals). */
  publishData(topic: string, payload: Uint8Array, reliable: boolean): void {
    const lp = this.room?.localParticipant
    if (!lp) return
    try {
      void lp.publishData(new Uint8Array(payload), { reliable, topic }).catch(() => undefined)
    } catch {
      // ignore — the room is closing
    }
  }

  /** Stop (or resume) receiving a peer's camera, e.g. while their tile is hidden. */
  setPeerVideoEnabled(identity: string, enabled: boolean): void {
    if (enabled) this.videoOff.delete(identity)
    else this.videoOff.add(identity)
    const pub = this.room?.remoteParticipants.get(identity)?.getTrackPublication(Track.Source.Camera)
    setPubEnabled(pub, enabled)
  }

  disconnect(): void {
    const room = this.room
    this.leaving = true
    this.room = null
    this.remote.clear()
    this.videoOff.clear()
    this.local = null
    this.localScreen = null
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
      .on(RoomEvent.TrackPublished, (pub: RemoteTrackPublication, p: Participant) => {
        this.ensurePeer(p)
        this.keepHiddenCameraOff(pub, p)
        this.emitPeers()
      })
      .on(RoomEvent.TrackUnpublished, (pub: TrackPublication, p: Participant) => {
        const peer = this.remote.get(p.identity)
        if (!peer) return
        this.syncMedia(peer, p)
        this.setMuted(peer, pub, true)
        this.emitPeers()
      })
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, p: Participant) => {
        const peer = this.ensurePeer(p)
        if (SCREEN_SOURCES.has(pub.source)) {
          peer.screen ??= new MediaStream()
          peer.screen.addTrack(track.mediaStreamTrack)
        } else {
          peer.stream.addTrack(track.mediaStreamTrack)
          // A muted publication is subscribed silently (no TrackMuted): read its state.
          this.setMuted(peer, pub, pub.isMuted)
        }
        this.keepHiddenCameraOff(pub, p)
        this.emitPeers()
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: TrackPublication, p: Participant) => {
        const peer = this.remote.get(p.identity)
        if (peer && SCREEN_SOURCES.has(pub?.source)) {
          const gone = track.mediaStreamTrack.id
          const screen = peer.screen
          screen?.getTracks().filter((t) => t.id === gone).forEach((t) => screen.removeTrack(t))
          if (screen && screen.getTracks().length === 0) peer.screen = null
        } else {
          peer?.stream.removeTrack(track.mediaStreamTrack)
        }
        this.emitPeers()
      })
      .on(RoomEvent.TrackMuted, (pub: TrackPublication, p: Participant) => this.onMute(pub, p, true))
      .on(RoomEvent.TrackUnmuted, (pub: TrackPublication, p: Participant) => this.onMute(pub, p, false))
      .on(RoomEvent.LocalTrackPublished, () => {
        this.refreshLocal()
        this.emitLocalMedia()
      })
      .on(RoomEvent.LocalTrackUnpublished, () => {
        this.refreshLocal()
        this.emitLocalMedia()
      })
      .on(
        RoomEvent.DataReceived,
        (payload: Uint8Array, p?: RemoteParticipant, _kind?: unknown, topic?: string) => {
          this.onData?.(topic ?? '', payload, p?.identity ?? null)
        },
      )
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
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        if (this.leaving) return
        this.leaving = true
        this.room = null
        const ended =
          reason === DisconnectReason.ROOM_DELETED || reason === DisconnectReason.PARTICIPANT_REMOVED
        this.onDisconnected?.(ended ? 'ended' : 'failed')
      })
  }

  private onMute(pub: TrackPublication, p: Participant, muted: boolean): void {
    if (p.isLocal) {
      this.emitLocalMedia()
      return
    }
    const peer = this.remote.get(p.identity)
    if (!peer) return
    this.setMuted(peer, pub, muted)
    this.emitPeers()
  }

  private setMuted(peer: RemotePeer, pub: TrackPublication, muted: boolean): void {
    if (pub.source === Track.Source.Microphone) peer.micMuted = muted
    if (pub.source === Track.Source.Camera) peer.camMuted = muted
  }

  /** Mic / camera "off" = not published at all (joined with it off) or published muted. */
  private syncMedia(peer: RemotePeer, p: Participant): void {
    const mic = p.getTrackPublication(Track.Source.Microphone)
    const cam = p.getTrackPublication(Track.Source.Camera)
    peer.micMuted = !mic || mic.isMuted
    peer.camMuted = !cam || cam.isMuted
  }

  private keepHiddenCameraOff(pub: RemoteTrackPublication, p: Participant): void {
    if (pub.source === Track.Source.Camera && this.videoOff.has(p.identity)) setPubEnabled(pub, false)
  }

  private ensurePeer(p: Participant): RemotePeer {
    let peer = this.remote.get(p.identity)
    if (!peer) {
      peer = {
        identity: p.identity,
        name: p.name ?? '',
        stream: new MediaStream(),
        speaking: false,
        micMuted: true,
        camMuted: true,
        poorConnection: false,
        avatarUrl: avatarFromMetadata(p.metadata),
        screen: null,
      }
      this.remote.set(p.identity, peer)
    }
    this.syncMedia(peer, p)
    return peer
  }

  private refreshLocal(): void {
    const lp = this.room?.localParticipant
    if (!lp) return
    const tracks = [Track.Source.Microphone, Track.Source.Camera]
      .map((source) => lp.getTrackPublication(source)?.track?.mediaStreamTrack)
      .filter((t): t is MediaStreamTrack => !!t)
    this.local = new MediaStream(tracks)
    const screenTracks = [Track.Source.ScreenShare, Track.Source.ScreenShareAudio]
      .map((source) => lp.getTrackPublication(source)?.track?.mediaStreamTrack)
      .filter((t): t is MediaStreamTrack => !!t)
    this.localScreen = screenTracks.length ? new MediaStream(screenTracks) : null
    this.onLocalStream?.(this.local)
  }

  private emitLocalMedia(): void {
    if (this.room) this.onLocalMediaChanged?.(this.localMedia())
  }

  private emitPeers(): void {
    this.onPeersChanged?.(this.peers())
  }
}
