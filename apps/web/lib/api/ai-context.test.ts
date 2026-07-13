import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authApi } from './axios'
import { aiContextService, tierToCapability, capabilityToTier } from './ai-context'

vi.mock('./axios', () => ({
  authApi: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

describe('aiContextService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getMine GETs /ai-context/me', async () => {
    ;(authApi.get as any).mockResolvedValue({
      data: { context: { style: 's' }, identity: { role: 'Manager', departmentNames: [] }, entries: [] },
    })
    const res = await aiContextService.getMine()
    expect(authApi.get).toHaveBeenCalledWith('/ai-context/me')
    expect(res.identity.role).toBe('Manager')
  })

  it('updateMyStyle PATCHes /ai-context/me/style', async () => {
    ;(authApi.patch as any).mockResolvedValue({ data: { style: 'brief' } })
    await aiContextService.updateMyStyle({ style: 'brief' })
    expect(authApi.patch).toHaveBeenCalledWith('/ai-context/me/style', { style: 'brief' })
  })

  it('maps tier ↔ requiredCapability', () => {
    expect(tierToCapability('public')).toBeNull()
    expect(tierToCapability('internal')).toBe('VIEW_INTERNAL_CONTEXT')
    expect(tierToCapability('confidential')).toBe('VIEW_CONFIDENTIAL_CONTEXT')
    expect(capabilityToTier(null)).toBe('public')
    expect(capabilityToTier('VIEW_CONFIDENTIAL_CONTEXT')).toBe('confidential')
    expect(capabilityToTier('VIEW_INTERNAL_CONTEXT')).toBe('internal')
  })
})
