import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { forceLogout } from '@/lib/auth/force-logout'
import { performLogout } from '@/lib/auth/logout'
import { isSsoReauthDue, markSsoReauth } from '@/lib/auth/sso-reauth'

const serverLogout = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/auth', () => ({ authService: { logout: () => serverLogout() } }))
vi.mock('@/lib/stomp/client', () => ({ stompService: { disconnect: vi.fn() } }))
vi.mock('@/lib/query-client', () => ({ clearQueryCache: vi.fn() }))
vi.mock('axios', async (original) => {
  const actual = await original<typeof import('axios')>()
  return { default: { ...actual.default, post: vi.fn(() => Promise.resolve({})) } }
})

describe('sign-out and the "re-authenticate on the next SSO" flag', () => {
  const realLocation = window.location
  const assign = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    serverLogout.mockResolvedValue({})
    Object.defineProperty(window, 'location', { configurable: true, value: { assign, href: '' } })
  })
  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  })

  it('a user-initiated sign-out sets it', async () => {
    await performLogout()
    expect(isSsoReauthDue()).toBe(true)
    expect(assign).toHaveBeenCalledWith('/login?cleared=1')
  })

  it('is set even when the server refuses the logout', async () => {
    serverLogout.mockRejectedValue(new Error('offline'))
    await performLogout()
    expect(isSsoReauthDue()).toBe(true)
  })

  it('is set before the server answers, so closing the tab meanwhile cannot skip it', async () => {
    vi.useFakeTimers()
    serverLogout.mockReturnValue(new Promise(() => {}))
    const pending = performLogout()
    expect(isSsoReauthDue()).toBe(true)
    await vi.runAllTimersAsync()
    await pending
  })

  it('a forced logout (session died, nobody chose to leave) does not set it', async () => {
    await forceLogout()
    expect(isSsoReauthDue()).toBe(false)
  })

  it('a forced logout does not clear one that is already set', async () => {
    markSsoReauth()
    await forceLogout()
    expect(isSsoReauthDue()).toBe(true)
  })
})
