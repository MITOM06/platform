import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('axios base URL defaults', () => {
  const ENV = { ...process.env }
  afterEach(() => {
    process.env = { ...ENV }
    vi.resetModules()
  })

  it('falls back to same-origin relative paths when env is unset', async () => {
    delete process.env.NEXT_PUBLIC_AUTH_URL
    delete process.env.NEXT_PUBLIC_CHAT_URL
    delete process.env.NEXT_PUBLIC_CONNECTOR_URL
    vi.resetModules()
    const { authApi, chatApi, connectorApi } = await import('../axios')
    expect(authApi.defaults.baseURL).toBe('/api/auth')
    expect(chatApi.defaults.baseURL).toBe('/api/chat')
    expect(connectorApi.defaults.baseURL).toBe('/api/connector')
  })

  it('honors explicit env URLs (Cloud Run / local dev) when set', async () => {
    process.env.NEXT_PUBLIC_AUTH_URL = 'http://localhost:3001'
    vi.resetModules()
    const { authApi } = await import('../axios')
    expect(authApi.defaults.baseURL).toBe('http://localhost:3001')
  })
})

describe('resolveBrokerURL', () => {
  const ENV = { ...process.env }
  afterEach(() => {
    process.env = { ...ENV }
    vi.resetModules()
  })

  it('prefers NEXT_PUBLIC_WS_URL when set', async () => {
    process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:8080/ws'
    vi.resetModules()
    const { resolveBrokerURL } = await import('../../stomp/client')
    expect(resolveBrokerURL()).toBe('ws://localhost:8080/ws')
  })

  it('derives wss from window.location when env unset', async () => {
    delete process.env.NEXT_PUBLIC_WS_URL
    vi.stubGlobal('window', { location: { protocol: 'https:', host: 'pon.acme.com' } })
    vi.resetModules()
    const { resolveBrokerURL } = await import('../../stomp/client')
    expect(resolveBrokerURL()).toBe('wss://pon.acme.com/ws')
    vi.unstubAllGlobals()
  })
})
