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
    }
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
      },
      Track: { Source: { Camera: 'camera', Microphone: 'microphone' } },
      ConnectionQuality: { Excellent: 'excellent', Good: 'good', Poor: 'poor', Lost: 'lost' },
    },
  }
})
vi.mock('livekit-client', () => lk.module)

import { LiveKitSession, MediaAccessError, RoomConnectError } from '../livekit-session'

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
