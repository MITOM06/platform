/**
 * Admin console hooks: every mutation invalidates exactly its list (plus my own
 * capabilities when my claims may have changed), toasts a localized result, and
 * maps typed role-guard errors to their own message — never the raw server text.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'

const h = vi.hoisted(() => {
  const svc: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const name of [
    'getWorkspace', 'updateWorkspace', 'listDepartments', 'createDepartment', 'updateDepartment',
    'deleteDepartment', 'listMembers', 'updateMember', 'setMemberStatus', 'resetMemberMfa',
    'listInvitations', 'createInvitation', 'resendInvitation', 'revokeInvitation', 'listRoles',
    'createRole', 'updateRole', 'getAudit',
  ]) svc[name] = vi.fn()
  return {
    svc,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
    t: (k: string, v?: Record<string, unknown>) => (v ? `${k}(${JSON.stringify(v)})` : k),
  }
})
vi.mock('next-intl', () => ({ useTranslations: () => h.t, useLocale: () => 'en' }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@/lib/api/admin', () => ({ adminService: h.svc }))

import * as admin from '@/lib/hooks/use-admin'
import { useAuthStore } from '@/lib/store/auth.store'

let qc: QueryClient
let invalidated: unknown[][]

function wrap<T>(hook: () => T) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return renderHook(hook, { wrapper })
}

const authErr = (code: string, params?: unknown) =>
  new axios.AxiosError('Request failed', 'ERR', undefined, null, {
    status: 409, statusText: '', headers: {}, config: {} as never,
    data: { code, params, message: 'Internal: owner check failed at RoleGuard.java:42' },
  })

beforeEach(() => {
  vi.clearAllMocks()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  invalidated = []
  vi.spyOn(qc, 'invalidateQueries').mockImplementation((f) => {
    invalidated.push((f as { queryKey: unknown[] }).queryKey)
    return Promise.resolve()
  })
  Object.values(h.svc).forEach((fn) => fn.mockResolvedValue({}))
  useAuthStore.setState({ user: { id: 'me', email: 'a@b.c', displayName: 'Me' }, accessToken: 't' })
})

describe('queries', () => {
  it('each list reads its own service call; disabled queries do not fetch', async () => {
    h.svc.listMembers.mockResolvedValue([{ id: 'u1' }])
    const members = wrap(() => admin.useMembers())
    await waitFor(() => expect(members.result.current.data).toEqual([{ id: 'u1' }]))

    wrap(() => admin.useDepartments(false))
    wrap(() => admin.useRoles(false))
    wrap(() => admin.useInvitations(false))
    expect(h.svc.listDepartments).not.toHaveBeenCalled()
    expect(h.svc.listRoles).not.toHaveBeenCalled()
    expect(h.svc.listInvitations).not.toHaveBeenCalled()

    const audit = wrap(() => admin.useAuditLog(2, 50))
    await waitFor(() => expect(audit.result.current.isSuccess).toBe(true))
    expect(h.svc.getAudit).toHaveBeenCalledWith(2, 50)

    const ws = wrap(() => admin.useWorkspace())
    await waitFor(() => expect(ws.result.current.isSuccess).toBe(true))
  })
})

describe('mutations — invalidation + toasts', () => {
  it('workspace save refreshes workspace, my capabilities and SSO info', async () => {
    const { result } = wrap(() => admin.useUpdateWorkspace())
    await act(() => result.current.mutateAsync({ name: 'Acme' } as never))
    expect(invalidated).toEqual([['admin-workspace'], ['me-capabilities'], ['sso-info']])
    expect(h.toast.success).toHaveBeenCalledWith('toastSaved')
  })

  it('department create / update / delete', async () => {
    const { result } = wrap(() => admin.useDepartmentActions())
    await act(() => result.current.create.mutateAsync({ name: 'Eng' } as never))
    await act(() => result.current.update.mutateAsync({ id: 'd1', input: { name: 'E' } as never }))
    await act(() => result.current.remove.mutateAsync('d1'))
    expect(h.svc.updateDepartment).toHaveBeenCalledWith('d1', { name: 'E' })
    expect(h.svc.deleteDepartment).toHaveBeenCalledWith('d1')
    expect(invalidated).toEqual([['admin-departments'], ['admin-departments'], ['admin-departments']])
    expect(h.toast.success.mock.calls.map(([k]) => k)).toEqual(['toastSaved', 'toastSaved', 'toastDeleted'])
  })

  it('updating ANOTHER member does not refetch my capabilities; updating MYSELF does', async () => {
    const { result } = wrap(() => admin.useUpdateMember())
    await act(() => result.current.mutateAsync({ id: 'u2', input: {} as never }))
    expect(invalidated).toEqual([['admin-members']])
    invalidated = []
    await act(() => result.current.mutateAsync({ id: 'me', input: {} as never }))
    expect(invalidated).toEqual([['admin-members'], ['me-capabilities']])
  })

  it('block / unblock toasts the matching message', async () => {
    const { result } = wrap(() => admin.useSetMemberStatus())
    await act(() => result.current.mutateAsync({ id: 'u2', status: 'blocked' }))
    await act(() => result.current.mutateAsync({ id: 'u2', status: 'active' as never }))
    expect(h.svc.setMemberStatus).toHaveBeenCalledWith('u2', 'blocked')
    expect(h.toast.success.mock.calls.map(([k]) => k)).toEqual(['memberBlocked', 'memberUnblocked'])
  })

  it('2FA reset', async () => {
    const { result } = wrap(() => admin.useResetMemberMfa())
    await act(() => result.current.mutateAsync('u2'))
    expect(h.svc.resetMemberMfa).toHaveBeenCalledWith('u2')
    expect(h.toast.success).toHaveBeenCalledWith('memberMfaResetDone')
  })

  it('an invitation whose email failed warns instead of claiming it was sent', async () => {
    h.svc.createInvitation.mockResolvedValueOnce({ emailSent: true }).mockResolvedValueOnce({ emailSent: false })
    const { result } = wrap(() => admin.useCreateInvitation())
    await act(() => result.current.mutateAsync({ email: 'x@y.z' } as never))
    await act(() => result.current.mutateAsync({ email: 'x@y.z' } as never))
    expect(h.toast.success).toHaveBeenCalledWith('inviteSent')
    expect(h.toast.warning).toHaveBeenCalledWith('inviteEmailFailed')
    expect(invalidated).toEqual([['admin-invitations'], ['admin-invitations']])
  })

  it('resend: success toasts; a failure still refreshes the list (server may have auto-revoked)', async () => {
    h.svc.resendInvitation.mockResolvedValueOnce({ emailSent: true })
    const { result } = wrap(() => admin.useResendInvitation())
    await act(() => result.current.mutateAsync('i1'))
    expect(h.toast.success).toHaveBeenCalledWith('inviteResent')

    invalidated = []
    h.svc.resendInvitation.mockRejectedValueOnce(authErr('INVITATION_REVOKED'))
    await act(async () => {
      await result.current.mutateAsync('i1').catch(() => undefined)
    })
    expect(invalidated).toEqual([['admin-invitations']])
    expect(h.toast.error).toHaveBeenCalledTimes(1)
  })

  it('revoke', async () => {
    const { result } = wrap(() => admin.useRevokeInvitation())
    await act(() => result.current.mutateAsync('i1'))
    expect(h.toast.success).toHaveBeenCalledWith('inviteRevoked')
  })

  it('role create refreshes roles; role update also refreshes my capabilities', async () => {
    const { result } = wrap(() => admin.useRoleActions())
    await act(() => result.current.create.mutateAsync({ name: 'R' } as never))
    expect(invalidated).toEqual([['admin-roles']])
    invalidated = []
    await act(() => result.current.update.mutateAsync({ id: 'r1', input: {} as never }))
    expect(invalidated).toEqual([['admin-roles'], ['me-capabilities']])
  })
})

describe('error toasts', () => {
  async function failUpdateMember(err: unknown) {
    h.svc.updateMember.mockRejectedValueOnce(err)
    const { result } = wrap(() => admin.useUpdateMember())
    await act(async () => {
      await result.current.mutateAsync({ id: 'u2', input: {} as never }).catch(() => undefined)
    })
    expect(invalidated).toEqual([])
    expect(h.toast.success).not.toHaveBeenCalled()
    return String(h.toast.error.mock.calls[0][0])
  }

  it('a typed role-guard code gets its own localized message, not the server text', async () => {
    const msg = await failUpdateMember(authErr('LAST_OWNER_CANNOT_BE_DEMOTED'))
    expect(msg).toBe('errLastOwnerCannotBeDemoted')
    expect(msg).not.toContain('RoleGuard')
  })

  it('an unknown failure falls back to the generic admin toast', async () => {
    expect(await failUpdateMember(new Error('socket hang up'))).toBe('toastError')
  })
})
