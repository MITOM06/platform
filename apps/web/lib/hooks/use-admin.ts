import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { adminService } from '@/lib/api/admin'
import type {
  CreateDepartmentInput,
  CreateRoleInput,
  UpdateDepartmentInput,
  UpdateMemberInput,
  UpdateRoleInput,
  UpdateWorkspaceInput,
} from '@/lib/api/admin-types'

/**
 * TanStack Query hooks for the admin console. Each mutation invalidates its list
 * query on success and surfaces a toast — no manual refetch loops (web.md rule).
 * Error toasts read the shared `admin.toastError` message.
 */

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
  return useMutation({
    mutationFn: (input: UpdateWorkspaceInput) =>
      adminService.updateWorkspace(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-workspace'] })
      qc.invalidateQueries({ queryKey: ['me-capabilities'] })
      toast.success(t('toastSaved'))
    },
    onError: () => toast.error(t('toastError')),
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
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['admin-departments'] })

  const create = useMutation({
    mutationFn: (input: CreateDepartmentInput) =>
      adminService.createDepartment(input),
    onSuccess: () => {
      invalidate()
      toast.success(t('toastSaved'))
    },
    onError: () => toast.error(t('toastError')),
  })

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDepartmentInput }) =>
      adminService.updateDepartment(id, input),
    onSuccess: () => {
      invalidate()
      toast.success(t('toastSaved'))
    },
    onError: () => toast.error(t('toastError')),
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminService.deleteDepartment(id),
    onSuccess: () => {
      invalidate()
      toast.success(t('toastDeleted'))
    },
    onError: () => toast.error(t('toastError')),
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
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMemberInput }) =>
      adminService.updateMember(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-members'] })
      toast.success(t('toastSaved'))
    },
    onError: () => toast.error(t('toastError')),
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
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-roles'] })

  const create = useMutation({
    mutationFn: (input: CreateRoleInput) => adminService.createRole(input),
    onSuccess: () => {
      invalidate()
      toast.success(t('toastSaved'))
    },
    onError: () => toast.error(t('toastError')),
  })

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoleInput }) =>
      adminService.updateRole(id, input),
    onSuccess: () => {
      invalidate()
      toast.success(t('toastSaved'))
    },
    onError: () => toast.error(t('toastError')),
  })

  return { create, update }
}
