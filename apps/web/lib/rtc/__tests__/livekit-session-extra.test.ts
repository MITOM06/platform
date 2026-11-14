import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lk = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void
  class FakeRoom {
    static last: FakeRoom | null = null
    /** Next connect() / setMicrophoneEnabled() failure, consumed once. */
    static connectError: Error | null = null
    static micError: Error | null = null
    handlers = new Map<string, Handler[]>()
    remoteParticipants = new Map<string, unknown>()
    localParticipant = {
      setMicrophoneEnabled: vi.fn<(on: boolean) => Promise<unknown>>(async () => {
        const e = FakeRoom.micError
        FakeRoom.micError = null
        if (e) throw e
        return undefined
      }),
      setCameraEnabled: vi.fn<(on: boolean) => Promise<unknown>>(async () => undefined),
      getTrackPublication: vi.fn<(source: string) => unknown>(() => undefined as unknown),
      isMicrophoneEnabled: true,
      isCameraEnabled: false,
      isScreenShareEnabled: false,
      setScreenShareEnabled: vi.fn<(on: boolean, opts?: unknown) => Promise<unknown>>(async () => undefined),
      publishData: vi.fn<(data: Uint8Array, opts: unknown) => Promise<void>>(async () => undefined),
    }
    switchActiveDevice = vi.fn<(kind: string, id: string) => Promise<boolean>>(async () => true)
    connect = vi.fn<(url: string, token: string) => Promise<unknown>>(async () => {
      const e = FakeRoom.connectError
      FakeRoom.connectError = null
      if (e) throw e
      return undefined
    })
    disconnect = vi.fn(async () => {
      this.emit('disconnected')
    })
    constructor(public options?: unknown) {
      FakeRoom.last = this
    }
    on(event: string, fn: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn])
      return this
    }
    emit(event: string, ...args: unknown[]) {
      for (const fn of this.handlers.get(event) ?? []) fn(...args)
    }
  }
  return {
    FakeRoom,
    module: {
      Room: FakeRoom,
      RoomEvent: {
        ParticipantConnected: 'participantConnected',
        ParticipantDisconnected: 'participantDisconnected',
        TrackSubscribed: 'trackSubscribed',
        TrackUnsubscribed: 'trackUnsubscribed',
        TrackPublished: 'trackPublished',
        TrackUnpublished: 'trackUnpublished',
        TrackMuted: 'trackMuted',
        TrackUnmuted: 'trackUnmuted',
        LocalTrackPublished: 'localTrackPublished',
        LocalTrackUnpublished: 'localTrackUnpublished',
        ActiveSpeakersChanged: 'activeSpeakersChanged',
        ConnectionQualityChanged: 'connectionQualityChanged',
        Reconnecting: 'reconnecting',
        Reconnected: 'reconnected',
        Disconnected: 'disconnected',
        DataReceived: 'dataReceived',
      },
      Track: {
        Source: {
          Camera: 'camera',
          Microphone: 'microphone',
          ScreenShare: 'screen_share',
          ScreenShareAudio: 'screen_share_audio',
        },
      },
      ConnectionQuality: { Excellent: 'excellent', Good: 'good', Poor: 'poor', Lost: 'lost' },
      DisconnectReason: { CLIENT_INITIATED: 1, PARTICIPANT_REMOVED: 4, ROOM_DELETED: 5, SIGNAL_CLOSE: 9 },
    },
  }
})
vi.mock('livekit-client', () => lk.module)

import { LiveKitSession, RoomConnectError } from '../livekit-session'

class FakeMediaStream {
  tracks: unknown[]
  constructor(tracks: unknown[] = []) {
    this.tracks = [...tracks]
  }
  addTrack(t: unknown) {
    this.tracks.push(t)
  }
  removeTrack(t: unknown) {
    this.tracks = this.tracks.filter((x) => x !== t)
  }
  getTracks() {
    return this.tracks
  }
}

interface FakePub { source: string; isMuted: boolean; setEnabled?: (on: boolean) => void }
/** A remote participant whose publications can change during a test. */
function participant(identity: string, name: string, pubs: FakePub[] = [], extra: object = {}) {
  return { identity, name, isLocal: false, ...extra, pubs,
    getTrackPublication: (s: string) => pubs.find((p) => p.source === s) }
}
const pub = (source: string, isMuted = false): FakePub => ({ source, isMuted })

let session: LiveKitSession
const room = () => lk.FakeRoom.last!

beforeEach(() => {
  vi.stubGlobal('MediaStream', FakeMediaStream)
  lk.FakeRoom.last = null
  session = new LiveKitSession()
})
afterEach(() => vi.unstubAllGlobals())

describe('before connecting', () => {
  it('every getter / command is a safe no-op without a room', async () => {
    expect(session.localStream()).toBeNull()
    expect(session.localScreenStream()).toBeNull()
    expect(session.localMedia()).toEqual({ mic: false, camera: false, screen: false })
    await expect(session.setMic(true)).resolves.toBeUndefined()
    await expect(session.setCamera(true)).resolves.toBeUndefined()
    await expect(session.setScreenShare(true)).resolves.toBeUndefined()
    expect(session.peers()).toEqual([])
  })
})

describe('connected', () => {
  beforeEach(async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
  })

  it('a non-media failure while opening the mic is a RoomConnectError', async () => {
    const s = new LiveKitSession()
    lk.FakeRoom.micError = Object.assign(new Error('weird'), { name: 'OverconstrainedThing' })
    await expect(s.connect('wss://rtc', 'tok', { video: false })).rejects.toBeInstanceOf(RoomConnectError)
  })

  it('audio:false skips the mic', async () => {
    const s = new LiveKitSession()
    await s.connect('wss://rtc', 'tok', { video: false, audio: false })
    expect(room().localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled()
  })

  it('setMic / setCamera toggle the local participant and re-emit the local stream', async () => {
    const onLocal = vi.fn()
    session.onLocalStream = onLocal
    const mic = { id: 'mic' }
    room().localParticipant.getTrackPublication.mockImplementation((s: string) =>
      s === 'microphone' ? { track: { mediaStreamTrack: mic } } : undefined)
    await session.setMic(false)
    expect(room().localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(false)
    await session.setCamera(true)
    expect(room().localParticipant.setCameraEnabled).toHaveBeenLastCalledWith(true)
    expect(onLocal).toHaveBeenCalledTimes(2)
    expect((session.localStream() as unknown as FakeMediaStream).getTracks()).toEqual([mic])
    expect(session.localScreenStream()).toBeNull()
  })

  it('local screen tracks build the local screen stream', async () => {
    const screen = { id: 'screen' }
    room().localParticipant.getTrackPublication.mockImplementation((s: string) =>
      s === 'screen_share' ? { track: { mediaStreamTrack: screen } } : undefined)
    const onMedia = vi.fn()
    session.onLocalMediaChanged = onMedia
    room().emit('localTrackPublished')
    expect((session.localScreenStream() as unknown as FakeMediaStream).getTracks()).toEqual([screen])
    expect(onMedia).toHaveBeenCalledWith({ mic: true, camera: false, screen: false })
    room().localParticipant.getTrackPublication.mockImplementation(() => undefined)
    room().emit('localTrackUnpublished')
    expect(session.localScreenStream()).toBeNull()
    expect(onMedia).toHaveBeenCalledTimes(2)
  })

  it('local quality / mute events go to the local callbacks', () => {
    const onPoor = vi.fn()
    const onMedia = vi.fn()
    session.onLocalPoorConnection = onPoor
    session.onLocalMediaChanged = onMedia
    room().emit('connectionQualityChanged', 'lost', { identity: 'me', isLocal: true })
    expect(onPoor).toHaveBeenCalledWith(true)
    room().emit('connectionQualityChanged', 'excellent', { identity: 'me', isLocal: true })
    expect(onPoor).toHaveBeenLastCalledWith(false)
    room().emit('trackMuted', pub('microphone'), { identity: 'me', isLocal: true })
    expect(onMedia).toHaveBeenCalled()
  })

  it('events about unknown remote participants are ignored', () => {
    const onPeers = vi.fn()
    session.onPeersChanged = onPeers
    const ghost = participant('ghost', 'Ghost')
    room().emit('trackUnpublished', pub('camera'), ghost)
    room().emit('trackMuted', pub('camera'), ghost)
    room().emit('connectionQualityChanged', 'poor', ghost)
    expect(onPeers).not.toHaveBeenCalled()
    expect(session.peer('ghost')).toBeUndefined()
  })

  it('data messages without a topic or sender', () => {
    const onData = vi.fn()
    session.onData = onData
    const payload = new Uint8Array([1])
    room().emit('dataReceived', payload)
    expect(onData).toHaveBeenCalledWith('', payload, null)
    room().emit('dataReceived', payload, { identity: 'bob' }, undefined, 'chat')
    expect(onData).toHaveBeenLastCalledWith('chat', payload, 'bob')
  })

  it('reconnecting / reconnected are reported', () => {
    const onRec = vi.fn()
    session.onReconnecting = onRec
    room().emit('reconnecting')
    room().emit('reconnected')
    expect(onRec.mock.calls).toEqual([[true], [false]])
  })
})
