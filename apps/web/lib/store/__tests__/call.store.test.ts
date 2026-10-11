import { beforeEach, describe, expect, it } from 'vitest'
import { selectInCall, useCallStore } from '../call.store'

const store = () => useCallStore.getState()

beforeEach(() => {
  store().reset()
  store().resetGroup()
})

describe('setConnecting', () => {
  it('moves an answered ring (either side) to connecting', () => {
    store().setOutgoing({ peerId: 'b', peerName: 'B', conversationId: 'c', video: false })
    store().setConnecting()
    expect(store().status).toBe('connecting')

    store().setIncoming({ peerId: 'a', peerName: 'A', conversationId: 'c', video: false })
    store().setConnecting()
    expect(store().status).toBe('connecting')
  })

  it('never moves a connected (or idle) call back', () => {
    store().setOutgoing({ peerId: 'b', peerName: 'B', conversationId: 'c', video: false })
    store().setConnected()
    store().setConnecting()
    expect(store().status).toBe('connected')

    store().reset()
    store().setConnecting()
    expect(store().status).toBe('idle')
  })
})

describe('selectInCall', () => {
  it('counts calling, connecting, connected and group calls — not a ring we have not answered', () => {
    expect(selectInCall({ status: 'idle', groupCallId: null })).toBe(false)
    expect(selectInCall({ status: 'incoming', groupCallId: null })).toBe(false)
    expect(selectInCall({ status: 'outgoing', groupCallId: null })).toBe(true)
    expect(selectInCall({ status: 'connecting', groupCallId: null })).toBe(true)
    expect(selectInCall({ status: 'connected', groupCallId: null })).toBe(true)
    expect(selectInCall({ status: 'idle', groupCallId: 'g1' })).toBe(true)
  })
})
