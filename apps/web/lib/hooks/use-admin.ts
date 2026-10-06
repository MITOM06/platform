import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { adminService } from '@/lib/api/admin'
import { adminErrorMessage } from '@/lib/admin/admin-errors'
import { useAuthStore } from '@/lib/store/auth.store'
import type {
  CreateDepartmentInput,
  CreateInvitationInput,
  InvitationMutationResult,
  SettableMemberStatus,
  CreateRoleInput,
  UpdateDepartmentInput,
  UpdateMemberInput,
  UpdateRoleInput,
  UpdateWorkspaceInput,
} from '@/lib/api/admin-types'

/**
 * TanStack Query hooks for the admin console. Each mutation invalidates its list
 * query on success and surfaces a toast — no manual refetch loops (web.md rule).
 * Error toasts map the typed auth-service code (`{code, params}`) to its localized
 * message and only fall back to the shared `admin.toastError` when it is unknown.
 */

/**
 * Toast a typed auth-service error as its localized message — never the raw
 * server text (no-raw-system-data rule). ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS names
 * the capabilities the admin lacks.
 */
export function useAdminErrorToast() {
  const tAuth = useTranslations('auth')
  const tAdmin = useTranslations('admin')
  const locale = useLocale()
  return (err: unknown) =>
    toast.error(adminErrorMessage(err, tAuth, tAdmin, locale, tAdmin('toastError')))
}

// ── workspace ─────────────────────────────────────────────────────────────────
export function useWorkspace() {
  return useQuery({
    queryKey: ['admin-workspace'],
    queryFn: () => adminService.getWorkspace(),
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  const t = useTranslations('admin')
  const onError = useAdminErrorToast()
  return useMutation({
    mutationFn: (input: UpdateWorkspaceInput) =>
      adminService.updateWorkspace(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-workspace'] })
      qc.invalidateQueries({ queryKey: ['me-capabilities'] })
      toast.success(t('toastSaved'))
    },
    onError,
  })
}

// ── departments ───────────────────────────────────────────────────────────────
export function useDepartments(enabled = true) {
  return useQuery({
    queryKey: ['admin-departments'],
    queryFn: () => adminService.listDepartments(),
    enabled,
  })
}

export function useDepartmentActions() {
  const qc = useQueryClient()
  const t = useTranslations('admin')
  const onError = useAdminErrorToast()
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['admin-departments'] })

  const create = useMutation({
    mutationFn: (input: CreateDepartmentInput) =>
      adminService.createDepartment(input),
    onSuccess: () => {
      invalidate()
      toast.success(t('toastSaved'))
    },
    onError,
  })

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDepartmentInput }) =>
      adminService.updateDepartment(id, input),
    onSuccess: () => {
      invalidate()
      toast.success(t('toastSaved'))
    },
    onError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminService.deleteDepartment(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('toastDeleted'))
    },
    onError,
  })

  return { create, update, remove }
}

// ── members ───────────────────────────────────────────────────────────────────
export function useMembers(enabled = true) {
  return useQuery({
    queryKey: ['admin-members'],
    queryFn: () => adminService.listMembers(),
    enabled,
  })
}

export function useUpdateMember() {
  const qc = useQueryClient()
  const t = useTranslations('admin')
  // Typed role-guard codes (CANNOT_CHANGE_OWN_ROLE, LAST_OWNER_CANNOT_BE_DEMOTED,
  // OWNER_ROLE_ASSIGN_FORBIDDEN, ROLE_NOT_FOUND…) → their own localized message.
  const onError = useAdminErrorToast()
  const selfId = useAuthStore((s) => s.user?.id)
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMemberInput }) =>
      adminService.updateMember(id, input),
    onSuccess: (_member, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin-members'] })
      // My own departments changed: my claims did too (CLAIMS_CHANGED follows).
      if (id === selfId) qc.invalidateQueries({ queryKey: ['me-capabilities'] })
      toast.success(t('toastSaved'))
    },
    onError,
  })
}

/** Block / unblock a member (`PATCH /admin/members/:id/status`). */
export function useSetMemberStatus() {
  const qc = useQueryClient()
  const t = useTranslations('admin')
  const onError = useAdminErrorToast()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SettableMemberStatus }) =>
      adminService.setMemberStatus(id, status),
    onSuccess: (_member, { status }) => {
      qc.invalidateQueries({ queryKey: ['admin-members'] })
      toast.success(t(status === 'blocked' ? 'memberBlocked' : 'memberUnblocked'))
    },
    onError,
  })
}

// ── invitations ───────────────────────────────────────────────────────────────
const INVITATIONS_KEY = ['admin-invitations'] as const

/** Actionable invitations (server default: pending + expired). */
export function useInvitations(enabled = true) {
  return useQuery({
    queryKey: INVITATIONS_KEY,
    queryFn: () => adminService.listInvitations(),
    enabled,
  })
}

/** Shared success handling for create/resend: warn when the email failed. */
function useInvitationResultToast() {
  const t = useTranslations('admin')
  return (result: InvitationMutationResult, successKey: string) => {
    if (result.emailSent) toast.success(t(successKey))
    else toast.warning(t('inviteEmailFailed'))
  }
}

export function useCreateInvitation() {
  const qc = useQueryClient()
  const onError = useAdminErrorToast()
  const notify = useInvitationResultToast()
  return useMutation({
    mutationFn: (input: CreateInvitationInput) => adminService.createInvitation(input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: INVITATIONS_KEY })
      notify(result, 'inviteSent')
    },
    onError,
  })
}

export function useResendInvitation() {
  const qc = useQueryClient()
  const onError = useAdminErrorToast()
  const notify = useInvitationResultToast()
  return useMutation({
    mutationFn: (id: string) => adminService.resendInvitation(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: INVITATIONS_KEY })
      notify(result, 'inviteResent')
    },
    onError: (err) => {
      // A user was created meanwhile (e.g. SSO JIT) → server auto-revoked it.
      qc.invalidateQueries({ queryKey: INVITATIONS_KEY })
      onError(err)
    },
  })
}

export function useRevokeInvitation() {
  const qc = useQueryClient()
  const t = useTranslations('admin')
  const onError = useAdminErrorToast()
  return useMutation({
    mutationFn: (id: string) => adminService.revokeInvitation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVITATIONS_KEY })
      toast.success(t('inviteRevoked'))
    },
    onError,
  })
}

// ── roles ───────────────────────────────────────────────────────────────────
export function useRoles(enabled = true) {
  return useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => adminService.listRoles(),
    enabled,
  })
}

// ── audit ─────────────────────────────────────────────────────────────────────
export function useAuditLog(page: number, limit = 20) {
  return useQuery({
    queryKey: ['admin-audit', page, limit],
    queryFn: () => adminService.getAudit(page, limit),
    placeholderData: keepPreviousData,
  })
}

export function useRoleActions() {
  const qc = useQueryClient()
  const t = useTranslations('admin')
  const onError = useAdminErrorToast()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-roles'] })

  const create = useMutation({
    mutationFn: (input: CreateRoleInput) => adminService.createRole(input),
    onSuccess: () => {
      invalidate()
      toast.success(t('toastSaved'))
    },
    onError,
  })

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoleInput }) =>
      adminService.updateRole(id, input),
    onSuccess: () => {
      invalidate()
      // A role matrix change reaches every holder through CLAIMS_CHANGED; refetch
      // mine right away too, in case I hold the role (the Owner editing a shared one).
      qc.invalidateQueries({ queryKey: ['me-capabilities'] })
      toast.success(t('toastSaved'))
    },
    onError,
  })

  return { create, update }
}
