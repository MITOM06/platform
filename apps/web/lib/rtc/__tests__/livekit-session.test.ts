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

import { LiveKitSession, MediaAccessError, RoomConnectError, ScreenShareError } from '../livekit-session'

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

const bob = { identity: 'bob', name: 'Bob', isLocal: false }
const track = (kind: string) => ({ kind, mediaStreamTrack: { id: `${kind}-track` } })
const pub = (source: string) => ({ source })

let session: LiveKitSession
const room = () => lk.FakeRoom.last!

beforeEach(() => {
  vi.stubGlobal('MediaStream', FakeMediaStream)
  lk.FakeRoom.last = null
  session = new LiveKitSession()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('connect', () => {
  it('joins the room and turns on the mic, and the camera only for video', async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
    expect(room().connect).toHaveBeenCalledWith('wss://rtc', 'tok')
    expect(room().localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true)
    expect(room().localParticipant.setCameraEnabled).not.toHaveBeenCalled()

    const video = new LiveKitSession()
    await video.connect('wss://rtc', 'tok', { video: true })
    expect(room().localParticipant.setCameraEnabled).toHaveBeenCalledWith(true)
  })

  it('reports a blocked mic as MediaAccessError and leaves the room', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' })
    const onDisconnected = vi.fn()
    session.onDisconnected = onDisconnected
    lk.FakeRoom.micError = denied
    await expect(session.connect('wss://rtc', 'tok', { video: false })).rejects.toBeInstanceOf(
      MediaAccessError,
    )
    expect(room().disconnect).toHaveBeenCalled()
    expect(onDisconnected).not.toHaveBeenCalled()
  })

  it('reports a failed connection as RoomConnectError', async () => {
    lk.FakeRoom.connectError = new Error('ws closed')
    await expect(session.connect('wss://rtc', 'tok', { video: false })).rejects.toBeInstanceOf(
      RoomConnectError,
    )
  })
})

describe('remote peers', () => {
  beforeEach(async () => {
    await session.connect('wss://rtc', 'tok', { video: true })
  })

  it('builds a stream per peer from subscribed tracks and reports changes', () => {
    const onPeersChanged = vi.fn()
    session.onPeersChanged = onPeersChanged

    room().emit('participantConnected', bob)
    room().emit('trackSubscribed', track('audio'), pub('microphone'), bob)
    room().emit('trackSubscribed', track('video'), pub('camera'), bob)

    const peer = session.peer('bob')!
    expect(peer.name).toBe('Bob')
    expect((peer.stream as unknown as FakeMediaStream).getTracks()).toHaveLength(2)
    expect(onPeersChanged).toHaveBeenCalled()

    room().emit('trackUnsubscribed', track('video'), pub('camera'), bob)
    room().emit('participantDisconnected', bob)
    expect(session.peer('bob')).toBeUndefined()
    expect(session.peers()).toHaveLength(0)
  })

  it('tracks who is speaking, muted, or on a poor connection', () => {
    room().emit('participantConnected', bob)
    room().emit('activeSpeakersChanged', [bob])
    room().emit('trackMuted', pub('microphone'), bob)
    room().emit('connectionQualityChanged', 'poor', bob)

    const peer = session.peer('bob')!
    expect(peer.speaking).toBe(true)
    expect(peer.micMuted).toBe(true)
    expect(peer.poorConnection).toBe(true)

    room().emit('activeSpeakersChanged', [])
    room().emit('trackUnmuted', pub('microphone'), bob)
    expect(session.peer('bob')!.speaking).toBe(false)
    expect(session.peer('bob')!.micMuted).toBe(false)
  })
})

describe('connection state', () => {
  beforeEach(async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
  })

  it('surfaces reconnecting and reconnected', () => {
    const onReconnecting = vi.fn()
    session.onReconnecting = onReconnecting
    room().emit('reconnecting')
    room().emit('reconnected')
    expect(onReconnecting.mock.calls).toEqual([[true], [false]])
  })

  it('reports an unexpected disconnect as failed', () => {
    const onDisconnected = vi.fn()
    session.onDisconnected = onDisconnected
    room().emit('disconnected')
    expect(onDisconnected).toHaveBeenCalledWith('failed')
  })

  it('stays quiet when we leave on purpose', async () => {
    const onDisconnected = vi.fn()
    session.onDisconnected = onDisconnected
    session.disconnect()
    expect(room().disconnect).toHaveBeenCalled()
    expect(onDisconnected).not.toHaveBeenCalled()
  })
})

describe('final-review fixes', () => {
  it('does not use adaptive stream — tracks go into our own <video>, not track.attach()', async () => {
    await session.connect('wss://rtc', 'tok', { video: true })
    expect(room().options).toMatchObject({ adaptiveStream: false })
  })

  it('tells a server-closed room apart from a dropped connection', async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
    const onDisconnected = vi.fn()
    session.onDisconnected = onDisconnected
    room().emit('disconnected', 5) // ROOM_DELETED
    expect(onDisconnected).toHaveBeenCalledWith('ended')

    const other = new LiveKitSession()
    await other.connect('wss://rtc', 'tok', { video: false })
    const onOther = vi.fn()
    other.onDisconnected = onOther
    room().emit('disconnected', 9) // SIGNAL_CLOSE
    expect(onOther).toHaveBeenCalledWith('failed')
  })
})

describe('meeting extensions', () => {
  it('can join with the mic off and preferred devices', async () => {
    await session.connect('wss://rtc', 'tok', { video: true, audio: false, audioDeviceId: 'mic-2', videoDeviceId: 'cam-3' })
    expect(room().localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled()
    expect(room().localParticipant.setCameraEnabled).toHaveBeenCalledWith(true)
    expect(room().options).toMatchObject({
      adaptiveStream: false,
      audioCaptureDefaults: { deviceId: 'mic-2' },
      videoCaptureDefaults: { deviceId: 'cam-3' },
    })
  })

  it('adds no capture defaults when no device is chosen (calls stay as they were)', async () => {
    await session.connect('wss://rtc', 'tok', { video: true })
    expect(room().options).toEqual({ adaptiveStream: false, dynacast: true })
    expect(room().localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true)
  })

  it('keeps a peer’s screen share out of their camera stream', async () => {
    await session.connect('wss://rtc', 'tok', { video: true })
    room().emit('participantConnected', bob)
    room().emit('trackSubscribed', track('video'), pub('camera'), bob)
    room().emit('trackSubscribed', track('video'), pub('screen_share'), bob)
    const peer = session.peer('bob')!
    expect((peer.stream as unknown as FakeMediaStream).getTracks()).toHaveLength(1)
    expect((peer.screen as unknown as FakeMediaStream).getTracks()).toHaveLength(1)
    room().emit('trackUnsubscribed', track('video'), pub('screen_share'), bob)
    expect(session.peer('bob')!.screen).toBeNull()
  })

  it('reads the avatar from metadata and ignores garbage', async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
    room().emit('participantConnected', { ...bob, metadata: '{"avatarUrl":"/api/uploads/a.png"}' })
    expect(session.peer('bob')!.avatarUrl).toBe('/api/uploads/a.png')
    room().emit('participantConnected', { identity: 'eve', name: 'Eve', isLocal: false, metadata: 'not json' })
    expect(session.peer('eve')!.avatarUrl).toBeUndefined()
  })

  it('reports when the server mutes my mic', async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
    const onLocal = vi.fn()
    session.onLocalMediaChanged = onLocal
    room().localParticipant.isMicrophoneEnabled = false
    room().emit('trackMuted', pub('microphone'), { identity: 'me', isLocal: true })
    expect(onLocal).toHaveBeenLastCalledWith({ mic: false, camera: false, screen: false })
  })

  it('starts and stops screen sharing and tells the caller', async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
    const onLocal = vi.fn()
    session.onLocalMediaChanged = onLocal
    room().localParticipant.isScreenShareEnabled = true
    await session.setScreenShare(true)
    expect(room().localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(true, { audio: true })
    expect(onLocal).toHaveBeenLastCalledWith({ mic: true, camera: false, screen: true })

    room().localParticipant.setScreenShareEnabled.mockRejectedValueOnce(
      Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }))
    await expect(session.setScreenShare(true)).rejects.toBeInstanceOf(ScreenShareError)
  })

  it('reports other screen share failures without leaking the browser error', async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
    room().localParticipant.setScreenShareEnabled.mockRejectedValueOnce(
      Object.assign(new Error('Could not start video source'), { name: 'NotReadableError' }))
    const err = await session.setScreenShare(true).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(ScreenShareError)
    expect((err as Error).message).not.toContain('video source')
  })

  it('sends and receives data on a topic', async () => {
    await session.connect('wss://rtc', 'tok', { video: false })
    const onData = vi.fn()
    session.onData = onData
    const bytes = new Uint8Array([1, 2])
    session.publishData('reaction', bytes, false)
    expect(room().localParticipant.publishData).toHaveBeenCalledWith(bytes, { reliable: false, topic: 'reaction' })
    room().emit('dataReceived', bytes, bob, 1, 'reaction')
    expect(onData).toHaveBeenCalledWith('reaction', bytes, 'bob')
  })

  it('never throws when publishing data fails or before connecting', async () => {
    expect(() => session.publishData('reaction', new Uint8Array([1]), false)).not.toThrow()
    await session.connect('wss://rtc', 'tok', { video: false })
    room().localParticipant.publishData.mockRejectedValueOnce(new Error('closed'))
    expect(() => session.publishData('reaction', new Uint8Array([1]), false)).not.toThrow()
  })

  it('switches the active capture device', async () => {
    await session.connect('wss://rtc', 'tok', { video: true })
    await session.switchDevice('audioinput', 'mic-9')
    expect(room().switchActiveDevice).toHaveBeenCalledWith('audioinput', 'mic-9')
  })

  it('stops receiving a hidden peer’s camera and resumes it', async () => {
    await session.connect('wss://rtc', 'tok', { video: true })
    const camera = { setEnabled: vi.fn() }
    room().remoteParticipants.set('bob', { ...bob, getTrackPublication: (s: string) => (s === 'camera' ? camera : undefined) })
    session.setPeerVideoEnabled('bob', false)
    session.setPeerVideoEnabled('bob', true)
    session.setPeerVideoEnabled('ghost', false)
    expect(camera.setEnabled.mock.calls).toEqual([[false], [true]])
  })
})
