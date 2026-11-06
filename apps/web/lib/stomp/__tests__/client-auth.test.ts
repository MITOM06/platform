/**
 * STOMP singleton — token handling on (re)connect and the guarded transmit paths.
 *
 * - An expiring / unreadable token is refreshed BEFORE CONNECT; a refresh the
 *   server genuinely rejects stops the reconnect loop and forces logout; a
 *   transient refresh failure keeps the session (no logout).
 * - A STOMP ERROR frame (revoked session) forces a refresh on the next attempt
 *   even when the token still looks fresh — otherwise the revoked token loops forever.
 * - publish / subscribe / unsubscribe on a dead socket are no-ops, never throws.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface ClientConfig {
  brokerURL?: string
  beforeConnect?: () => Promise<void> | void
  onConnect?: () => void
  onStompError?: (frame: { command: string }) => void
  onDisconnect?: () => void
  onWebSocketClose?: () => void
}

const h = vi.hoisted(() => ({
  created: [] as unknown[],
  refresh: vi.fn(async (): Promise<string> => 'fresh-token'),
  authFailure: vi.fn((_err: unknown) => false),
  forceLogout: vi.fn(async (_err: unknown) => undefined),
  wsUrl: 'ws://test/ws' as string | undefined,
}))

class FakeClient {
  connected = false
  connectHeaders: Record<string, string> = {}
  config: ClientConfig
  published: Array<{ destination: string; body: string }> = []
  publishThrows = false
  deactivate = vi.fn(() => {
    this.connected = false
  })
  forceDisconnect = vi.fn()
  subscribe = vi.fn((destination: string) => ({
    id: `sub-${destination}`,
    unsubscribe: vi.fn(),
  }))

  constructor(config: ClientConfig) {
    this.config = config
    h.created.push(this)
  }

  activate() {}

  publish(frame: { destination: string; body: string }) {
    if (this.publishThrows) throw new Error('WebSocket is already in CLOSING or CLOSED state')
    this.published.push(frame)
  }

  async simulateConnect() {
    await this.config.beforeConnect?.()
    if (!this.deactivate.mock.calls.length) {
      this.connected = true
      this.config.onConnect?.()
    }
  }
}

vi.mock('@stomp/stompjs', () => ({ Client: FakeClient }))
vi.mock('@/lib/config/env', () => ({ wsUrlFromEnv: () => h.wsUrl }))
vi.mock('@/lib/auth/force-logout', () => ({ forceLogout: h.forceLogout }))
vi.mock('@/lib/api/axios', () => ({
  refreshAccessToken: h.refresh,
  isAuthFailure: h.authFailure,
}))

const jwt = (expSecFromNow: number) =>
  `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecFromNow }))}.s`
const FRESH = jwt(3600)
const EXPIRING = jwt(30) // inside the 60s safety window
const USER = { id: 'u1', email: 'a@b.c', displayName: 'A' }

async function freshService(accessToken: string | null = FRESH) {
  vi.resetModules()
  h.created.length = 0
  const { useAuthStore } = await import('@/lib/store/auth.store')
  useAuthStore.setState({ accessToken, user: USER })
  const { stompService } = await import('@/lib/stomp/client')
  return { stompService, useAuthStore }
}

const last = () => h.created[h.created.length - 1] as FakeClient

beforeEach(() => {
  vi.clearAllMocks()
  h.refresh.mockImplementation(async () => 'fresh-token')
  h.authFailure.mockImplementation(() => false)
  h.wsUrl = 'ws://test/ws'
})

describe('beforeConnect token handling', () => {
  it('a fresh token is used as-is, no refresh', async () => {
    const { stompService } = await freshService(FRESH)
    const p = stompService.connect(FRESH)
    await last().simulateConnect()
    await p
    expect(h.refresh).not.toHaveBeenCalled()
    expect(last().connectHeaders).toEqual({ Authorization: `Bearer ${FRESH}` })
    expect(last().config.brokerURL).toBe('ws://test/ws')
  })

  it('an expiring token is refreshed first and the new one stored + sent', async () => {
    const { stompService, useAuthStore } = await freshService(EXPIRING)
    const p = stompService.connect(EXPIRING)
    await last().simulateConnect()
    await p
    expect(h.refresh).toHaveBeenCalledTimes(1)
    expect(last().connectHeaders).toEqual({ Authorization: 'Bearer fresh-token' })
    expect(useAuthStore.getState().accessToken).toBe('fresh-token')
  })

  it('a malformed token counts as expired (refresh, never CONNECT with garbage)', async () => {
    const { stompService } = await freshService('not-a-jwt')
    const p = stompService.connect('not-a-jwt')
    await last().simulateConnect()
    await p
    expect(h.refresh).toHaveBeenCalledTimes(1)
    expect(last().connectHeaders.Authorization).toBe('Bearer fresh-token')
  })

  it('falls back to the connect() token when the store has none', async () => {
    const { stompService } = await freshService(null)
    const p = stompService.connect(FRESH)
    await last().simulateConnect()
    await p
    expect(last().connectHeaders.Authorization).toBe(`Bearer ${FRESH}`)
  })

  it('a refresh the server rejects stops the reconnect loop and forces logout', async () => {
    const err = Object.assign(new Error('401'), { response: { status: 401 } })
    h.refresh.mockRejectedValue(err)
    h.authFailure.mockReturnValue(true)
    const { stompService } = await freshService(EXPIRING)
    void stompService.connect(EXPIRING)
    const c = last()
    await c.simulateConnect()
    expect(c.deactivate).toHaveBeenCalled()
    expect(h.forceLogout).toHaveBeenCalledWith(err)
    expect(c.connectHeaders).toEqual({})
    expect(stompService.isConnected()).toBe(false)
  })

  it('a transient refresh failure keeps the session: no logout, no deactivate', async () => {
    h.refresh.mockRejectedValue(new Error('Network Error'))
    const { stompService, useAuthStore } = await freshService(EXPIRING)
    void stompService.connect(EXPIRING)
    const c = last()
    await c.config.beforeConnect?.()
    expect(h.forceLogout).not.toHaveBeenCalled()
    expect(c.deactivate).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).toEqual(USER)
  })

  it('after a STOMP ERROR frame the next attempt refreshes even with a fresh-looking token', async () => {
    const renewed = jwt(3600)
    h.refresh.mockResolvedValue(renewed)
    const { stompService } = await freshService(FRESH)
    const p = stompService.connect(FRESH)
    const c = last()
    c.config.onStompError?.({ command: 'ERROR' })
    await expect(p).rejects.toThrow('ERROR')

    await c.config.beforeConnect?.()
    expect(h.refresh).toHaveBeenCalledTimes(1)
    expect(c.connectHeaders.Authorization).toBe(`Bearer ${renewed}`)

    // Refreshed once — the following attempt does not churn another refresh.
    await c.config.beforeConnect?.()
    expect(h.refresh).toHaveBeenCalledTimes(1)
  })

  it('connect() replaces an existing client instead of leaking a second socket', async () => {
    const { stompService } = await freshService(FRESH)
    void stompService.connect(FRESH)
    const first = last()
    void stompService.connect(FRESH)
    expect(first.deactivate).toHaveBeenCalled()
    expect(h.created).toHaveLength(2)
  })
})

describe('connection state', () => {
  it('waitForConnect resolves on connect; listeners see connect / disconnect', async () => {
    const { stompService } = await freshService()
    const states: boolean[] = []
    const off = stompService.onStateChange((c) => states.push(c))
    expect(states).toEqual([false]) // initial state

    const waiting = stompService.waitForConnect()
    void stompService.connect(FRESH)
    await last().simulateConnect()
    await expect(waiting).resolves.toBeUndefined()
    await expect(stompService.waitForConnect()).resolves.toBeUndefined()

    last().config.onDisconnect?.()
    last().config.onWebSocketClose?.()
    expect(states).toEqual([false, true, false, false])

    off()
    stompService.disconnect()
    expect(states).toHaveLength(4)
  })

  it('disconnect() deactivates and reports disconnected', async () => {
    const { stompService } = await freshService()
    void stompService.connect(FRESH)
    const c = last()
    await c.simulateConnect()
    expect(stompService.isConnected()).toBe(true)
    stompService.disconnect()
    expect(c.deactivate).toHaveBeenCalled()
    expect(stompService.isConnected()).toBe(false)
  })
})

describe('guarded transmit', () => {
  it('publish is a no-op when disconnected and JSON-encodes when connected', async () => {
    const { stompService } = await freshService()
    stompService.publish('/app/x', { a: 1 }) // no client at all
    void stompService.connect(FRESH)
    const c = last()
    stompService.publish('/app/x', { a: 1 }) // client, not connected
    expect(c.published).toEqual([])
    await c.simulateConnect()
    stompService.publish('/app/chat.send', { a: 1 })
    expect(c.published).toEqual([{ destination: '/app/chat.send', body: '{"a":1}' }])
  })

  it('publish swallows a socket that closed mid-send', async () => {
    const { stompService } = await freshService()
    void stompService.connect(FRESH)
    const c = last()
    await c.simulateConnect()
    c.publishThrows = true
    expect(() => stompService.publish('/app/x', {})).not.toThrow()
  })

  it('subscribe returns undefined on a dead socket; unsubscribe after close is a no-op', async () => {
    const { stompService } = await freshService()
    expect(stompService.subscribe('/topic/a', () => {})).toBeUndefined()

    void stompService.connect(FRESH)
    const c = last()
    await c.simulateConnect()
    const sub = stompService.subscribe('/topic/a', () => {})!
    const inner = c.subscribe.mock.results[0].value as { unsubscribe: ReturnType<typeof vi.fn> }

    c.connected = false
    sub.unsubscribe()
    expect(inner.unsubscribe).not.toHaveBeenCalled()

    c.connected = true
    inner.unsubscribe.mockImplementation(() => {
      throw new Error('closed')
    })
    expect(() => sub.unsubscribe()).not.toThrow()
    expect(inner.unsubscribe).toHaveBeenCalledTimes(1)
  })
})

describe('resolveBrokerURL', () => {
  it('uses the env URL when set, otherwise derives ws(s)://<host>/ws from the page', async () => {
    const { resolveBrokerURL } = await import('@/lib/stomp/client')
    expect(resolveBrokerURL()).toBe('ws://test/ws')

    h.wsUrl = undefined
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveBrokerURL()).toBe(`ws://${window.location.host}/ws`)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
