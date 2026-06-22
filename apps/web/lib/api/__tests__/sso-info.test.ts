import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../axios', () => ({
  authApi: {
    get: vi.fn(async () => ({
      data: { enabled: true, loginUrl: '/auth/oidc/login', buttonLabel: 'Sign in with SSO' },
    })),
  },
}))

afterEach(() => vi.resetModules())

describe('authService.getSsoInfo', () => {
  it('returns the sso info payload', async () => {
    const { authService } = await import('../auth')
    const info = await authService.getSsoInfo()
    expect(info.enabled).toBe(true)
    expect(info.loginUrl).toBe('/auth/oidc/login')
    expect(info.buttonLabel).toBe('Sign in with SSO')
  })
})
