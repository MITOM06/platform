/**
 * A 1-on-1 call listens to its conversation topic for `call.started` /
 * `call.ended` while the chat thread may be closed. stompjs opens every
 * reconnect with zero subscriptions, so that listener must be re-attached
 * like the session-level ones, or a call misses its own end after a blip.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  subscriptions: Array<{ destination: string; callback: (m: { body: string }) => void; unsubscribe: () => void }> = []

  constructor(config: ClientConfig) {
    this.config = config
    created.push(this)
  }

  activate() {}
  deactivate() {
    this.connected = false
  }

  subscribe(destination: string, callback: (m: { body: string }) => void) {
    const entry = { destination, callback, unsubscribe: vi.fn() }
    this.subscriptions.push(entry)
    return { id: `sub-${this.subscriptions.length}`, unsubscribe: entry.unsubscribe }
  }

  async simulateConnect() {
    await this.config.beforeConnect?.()
    this.connected = true
    this.config.onConnect?.()
  }

  simulateDrop() {
    this.connected = false
    this.config.onWebSocketClose?.()
  }
}

vi.mock('@stomp/stompjs', () => ({ Client: FakeClient }))
vi.mock('@/lib/config/env', () => ({ wsUrlFromEnv: () => 'ws://test/ws' }))
vi.mock('@/lib/auth/force-logout', () => ({ forceLogout: vi.fn() }))
vi.mock('@/lib/api/axios', () => ({
  refreshAccessToken: vi.fn(async () => 'fresh-token'),
  isAuthFailure: () => false,
}))
vi.mock('@/lib/api/chat', () => ({ chatService: { sendMessage: vi.fn(() => Promise.resolve()) } }))

const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
const TOKEN = `h.${payload}.s`
const TOPIC = '/topic/conversation/conv'

async function fresh() {
  vi.resetModules()
  created.length = 0
  const { useAuthStore } = await import('@/lib/store/auth.store')
  useAuthStore.setState({ accessToken: TOKEN, user: { id: 'u1', email: 'a@b.c', displayName: 'A' } })
  const { stompService } = await import('@/lib/stomp/client')
  const { subscribeCallEvents } = await import('../call-topic')
  return { stompService, subscribeCallEvents }
}

const ended = JSON.stringify({ event: 'call.ended', callId: 'c1', reason: 'hangup' })

describe('subscribeCallEvents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps hearing the call after the socket reconnects', async () => {
    const { stompService, subscribeCallEvents } = await fresh()
    void stompService.connect(TOKEN)
    const client = created[0]
    await client.simulateConnect()
    const onEvent = vi.fn()
    subscribeCallEvents('conv', onEvent)

    client.simulateDrop()
    await client.simulateConnect()
    const onTopic = client.subscriptions.filter((s) => s.destination === TOPIC)
    expect(onTopic).toHaveLength(2)
    onTopic[1]!.callback({ body: ended })
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'call.ended', callId: 'c1' }))
  })

  it('a call started while the socket is down subscribes once it is back', async () => {
    const { stompService, subscribeCallEvents } = await fresh()
    void stompService.connect(TOKEN)
    const client = created[0]
    subscribeCallEvents('conv', vi.fn())
    expect(client.subscriptions).toHaveLength(0)
    await client.simulateConnect()
    expect(client.subscriptions.map((s) => s.destination)).toEqual([TOPIC])
  })

  it('stops re-attaching once the call lets go of it', async () => {
    const { stompService, subscribeCallEvents } = await fresh()
    void stompService.connect(TOKEN)
    const client = created[0]
    await client.simulateConnect()
    const sub = subscribeCallEvents('conv', vi.fn())
    sub.unsubscribe()
    client.simulateDrop()
    await client.simulateConnect()
    expect(client.subscriptions.filter((s) => s.destination === TOPIC)).toHaveLength(1)
  })

  it('ignores frames that are not call events', async () => {
    const { stompService, subscribeCallEvents } = await fresh()
    void stompService.connect(TOKEN)
    const client = created[0]
    await client.simulateConnect()
    const onEvent = vi.fn()
    subscribeCallEvents('conv', onEvent)
    client.subscriptions[0]!.callback({ body: JSON.stringify({ type: 'MESSAGE', id: 'm1' }) })
    client.subscriptions[0]!.callback({ body: 'not json' })
    expect(onEvent).not.toHaveBeenCalled()
  })
})
