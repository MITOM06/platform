/**
 * The STOMP singleton must re-attach session subscriptions after EVERY reconnect.
 *
 * stompjs opens a brand-new socket on each reconnect with zero subscriptions; the
 * session-level `/user/queue/notifications`, `/user/queue/webrtc` and
 * `/topic/presence` used to be subscribed once after the first connect, so the
 * first dropped socket silently ended notifications and incoming calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface FakeSub {
  id: string
  unsubscribe: ReturnType<typeof vi.fn>
}

interface ClientConfig {
  beforeConnect?: () => Promise<void> | void
  onConnect?: () => void
  onWebSocketClose?: () => void
}

const created: FakeClient[] = []

class FakeClient {
  connected = false
  connectHeaders: Record<string, string> = {}
  config: ClientConfig
  subscriptions: Array<{ destination: string; sub: FakeSub }> = []
  forceDisconnect = vi.fn(() => {
    this.connected = false
    this.config.onWebSocketClose?.()
  })

  constructor(config: ClientConfig) {
    this.config = config
    created.push(this)
  }

  activate() {}
  deactivate() {
    this.connected = false
  }

  subscribe(destination: string) {
    const sub: FakeSub = { id: `sub-${this.subscriptions.length}`, unsubscribe: vi.fn() }
    this.subscriptions.push({ destination, sub })
    return sub
  }

  /** Simulates stompjs establishing a (re)connection. */
  async simulateConnect() {
    await this.config.beforeConnect?.()
    this.connected = true
    this.config.onConnect?.()
  }
}

vi.mock('@stomp/stompjs', () => ({ Client: FakeClient }))
vi.mock('@/lib/config/env', () => ({ wsUrlFromEnv: () => 'ws://test/ws' }))
vi.mock('@/lib/auth/force-logout', () => ({ forceLogout: vi.fn() }))
vi.mock('@/lib/api/axios', () => ({
  refreshAccessToken: vi.fn(async () => 'fresh-token'),
  isAuthFailure: () => false,
}))

// A token that is not expiring (exp far in the future) so connect never refreshes.
const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
const TOKEN = `h.${payload}.s`

async function freshService() {
  vi.resetModules()
  created.length = 0
  const { useAuthStore } = await import('@/lib/store/auth.store')
  useAuthStore.setState({ accessToken: TOKEN, user: { id: 'u1', email: 'a@b.c', displayName: 'A' } })
  const { stompService } = await import('@/lib/stomp/client')
  return stompService
}

describe('stompService durable subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('attaches a durable subscription on the first connect and again after every reconnect', async () => {
    const stomp = await freshService()
    const handler = vi.fn()
    stomp.subscribeDurable('/user/queue/notifications', handler)

    void stomp.connect(TOKEN)
    const client = created[0]
    await client.simulateConnect()
    expect(client.subscriptions.map((s) => s.destination)).toEqual(['/user/queue/notifications'])

    // Socket dropped (network blip / server restart) → stompjs reconnects.
    client.connected = false
    client.config.onWebSocketClose?.()
    await client.simulateConnect()
    expect(client.subscriptions.map((s) => s.destination)).toEqual([
      '/user/queue/notifications',
      '/user/queue/notifications',
    ])
  })

  it('subscribes immediately when already connected', async () => {
    const stomp = await freshService()
    void stomp.connect(TOKEN)
    await created[0].simulateConnect()

    stomp.subscribeDurable('/topic/presence', vi.fn())
    expect(created[0].subscriptions.map((s) => s.destination)).toEqual(['/topic/presence'])
  })

  it('stops re-attaching once unsubscribed', async () => {
    const stomp = await freshService()
    void stomp.connect(TOKEN)
    const client = created[0]
    await client.simulateConnect()

    const off = stomp.subscribeDurable('/user/queue/webrtc', vi.fn())
    const first = client.subscriptions[0].sub
    off()
    expect(first.unsubscribe).toHaveBeenCalledTimes(1)

    await client.simulateConnect()
    expect(client.subscriptions).toHaveLength(1)
  })

  it('reconnect() drops the socket so stompjs reconnects with the freshest token', async () => {
    const stomp = await freshService()
    void stomp.connect(TOKEN)
    const client = created[0]
    await client.simulateConnect()

    const { useAuthStore } = await import('@/lib/store/auth.store')
    const rotated = `h.${payload}.rotated`
    useAuthStore.setState({ accessToken: rotated })

    stomp.reconnect()
    expect(client.forceDisconnect).toHaveBeenCalledTimes(1)
    await client.simulateConnect()
    expect(client.connectHeaders.Authorization).toBe(`Bearer ${rotated}`)
  })
})
