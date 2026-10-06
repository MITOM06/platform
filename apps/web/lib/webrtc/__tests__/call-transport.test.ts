import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getConfig } = vi.hoisted(() => ({ getConfig: vi.fn() }))
vi.mock('@/lib/api/calls', () => ({ callsApi: { getConfig } }))

import { getCallTransport, refreshCallTransport, resetCallTransportForTest } from '../call-transport'

beforeEach(() => {
  getConfig.mockReset()
  resetCallTransportForTest()
})

describe('call transport', () => {
  it('defaults to mesh before the server has been asked', () => {
    expect(getCallTransport()).toBe('mesh')
  })

  it('switches to sfu when the server says so', async () => {
    getConfig.mockResolvedValue({ transport: 'sfu', livekitUrl: 'wss://rtc.example.com' })
    await refreshCallTransport()
    expect(getCallTransport()).toBe('sfu')
  })

  it('stays on mesh when the server cannot be reached', async () => {
    getConfig.mockResolvedValueOnce({ transport: 'sfu' })
    await refreshCallTransport()
    getConfig.mockRejectedValueOnce(new Error('offline'))
    await refreshCallTransport()
    expect(getCallTransport()).toBe('mesh')
  })
})
