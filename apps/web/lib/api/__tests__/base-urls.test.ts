import { describe, it, expect, afterEach, vi } from 'vitest'

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

describe('NEXT_PUBLIC_API_BASE — one variable per environment', () => {
  const ENV = { ...process.env }
  afterEach(() => {
    process.env = { ...ENV }
    vi.resetModules()
  })

  const withApiBase = async (base: string) => {
    for (const k of [
      'NEXT_PUBLIC_AUTH_URL',
      'NEXT_PUBLIC_CHAT_URL',
      'NEXT_PUBLIC_AI_URL',
      'NEXT_PUBLIC_CONNECTOR_URL',
      'NEXT_PUBLIC_WS_URL',
    ]) {
      delete process.env[k]
    }
    process.env.NEXT_PUBLIC_API_BASE = base
    vi.resetModules()
    return import('../../config/env')
  }

  it('derives every service route from the single base', async () => {
    const env = await withApiBase('https://api.example.com')
    expect(env.AUTH_URL).toBe('https://api.example.com/api/auth')
    expect(env.CHAT_URL).toBe('https://api.example.com/api/chat')
    expect(env.AI_URL).toBe('https://api.example.com/api/ai')
    expect(env.CONNECTOR_URL).toBe('https://api.example.com/api/connector')
  })

  it('derives the websocket URL, so a tunnel rename is one variable', async () => {
    const env = await withApiBase('https://tunnel.example.com')
    expect(env.wsUrlFromEnv()).toBe('wss://tunnel.example.com/ws')
  })

  it('tolerates a trailing slash', async () => {
    const env = await withApiBase('https://api.example.com/')
    expect(env.AUTH_URL).toBe('https://api.example.com/api/auth')
  })

  it('lets a per-service URL override the base', async () => {
    await withApiBase('https://api.example.com')
    process.env.NEXT_PUBLIC_CHAT_URL = 'http://localhost:8080'
    vi.resetModules()
    const env = await import('../../config/env')
    expect(env.CHAT_URL).toBe('http://localhost:8080')
    expect(env.AUTH_URL).toBe('https://api.example.com/api/auth')
  })

  it('falls back to same-origin paths when nothing is configured', async () => {
    delete process.env.NEXT_PUBLIC_API_BASE
    delete process.env.NEXT_PUBLIC_AUTH_URL
    delete process.env.NEXT_PUBLIC_WS_URL
    vi.resetModules()
    const env = await import('../../config/env')
    expect(env.AUTH_URL).toBe('/api/auth')
    expect(env.wsUrlFromEnv()).toBeUndefined()
    expect(env.usesSameOriginFallback).toBe(true)
  })

  it('resolves a relative base against the request origin on the server', async () => {
    delete process.env.NEXT_PUBLIC_API_BASE
    delete process.env.NEXT_PUBLIC_AUTH_URL
    vi.resetModules()
    const env = await import('../../config/env')
    expect(env.serverAuthUrl('https://pon.acme.com/api/auth/session')).toBe(
      'https://pon.acme.com/api/auth',
    )
  })
})
