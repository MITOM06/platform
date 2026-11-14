/** callManager / groupCallManager route each command to the engine of the current transport. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const engine = (name: string) => {
    const methods = ['getLocalStream', 'getRemoteStream', 'isActive', 'startCall', 'confirmStarted', 'join',
      'applyRoster', 'handleSignal', 'toggleMic', 'toggleCamera', 'leave', 'handleEnded', 'acceptIncoming',
      'endCall', 'dismissIncoming', 'handleCallEvent']
    const o: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const m of methods) o[m] = vi.fn(() => `${name}.${m}`)
    return o
  }
  return {
    mesh1: engine('mesh1'), sfu1: engine('sfu1'), meshG: engine('meshG'), sfuG: engine('sfuG'),
    transport: 'mesh' as 'mesh' | 'sfu', publish: vi.fn(),
  }
})
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish: h.publish } }))
vi.mock('../call-transport', () => ({ getCallTransport: () => h.transport }))
vi.mock('../mesh-call-manager', () => ({ MeshCallManager: class { constructor() { return h.mesh1 } } }))
vi.mock('../sfu-call', () => ({ SfuDirectCall: class { constructor() { return h.sfu1 } } }))
vi.mock('../mesh-group-call-manager', () => ({ MeshGroupCallManager: class { constructor() { return h.meshG } } }))
vi.mock('../sfu-group-call', () => ({ SfuGroupCall: class { constructor() { return h.sfuG } } }))

import { callManager } from '../call-manager'
import { groupCallManager } from '../group-call-manager'
import { useCallStore } from '@/lib/store/call.store'

const initial = useCallStore.getState()
beforeEach(() => {
  useCallStore.setState(initial, true)
  for (const e of [h.mesh1, h.sfu1, h.meshG, h.sfuG]) for (const f of Object.values(e)) f.mockClear()
  h.publish.mockClear()
  h.transport = 'mesh'
})

describe('callManager', () => {
  it('idle → mesh engine for streams / dismiss; sfu transport → sfu engine', () => {
    expect(callManager.getLocalStream()).toBe('mesh1.getLocalStream')
    expect(callManager.getRemoteStream()).toBe('mesh1.getRemoteStream')
    callManager.dismissIncoming()
    expect(h.mesh1.dismissIncoming).toHaveBeenCalled()
    useCallStore.setState({ transport: 'sfu' } as never)
    expect(callManager.getLocalStream()).toBe('sfu1.getLocalStream')
    callManager.toggleMic(false)
    callManager.toggleCamera(true)
    callManager.endCall()
    expect(h.sfu1.toggleMic).toHaveBeenCalledWith(false)
    expect(h.sfu1.toggleCamera).toHaveBeenCalledWith(true)
    expect(h.sfu1.endCall).toHaveBeenCalledWith('hangup')
  })

  it('call events always go to the sfu engine', () => {
    const ev = { type: 'call.started' } as never
    callManager.handleCallEvent(ev)
    expect(h.sfu1.handleCallEvent).toHaveBeenCalledWith(ev)
  })

  it('call-blocked closes a mesh "Calling…" screen; sfu signals go to sfu; mesh-only to mesh', () => {
    useCallStore.setState({ status: 'outgoing', transport: 'mesh' } as never)
    callManager.handleSignal({ type: 'call-blocked' } as never)
    expect(h.sfu1.handleSignal).toHaveBeenCalled()
    expect(useCallStore.getState().status).toBe('idle')
    callManager.handleSignal({ type: 'call-ring-cancel' } as never)
    expect(h.sfu1.handleSignal).toHaveBeenCalledTimes(2)
    callManager.handleSignal({ type: 'offer', senderId: 'b', conversationId: 'c', sdp: 's' } as never)
    expect(h.mesh1.handleSignal).toHaveBeenCalled()
  })

  it('a mesh offer during an sfu call is answered busy and never reaches mesh', () => {
    useCallStore.setState({ status: 'connected', transport: 'sfu' } as never)
    callManager.handleSignal({ type: 'offer', senderId: 'b', conversationId: 'c', sdp: 's' } as never)
    expect(h.publish).toHaveBeenCalledWith('/app/call.end', { targetId: 'b', conversationId: 'c', type: 'end', reason: 'busy', duration: 0 })
    callManager.handleSignal({ type: 'ice', senderId: 'b' } as never)
    expect(h.mesh1.handleSignal).not.toHaveBeenCalled()
  })

  it('startCall: ignored while busy; uses the configured transport', async () => {
    useCallStore.setState({ status: 'connected' } as never)
    await callManager.startCall('b', 'B', 'c')
    expect(h.mesh1.startCall).not.toHaveBeenCalled()
    useCallStore.setState({ status: 'idle' } as never)
    h.transport = 'sfu'
    await callManager.startCall('b', 'B', 'c', false)
    expect(h.sfu1.startCall).toHaveBeenCalledWith('b', 'B', 'c', false)
  })
})

describe('groupCallManager', () => {
  it('routes by the group transport, and the call transport when starting', async () => {
    expect(groupCallManager.getLocalStream()).toBe('meshG.getLocalStream')
    expect(groupCallManager.getRemoteStream('p')).toBe('meshG.getRemoteStream')
    await groupCallManager.applyRoster([])
    expect(h.meshG.applyRoster).toHaveBeenCalledWith([])
    h.transport = 'sfu'
    await groupCallManager.startCall('c', 'me', 'audio', false)
    expect(h.sfuG.startCall).toHaveBeenCalledWith('c', 'me', 'audio', false)
    await groupCallManager.confirmStarted('k', 'c', 'me', 'audio', false, 'sfu')
    await groupCallManager.join('k', 'c', 'me', 'audio', false)
    expect(h.sfuG.confirmStarted).toHaveBeenCalled()
    expect(h.meshG.join).toHaveBeenCalled()
    useCallStore.setState({ groupTransport: 'sfu' } as never)
    groupCallManager.toggleMic(true)
    groupCallManager.toggleCamera(false)
    groupCallManager.leave()
    expect(h.sfuG.toggleMic).toHaveBeenCalledWith(true)
    expect(h.sfuG.toggleCamera).toHaveBeenCalledWith(false)
    expect(h.sfuG.leave).toHaveBeenCalled()
  })

  it('isActive / handleSignal / handleEnded', () => {
    h.meshG.isActive.mockReturnValueOnce(false)
    h.sfuG.isActive.mockReturnValueOnce(true)
    expect(groupCallManager.isActive()).toBe(true)
    groupCallManager.handleSignal({ type: 'offer' } as never)
    expect(h.meshG.handleSignal).toHaveBeenCalled()
    groupCallManager.handleEnded('k')
    expect(h.meshG.handleEnded).toHaveBeenCalledWith('k')
    expect(h.sfuG.handleEnded).toHaveBeenCalledWith('k')
  })

  it('declineRing tells the server only for sfu rings', () => {
    useCallStore.setState({ incomingGroupCall: { callId: 'k1' } } as never)
    groupCallManager.declineRing({ callId: 'k1', transport: 'mesh' } as never)
    expect(h.publish).not.toHaveBeenCalled()
    expect(useCallStore.getState().incomingGroupCall).toBeNull()
    groupCallManager.declineRing({ callId: 'k2', transport: 'sfu' } as never)
    expect(h.publish).toHaveBeenCalledWith('/app/call.decline', { callId: 'k2', reason: 'declined' })
  })
})
