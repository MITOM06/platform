import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { makeQueryWrapper } from '@/test/query-wrapper'

const h = vi.hoisted(() => ({
  svc: { listDepartments: vi.fn(), listInvitations: vi.fn(), listRoles: vi.fn(), deleteRole: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k, useLocale: () => 'en' }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@/lib/api/admin', () => ({ adminService: h.svc }))

import { useDepartments, useInvitations, useRoles, useRoleActions } from '@/lib/hooks/use-admin'

beforeEach(() => {
  for (const f of Object.values(h.svc)) f.mockReset()
  h.toast.success.mockReset(); h.toast.error.mockReset()
})

describe('admin list queries', () => {
  it('load when enabled and stay idle when not', async () => {
    h.svc.listDepartments.mockResolvedValue([{ _id: 'd' }])
    h.svc.listInvitations.mockResolvedValue([{ id: 'i' }])
    h.svc.listRoles.mockResolvedValue([{ id: 'r' }])
    const { wrapper } = makeQueryWrapper()
    renderHook(() => { useDepartments(false); useInvitations(false); useRoles(false) }, { wrapper })
    expect(h.svc.listDepartments).not.toHaveBeenCalled()
    expect(h.svc.listInvitations).not.toHaveBeenCalled()
    expect(h.svc.listRoles).not.toHaveBeenCalled()
    const { result } = renderHook(() => ({ d: useDepartments(), i: useInvitations(), r: useRoles() }), { wrapper })
    await waitFor(() => expect(result.current.r.data).toEqual([{ id: 'r' }]))
    expect(result.current.d.data).toEqual([{ _id: 'd' }])
    expect(result.current.i.data).toEqual([{ id: 'i' }])
  })
})

describe('useRoleActions.remove', () => {
  it('deletes, invalidates roles and toasts', async () => {
    h.svc.deleteRole.mockResolvedValue(undefined)
    const { qc, wrapper } = makeQueryWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRoleActions(), { wrapper })
    await act(async () => { await result.current.remove.mutateAsync('r1') })
    expect(h.svc.deleteRole).toHaveBeenCalledWith('r1')
    expect(inv).toHaveBeenCalledWith({ queryKey: ['admin-roles'] })
    expect(h.toast.success).toHaveBeenCalledWith('toastDeleted')
  })

  it('a failure shows an error toast, never success', async () => {
    h.svc.deleteRole.mockRejectedValue(new Error('x'))
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useRoleActions(), { wrapper })
    await act(async () => { await result.current.remove.mutateAsync('r1').catch(() => {}) })
    expect(h.toast.error).toHaveBeenCalledTimes(1)
    expect(h.toast.success).not.toHaveBeenCalled()
  })
})
