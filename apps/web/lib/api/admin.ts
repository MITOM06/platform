import { authApi } from './axios'
import type {
  AuditListResult,
  CreateDepartmentInput,
  CreateInvitationInput,
  CreateRoleInput,
  Department,
  Invitation,
  InvitationListFilter,
  InvitationMutationResult,
  MeCapabilities,
  Member,
  Role,
  SettableMemberStatus,
  UpdateDepartmentInput,
  UpdateMemberInput,
  UpdateRoleInput,
  UpdateWorkspaceInput,
  Workspace,
} from './admin-types'

/**
 * Admin console + capability client. All routes live on the auth-service, so we
 * reuse the `authApi` instance (baseURL = NEXT_PUBLIC_AUTH_URL) — it already
 * injects the JWT and handles 401 refresh. The backend authorizes each route by
 * the token's `perms` claim; the UI only mirrors that gating for UX.
 */
export const adminService = {
  // ── caller capabilities ───────────────────────────────────────────────────
  getCapabilities: () =>
    authApi.get<MeCapabilities>('/me/capabilities').then((r) => r.data),

  // ── workspace ─────────────────────────────────────────────────────────────
  getWorkspace: () =>
    authApi.get<Workspace>('/admin/workspace').then((r) => r.data),

  updateWorkspace: (input: UpdateWorkspaceInput) =>
    authApi.patch<Workspace>('/admin/workspace', input).then((r) => r.data),

  // ── departments ───────────────────────────────────────────────────────────
  listDepartments: () =>
    authApi
      .get<Department[]>('/admin/departments')
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  createDepartment: (input: CreateDepartmentInput) =>
    authApi.post<Department>('/admin/departments', input).then((r) => r.data),

  updateDepartment: (id: string, input: UpdateDepartmentInput) =>
    authApi
      .patch<Department>(`/admin/departments/${id}`, input)
      .then((r) => r.data),

  deleteDepartment: (id: string) =>
    authApi.delete<void>(`/admin/departments/${id}`).then((r) => r.data),

  // ── members ───────────────────────────────────────────────────────────────
  listMembers: () =>
    authApi
      .get<Member[]>('/admin/members')
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  updateMember: (id: string, input: UpdateMemberInput) =>
    authApi.patch<Member>(`/admin/members/${id}`, input).then((r) => r.data),

  setMemberStatus: (id: string, status: SettableMemberStatus) =>
    authApi
      .patch<Member>(`/admin/members/${id}/status`, { status })
      .then((r) => r.data),

  /** Owner only: clear the member's 2FA (re-enroll at next sign-in) and revoke their sessions. */
  resetMemberMfa: (id: string) =>
    authApi
      .post<{ success: boolean }>(`/admin/members/${id}/mfa/reset`)
      .then((r) => r.data),

  // ── invitations ───────────────────────────────────────────────────────────
  listInvitations: (status?: InvitationListFilter) =>
    authApi
      .get<Invitation[]>('/admin/invitations', { params: status ? { status } : undefined })
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  createInvitation: (input: CreateInvitationInput) =>
    authApi
      .post<InvitationMutationResult>('/admin/invitations', input)
      .then((r) => r.data),

  resendInvitation: (id: string) =>
    authApi
      .post<InvitationMutationResult>(`/admin/invitations/${id}/resend`)
      .then((r) => r.data),

  revokeInvitation: (id: string) =>
    authApi
      .delete<{ success: boolean }>(`/admin/invitations/${id}`)
      .then((r) => r.data),

  // ── roles ─────────────────────────────────────────────────────────────────
  listRoles: () =>
    authApi
      .get<Role[]>('/admin/roles')
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  createRole: (input: CreateRoleInput) =>
    authApi.post<Role>('/admin/roles', input).then((r) => r.data),

  updateRole: (id: string, input: UpdateRoleInput) =>
    authApi.patch<Role>(`/admin/roles/${id}`, input).then((r) => r.data),

  // ── audit ─────────────────────────────────────────────────────────────────
  getAudit: (page = 0, limit = 20) =>
    authApi
      .get<AuditListResult>('/admin/audit', { params: { page, limit } })
      .then((r) => r.data),
}
