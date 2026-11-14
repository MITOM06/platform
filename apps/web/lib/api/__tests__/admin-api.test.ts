import { describe, it, expect, vi, beforeEach } from 'vitest'

const http = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
}))
vi.mock('@/lib/api/axios', () => ({ authApi: http }))

import { adminService } from '@/lib/api/admin'

beforeEach(() => {
  for (const fn of Object.values(http)) fn.mockReset().mockResolvedValue({ data: { ok: 1 } })
})

describe('adminService — plain passthrough routes', () => {
  it.each([
    ['getCapabilities', [], 'get', ['/me/capabilities']],
    ['getWorkspace', [], 'get', ['/admin/workspace']],
    ['updateWorkspace', [{ name: 'W' }], 'patch', ['/admin/workspace', { name: 'W' }]],
    ['createDepartment', [{ name: 'D' }], 'post', ['/admin/departments', { name: 'D' }]],
    ['updateDepartment', ['d1', { name: 'D2' }], 'patch', ['/admin/departments/d1', { name: 'D2' }]],
    ['deleteDepartment', ['d1'], 'delete', ['/admin/departments/d1']],
    ['updateMember', ['u1', { title: 'x' }], 'patch', ['/admin/members/u1', { title: 'x' }]],
    ['setMemberStatus', ['u1', 'SUSPENDED'], 'patch', ['/admin/members/u1/status', { status: 'SUSPENDED' }]],
    ['resetMemberMfa', ['u1'], 'post', ['/admin/members/u1/mfa/reset']],
    ['createInvitation', [{ email: 'a@b.c' }], 'post', ['/admin/invitations', { email: 'a@b.c' }]],
    ['resendInvitation', ['i1'], 'post', ['/admin/invitations/i1/resend']],
    ['revokeInvitation', ['i1'], 'delete', ['/admin/invitations/i1']],
    ['createRole', [{ name: 'R' }], 'post', ['/admin/roles', { name: 'R' }]],
    ['updateRole', ['r1', { name: 'R2' }], 'patch', ['/admin/roles/r1', { name: 'R2' }]],
  ] as const)('%s calls %s and unwraps data', async (name, args, method, expected) => {
    const fn = adminService[name] as (...a: unknown[]) => Promise<unknown>
    await expect(fn(...args)).resolves.toEqual({ ok: 1 })
    expect(http[method]).toHaveBeenCalledWith(...expected)
  })

  it('deleteRole resolves to undefined regardless of body', async () => {
    await expect(adminService.deleteRole('r1')).resolves.toBeUndefined()
    expect(http.delete).toHaveBeenCalledWith('/admin/roles/r1')
  })

  it('getAudit defaults to page 0 / limit 20 and forwards explicit values', async () => {
    await adminService.getAudit()
    expect(http.get).toHaveBeenLastCalledWith('/admin/audit', { params: { page: 0, limit: 20 } })
    await adminService.getAudit(3, 50)
    expect(http.get).toHaveBeenLastCalledWith('/admin/audit', { params: { page: 3, limit: 50 } })
  })

  it('propagates API errors (403) from the underlying client', async () => {
    const err = Object.assign(new Error('forbidden'), { response: { status: 403 } })
    http.get.mockRejectedValueOnce(err)
    await expect(adminService.getWorkspace()).rejects.toBe(err)
  })
})

describe('adminService — list routes coerce non-arrays to []', () => {
  const lists = [
    ['listDepartments', '/admin/departments'],
    ['listMembers', '/admin/members'],
    ['listRoles', '/admin/roles'],
  ] as const

  it.each(lists)('%s passes arrays through', async (name, url) => {
    http.get.mockResolvedValue({ data: [{ id: 'x' }] })
    await expect(adminService[name]()).resolves.toEqual([{ id: 'x' }])
    expect(http.get).toHaveBeenCalledWith(url)
  })

  it.each(lists)('%s returns [] for an HTML body', async (name) => {
    http.get.mockResolvedValue({ data: '<html>' })
    await expect(adminService[name]()).resolves.toEqual([])
  })

  it('listInvitations sends the status filter only when given', async () => {
    http.get.mockResolvedValue({ data: [{ id: 'i' }] })
    await expect(adminService.listInvitations()).resolves.toEqual([{ id: 'i' }])
    expect(http.get).toHaveBeenLastCalledWith('/admin/invitations', { params: undefined })
    await adminService.listInvitations('PENDING' as never)
    expect(http.get).toHaveBeenLastCalledWith('/admin/invitations', { params: { status: 'PENDING' } })
    http.get.mockResolvedValue({ data: null })
    await expect(adminService.listInvitations()).resolves.toEqual([])
  })
})
