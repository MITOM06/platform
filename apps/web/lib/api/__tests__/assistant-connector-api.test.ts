import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'

const apis = vi.hoisted(() => {
  const m = () => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() })
  return { chatApi: m(), authApi: m(), connectorApi: m() }
})
vi.mock('@/lib/api/axios', () => apis)

import {
  assistantErrorKey, fetchAssistant, setupAssistant, deleteAssistant, fetchAssistantProviders,
} from '@/lib/api/assistant'
import { connectorService } from '@/lib/api/connector'
import { aiContextService, tierToCapability, capabilityToTier } from '@/lib/api/ai-context'

beforeEach(() => {
  for (const api of Object.values(apis)) for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue({ data: 'D' })
})

const httpErr = (status: number, data?: unknown) => {
  const e = new AxiosError('fail')
  e.response = { status, data } as AxiosResponse
  return e
}

describe('assistantErrorKey', () => {
  it('non-axios error → errGeneric', () => expect(assistantErrorKey(new Error('x'))).toBe('errGeneric'))
  it('no response → errNetwork', () => expect(assistantErrorKey(new AxiosError('net'))).toBe('errNetwork'))
  it('maps known codes', () => {
    expect(assistantErrorKey(httpErr(400, { code: 'ASSISTANT_SETUP_INCOMPLETE' }))).toBe('errSetupIncomplete')
    expect(assistantErrorKey(httpErr(400, { code: 'ASSISTANT_NOT_CONFIGURED' }))).toBe('errNotConfigured')
    expect(assistantErrorKey(httpErr(400, { code: 'ASSISTANT_UPSTREAM_FAILED' }))).toBe('errUpstreamFailed')
  })
  it('falls back to status', () => {
    expect(assistantErrorKey(httpErr(503, { code: 'UNKNOWN' }))).toBe('errNotConfigured')
    expect(assistantErrorKey(httpErr(502))).toBe('errUpstreamFailed')
    expect(assistantErrorKey(httpErr(500, { code: 7 }))).toBe('errGeneric')
  })
})

describe('assistant client', () => {
  it('fetchAssistant returns data, null on 404, rethrows others', async () => {
    apis.chatApi.get.mockResolvedValueOnce({ data: { botUserId: 'b', name: 'N' } })
    await expect(fetchAssistant()).resolves.toEqual({ botUserId: 'b', name: 'N' })
    expect(apis.chatApi.get).toHaveBeenLastCalledWith('/api/assistant/me')
    apis.chatApi.get.mockRejectedValueOnce(httpErr(404))
    await expect(fetchAssistant()).resolves.toBeNull()
    const e = httpErr(401)
    apis.chatApi.get.mockRejectedValueOnce(e)
    await expect(fetchAssistant()).rejects.toBe(e)
    const net = new Error('network')
    apis.chatApi.get.mockRejectedValueOnce(net)
    await expect(fetchAssistant()).rejects.toBe(net)
  })
  it('setupAssistant / deleteAssistant', async () => {
    await expect(setupAssistant({ name: 'A' })).resolves.toBe('D')
    expect(apis.chatApi.post).toHaveBeenLastCalledWith('/api/assistant/setup', { name: 'A' })
    await expect(deleteAssistant()).resolves.toBeUndefined()
    expect(apis.chatApi.delete).toHaveBeenLastCalledWith('/api/assistant/setup')
  })
  it('fetchAssistantProviders coerces non-arrays', async () => {
    apis.chatApi.get.mockResolvedValueOnce({ data: [{ id: 'p' }] })
    await expect(fetchAssistantProviders()).resolves.toEqual([{ id: 'p' }])
    apis.chatApi.get.mockResolvedValueOnce({ data: '<html>' })
    await expect(fetchAssistantProviders()).resolves.toEqual([])
  })
})

describe('connectorService remaining routes', () => {
  it.each([
    ['startOAuth', ['gmail'], 'get', ['/oauth/gmail/start']],
    ['disconnect', ['c1'], 'delete', ['/connections/c1']],
    ['getConnectionPermissions', ['c1'], 'get', ['/connections/c1/permissions']],
    ['updateConnectionPermissions', ['c1', ['read'], true], 'put', ['/connections/c1/permissions', { actionGroups: ['read'], autoRun: true }]],
    ['discoverCustomMcp', [{ url: 'u' }], 'post', ['/custom-mcp/discover', { url: 'u' }]],
    ['saveCustomMcp', [{ url: 'u' }], 'post', ['/custom-mcp', { url: 'u' }]],
    ['deleteCustomMcp', ['a/b'], 'delete', ['/custom-mcp/a%2Fb']],
    ['setSkill', ['s1', false], 'put', ['/skills', { skillId: 's1', enabled: false }]],
    ['startDirectoryOAuth', ['notion'], 'get', ['/oauth/directory/notion/start']],
    ['connectDirectoryKey', ['notion', 'k'], 'post', ['/oauth/directory/notion/connect-key', { credential: 'k' }]],
    ['createDirectoryEntry', [{ slug: 's' }], 'post', ['/directory', { slug: 's' }]],
    ['updateDirectoryEntry', ['d1', { name: 'n' }], 'patch', ['/directory/d1', { name: 'n' }]],
    ['deleteDirectoryEntry', ['d1'], 'delete', ['/directory/d1']],
  ] as const)('%s', async (name, args, method, expected) => {
    const fn = connectorService[name] as (...a: unknown[]) => Promise<unknown>
    await expect(fn(...args)).resolves.toBe('D')
    expect(apis.connectorApi[method]).toHaveBeenCalledWith(...expected)
  })

  it.each([['listCustomMcp', '/custom-mcp'], ['getDirectory', '/directory']] as const)(
    '%s coerces non-arrays', async (name, url) => {
      apis.connectorApi.get.mockResolvedValueOnce({ data: [1] })
      await expect(connectorService[name]()).resolves.toEqual([1])
      expect(apis.connectorApi.get).toHaveBeenLastCalledWith(url)
      apis.connectorApi.get.mockResolvedValueOnce({ data: { x: 1 } })
      await expect(connectorService[name]()).resolves.toEqual([])
    })
})

describe('ai-context', () => {
  it('tier ↔ capability mapping round-trips', () => {
    expect(tierToCapability('public')).toBeNull()
    expect(tierToCapability('internal')).toBe('VIEW_INTERNAL_CONTEXT')
    expect(tierToCapability('confidential')).toBe('VIEW_CONFIDENTIAL_CONTEXT')
    expect(capabilityToTier(null)).toBe('public')
    expect(capabilityToTier('VIEW_INTERNAL_CONTEXT')).toBe('internal')
    expect(capabilityToTier('VIEW_CONFIDENTIAL_CONTEXT')).toBe('confidential')
    expect(capabilityToTier('OTHER')).toBe('public')
  })
  it('service routes', async () => {
    await expect(aiContextService.getMine()).resolves.toBe('D')
    expect(apis.authApi.get).toHaveBeenLastCalledWith('/ai-context/me')
    await aiContextService.updateMyStyle({ style: 's' })
    expect(apis.authApi.patch).toHaveBeenLastCalledWith('/ai-context/me/style', { style: 's' })
    await aiContextService.getUser('u1')
    expect(apis.authApi.get).toHaveBeenLastCalledWith('/ai-context/users/u1')
    await aiContextService.updateUserHard('u1', { jobTitle: 'J' })
    expect(apis.authApi.patch).toHaveBeenLastCalledWith('/ai-context/users/u1/hard', { jobTitle: 'J' })
    await aiContextService.listEntries('department', 'd1')
    expect(apis.authApi.get).toHaveBeenLastCalledWith('/ai-context/entries', { params: { scope: 'department', scopeId: 'd1' } })
    const dto = { scope: 'company' as const, label: 'L', text: 'T' }
    await aiContextService.createEntry(dto)
    expect(apis.authApi.post).toHaveBeenLastCalledWith('/ai-context/entries', dto)
    await aiContextService.updateEntry('e1', dto)
    expect(apis.authApi.patch).toHaveBeenLastCalledWith('/ai-context/entries/e1', dto)
    await expect(aiContextService.deleteEntry('e1')).resolves.toBeUndefined()
    expect(apis.authApi.delete).toHaveBeenLastCalledWith('/ai-context/entries/e1')
  })
})
