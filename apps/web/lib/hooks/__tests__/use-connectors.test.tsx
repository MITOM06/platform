import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { makeQueryWrapper } from '@/test/query-wrapper'
import { useAuthStore } from '@/lib/store/auth.store'

const h = vi.hoisted(() => ({
  svc: {
    getCatalog: vi.fn(), getConnections: vi.fn(), disconnect: vi.fn(), saveCustomMcp: vi.fn(),
    deleteCustomMcp: vi.fn(), updateConnectionPermissions: vi.fn(), listCustomMcp: vi.fn(),
    getDirectory: vi.fn(), createDirectoryEntry: vi.fn(), updateDirectoryEntry: vi.fn(),
    deleteDirectoryEntry: vi.fn(), getSkills: vi.fn(), setSkill: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@/lib/api/connector', () => ({ connectorService: h.svc }))

import {
  useCatalog, useConnections, useConnectorActions, useCustomMcpServers, useProviderNameSources,
  useDirectory, useDirectoryAdmin, useSkills, useSkillToggle,
} from '@/lib/hooks/use-connectors'

const httpErr = (status: number, code?: string) => {
  const e = new AxiosError('x')
  e.response = { status, data: code ? { code } : {} } as AxiosResponse
  return e
}

beforeEach(() => {
  for (const fn of Object.values(h.svc)) fn.mockReset().mockResolvedValue([])
  h.toast.success.mockReset(); h.toast.error.mockReset()
  useAuthStore.setState({ user: { id: 'u1' } as never, accessToken: 't' })
})

describe('connector queries', () => {
  it('useCatalog / useDirectory fetch global lists', async () => {
    h.svc.getCatalog.mockResolvedValue([{ id: 'gmail' }])
    h.svc.getDirectory.mockResolvedValue([{ slug: 'notion' }])
    const { wrapper } = makeQueryWrapper()
    const c = renderHook(() => useCatalog(), { wrapper })
    const d = renderHook(() => useDirectory(), { wrapper })
    await waitFor(() => expect(c.result.current.data).toEqual([{ id: 'gmail' }]))
    await waitFor(() => expect(d.result.current.data).toEqual([{ slug: 'notion' }]))
  })

  it('useCatalog(false) never fetches', async () => {
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useCatalog(false), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(h.svc.getCatalog).not.toHaveBeenCalled()
  })

  it('per-user queries are disabled while signed out', () => {
    useAuthStore.setState({ user: null })
    const { wrapper } = makeQueryWrapper()
    renderHook(() => { useConnections(); useCustomMcpServers(); useSkills() }, { wrapper })
    expect(h.svc.getConnections).not.toHaveBeenCalled()
    expect(h.svc.listCustomMcp).not.toHaveBeenCalled()
    expect(h.svc.getSkills).not.toHaveBeenCalled()
  })

  it('per-user queries are keyed by user id', async () => {
    h.svc.getConnections.mockResolvedValue([{ id: 'c1' }])
    h.svc.getSkills.mockResolvedValue([{ skillId: 's' }])
    const { qc, wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => ({ c: useConnections(), s: useSkills() }), { wrapper })
    await waitFor(() => expect(result.current.c.data).toEqual([{ id: 'c1' }]))
    await waitFor(() => expect(result.current.s.data).toEqual([{ skillId: 's' }]))
    expect(qc.getQueryData(['connections', 'u1'])).toEqual([{ id: 'c1' }])
    expect(qc.getQueryData(['skills', 'u1'])).toEqual([{ skillId: 's' }])
  })

  it('useProviderNameSources aggregates the three lists', async () => {
    h.svc.getCatalog.mockResolvedValue([{ id: 'a' }])
    h.svc.getDirectory.mockResolvedValue([{ slug: 'b' }])
    h.svc.listCustomMcp.mockResolvedValue([{ id: 'c' }])
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useProviderNameSources(), { wrapper })
    await waitFor(() => expect(result.current).toEqual({
      catalog: [{ id: 'a' }], directory: [{ slug: 'b' }], customMcp: [{ id: 'c' }],
    }))
  })
})

describe('useConnectorActions', () => {
  function setup() {
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useConnectorActions(), { wrapper })
    return { result, inv }
  }

  it('disconnect success toasts and invalidates connections', async () => {
    h.svc.disconnect.mockResolvedValue(undefined)
    const { result, inv } = setup()
    await act(async () => { await result.current.disconnect.mutateAsync('c1') })
    expect(h.svc.disconnect).toHaveBeenCalledWith('c1')
    expect(h.toast.success).toHaveBeenCalledWith('disconnectSuccess')
    expect(inv).toHaveBeenCalledWith({ queryKey: ['connections', 'u1'] })
  })

  it('disconnect 403 shows the permission message and still refreshes', async () => {
    h.svc.disconnect.mockRejectedValue(httpErr(403))
    const { result, inv } = setup()
    await act(async () => { await result.current.disconnect.mutateAsync('c1').catch(() => {}) })
    expect(h.toast.error).toHaveBeenCalledWith('errInsufficientPermission')
    expect(inv).toHaveBeenCalledWith({ queryKey: ['connections', 'u1'] })
  })

  it('saveCustomMcp invalidates connections and my custom servers', async () => {
    h.svc.saveCustomMcp.mockResolvedValue({ id: 'm' })
    const { result, inv } = setup()
    await act(async () => { await result.current.saveCustomMcp.mutateAsync({ url: 'u' } as never) })
    expect(h.toast.success).toHaveBeenCalledWith('customSaveSuccess')
    expect(inv).toHaveBeenCalledWith({ queryKey: ['connections', 'u1', 'custom-mcp'] })
  })

  it('saveCustomMcp network error → errNetwork; non-axios → fallback key', async () => {
    h.svc.saveCustomMcp.mockRejectedValueOnce(new AxiosError('net'))
    const { result } = setup()
    await act(async () => { await result.current.saveCustomMcp.mutateAsync({} as never).catch(() => {}) })
    expect(h.toast.error).toHaveBeenLastCalledWith('errNetwork')
    h.svc.saveCustomMcp.mockRejectedValueOnce(new Error('boom'))
    await act(async () => { await result.current.saveCustomMcp.mutateAsync({} as never).catch(() => {}) })
    expect(h.toast.error).toHaveBeenLastCalledWith('customSaveError')
  })

  it('deleteCustomMcp success and failure', async () => {
    const { result, inv } = setup()
    await act(async () => { await result.current.deleteCustomMcp.mutateAsync('m1') })
    expect(h.svc.deleteCustomMcp).toHaveBeenCalledWith('m1')
    expect(h.toast.success).toHaveBeenCalledWith('customDeleteSuccess')
    expect(inv).toHaveBeenCalledWith({ queryKey: ['connections', 'u1', 'custom-mcp'] })
    h.svc.deleteCustomMcp.mockRejectedValueOnce(httpErr(429))
    await act(async () => { await result.current.deleteCustomMcp.mutateAsync('m1').catch(() => {}) })
    expect(h.toast.error).toHaveBeenCalledWith('errRateLimited')
  })

  it('updatePermissions success and failure', async () => {
    const { result, inv } = setup()
    await act(async () => {
      await result.current.updatePermissions.mutateAsync({ id: 'c1', actionGroups: ['read'] as never, autoRun: true })
    })
    expect(h.svc.updateConnectionPermissions).toHaveBeenCalledWith('c1', ['read'], true)
    expect(h.toast.success).toHaveBeenCalledWith('permSaved')
    expect(inv).toHaveBeenCalledWith({ queryKey: ['connections', 'u1'] })
    h.svc.updateConnectionPermissions.mockRejectedValueOnce(new Error('x'))
    await act(async () => {
      await result.current.updatePermissions.mutateAsync({ id: 'c1', actionGroups: [], autoRun: false }).catch(() => {})
    })
    expect(h.toast.error).toHaveBeenCalledWith('permSaveError')
  })
})

describe('useDirectoryAdmin', () => {
  it('create / update / remove toast and invalidate the directory', async () => {
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDirectoryAdmin(), { wrapper })
    await act(async () => { await result.current.create.mutateAsync({ slug: 's' } as never) })
    expect(h.svc.createDirectoryEntry).toHaveBeenCalledWith({ slug: 's' })
    await act(async () => { await result.current.update.mutateAsync({ id: 'd1', input: { name: 'n' } as never }) })
    expect(h.svc.updateDirectoryEntry).toHaveBeenCalledWith('d1', { name: 'n' })
    await act(async () => { await result.current.remove.mutateAsync('d1') })
    expect(h.svc.deleteDirectoryEntry).toHaveBeenCalledWith('d1')
    expect(h.toast.success.mock.calls.map((c) => c[0])).toEqual([
      'directorySaveSuccess', 'directorySaveSuccess', 'directoryDeleteSuccess',
    ])
    expect(inv).toHaveBeenCalledTimes(3)
    expect(inv).toHaveBeenCalledWith({ queryKey: ['connector-directory'] })
  })

  it('failures show the directory error keys', async () => {
    h.svc.createDirectoryEntry.mockRejectedValue(new Error('x'))
    h.svc.updateDirectoryEntry.mockRejectedValue(new Error('x'))
    h.svc.deleteDirectoryEntry.mockRejectedValue(new Error('x'))
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useDirectoryAdmin(), { wrapper })
    await act(async () => {
      await result.current.create.mutateAsync({} as never).catch(() => {})
      await result.current.update.mutateAsync({ id: 'd', input: {} as never }).catch(() => {})
      await result.current.remove.mutateAsync('d').catch(() => {})
    })
    expect(h.toast.error.mock.calls.map((c) => c[0])).toEqual([
      'directorySaveError', 'directorySaveError', 'directoryDeleteError',
    ])
    expect(h.toast.success).not.toHaveBeenCalled()
  })
})

describe('useSkillToggle', () => {
  it('invalidates the skills query on success and toasts on failure', async () => {
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useSkillToggle(), { wrapper })
    await act(async () => { await result.current.mutateAsync({ skillId: 's1', enabled: true }) })
    expect(h.svc.setSkill).toHaveBeenCalledWith('s1', true)
    expect(inv).toHaveBeenCalledWith({ queryKey: ['skills', 'u1'] })
    h.svc.setSkill.mockRejectedValueOnce(new Error('x'))
    await act(async () => { await result.current.mutateAsync({ skillId: 's1', enabled: false }).catch(() => {}) })
    expect(h.toast.error).toHaveBeenCalledWith('toggleError')
  })
})
