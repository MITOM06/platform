import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { connectorService } from '@/lib/api/connector'
import { useAuthStore } from '@/lib/store/auth.store'
import { connectorErrorKey } from '@/lib/integrations/connector-errors'
import type { ProviderNameSources } from '@/lib/ai/connector-names'
import type {
  ActionGroup,
  CreateDirectoryEntryInput,
  CustomMcpInput,
  UpdateDirectoryEntryInput,
} from '@/lib/api/connector-types'

/** My custom MCP servers live under the connections root (invalidated with it). */
const CUSTOM_MCP_KEY = (userId: string | undefined) => ['connections', userId, 'custom-mcp'] as const

/** The connector catalog is global (not per-user), so it can be cached longer. */
export function useCatalog(enabled = true) {
  return useQuery({
    queryKey: ['connector-catalog'],
    queryFn: () => connectorService.getCatalog(),
    staleTime: 10 * 60 * 1000,
    enabled,
  })
}

/** A user's established connections (status + metadata only). */
export function useConnections() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['connections', userId],
    queryFn: () => connectorService.getConnections(),
    enabled: !!userId,
  })
}

/**
 * Mutations for the integrations screen. OAuth itself happens in a popup
 * (the page owns that flow); on success / disconnect / save we invalidate the
 * connections query — no manual refetch loops (per web.md STOMP/query rule).
 */
export function useConnectorActions() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const t = useTranslations('integrations')

  const invalidateConnections = () =>
    queryClient.invalidateQueries({ queryKey: ['connections', userId] })

  const disconnect = useMutation({
    mutationFn: (id: string) => connectorService.disconnect(id),
    onSuccess: () => {
      toast.success(t('disconnectSuccess'))
      invalidateConnections()
    },
    // 403 INSUFFICIENT_PERMISSION on a workspace connection, 404 when it is gone.
    onError: (err) => {
      toast.error(t(connectorErrorKey(err, 'disconnectError')))
      invalidateConnections()
    },
  })

  const saveCustomMcp = useMutation({
    mutationFn: (input: CustomMcpInput) => connectorService.saveCustomMcp(input),
    onSuccess: () => {
      toast.success(t('customSaveSuccess'))
      invalidateConnections()
      queryClient.invalidateQueries({ queryKey: CUSTOM_MCP_KEY(userId) })
    },
    onError: (err) => toast.error(t(connectorErrorKey(err, 'customSaveError'))),
  })

  const deleteCustomMcp = useMutation({
    mutationFn: (id: string) => connectorService.deleteCustomMcp(id),
    onSuccess: () => {
      toast.success(t('customDeleteSuccess'))
      queryClient.invalidateQueries({ queryKey: CUSTOM_MCP_KEY(userId) })
    },
    onError: (err) => toast.error(t(connectorErrorKey(err, 'customDeleteError'))),
  })

  const updatePermissions = useMutation({
    mutationFn: ({
      id,
      actionGroups,
    }: {
      id: string
      actionGroups: ActionGroup[]
    }) => connectorService.updateConnectionPermissions(id, actionGroups),
    onSuccess: () => {
      toast.success(t('permSaved'))
      invalidateConnections()
    },
    onError: (err) => toast.error(t(connectorErrorKey(err, 'permSaveError'))),
  })

  return {
    disconnect,
    saveCustomMcp,
    deleteCustomMcp,
    updatePermissions,
    invalidateConnections,
  }
}

/** The caller's own custom MCP servers (`GET /custom-mcp`). */
export function useCustomMcpServers(enabled = true) {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: CUSTOM_MCP_KEY(userId),
    queryFn: () => connectorService.listCustomMcp(),
    enabled: !!userId && enabled,
  })
}

/**
 * Everything that can name a connector provider (catalog, directory, my custom
 * servers) — used to show `mcp__<provider>__…` tools by their display name.
 */
export function useProviderNameSources(enabled = true): ProviderNameSources {
  const { data: catalog } = useCatalog(enabled)
  const { data: directory } = useDirectory(enabled)
  const { data: customMcp } = useCustomMcpServers(enabled)
  return useMemo(() => ({ catalog, directory, customMcp }), [catalog, directory, customMcp])
}

/** The dynamic MCP directory (global, DB-driven). Cached like the catalog. */
export function useDirectory(enabled = true) {
  return useQuery({
    queryKey: ['connector-directory'],
    queryFn: () => connectorService.getDirectory(),
    staleTime: 10 * 60 * 1000,
    enabled,
  })
}

/**
 * Admin (MANAGE_WORKSPACE) mutations for the directory. On success we
 * invalidate the directory query so every member's grid reflects the change.
 */
export function useDirectoryAdmin() {
  const queryClient = useQueryClient()
  const t = useTranslations('integrations')

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['connector-directory'] })

  const create = useMutation({
    mutationFn: (input: CreateDirectoryEntryInput) =>
      connectorService.createDirectoryEntry(input),
    onSuccess: () => {
      toast.success(t('directorySaveSuccess'))
      invalidate()
    },
    onError: () => toast.error(t('directorySaveError')),
  })

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDirectoryEntryInput }) =>
      connectorService.updateDirectoryEntry(id, input),
    onSuccess: () => {
      toast.success(t('directorySaveSuccess'))
      invalidate()
    },
    onError: () => toast.error(t('directorySaveError')),
  })

  const remove = useMutation({
    mutationFn: (id: string) => connectorService.deleteDirectoryEntry(id),
    onSuccess: () => {
      toast.success(t('directoryDeleteSuccess'))
      invalidate()
    },
    onError: () => toast.error(t('directoryDeleteError')),
  })

  return { create, update, remove }
}

/** User skill toggles, persisted via connector-service `user_skills`. */
export function useSkills() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['skills', userId],
    queryFn: () => connectorService.getSkills(),
    enabled: !!userId,
  })
}

export function useSkillToggle() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const t = useTranslations('skills')

  return useMutation({
    mutationFn: ({ skillId, enabled }: { skillId: string; enabled: boolean }) =>
      connectorService.setSkill(skillId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', userId] })
    },
    onError: () => toast.error(t('toggleError')),
  })
}
