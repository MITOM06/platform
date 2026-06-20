import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { connectorService } from '@/lib/api/connector'
import { useAuthStore } from '@/lib/store/auth.store'
import type { CustomMcpInput } from '@/lib/api/connector-types'

/** The connector catalog is global (not per-user), so it can be cached longer. */
export function useCatalog() {
  return useQuery({
    queryKey: ['connector-catalog'],
    queryFn: () => connectorService.getCatalog(),
    staleTime: 10 * 60 * 1000,
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
    onError: () => toast.error(t('disconnectError')),
  })

  const saveCustomMcp = useMutation({
    mutationFn: (input: CustomMcpInput) => connectorService.saveCustomMcp(input),
    onSuccess: () => {
      toast.success(t('customSaveSuccess'))
      invalidateConnections()
    },
    onError: () => toast.error(t('customSaveError')),
  })

  return { disconnect, saveCustomMcp, invalidateConnections }
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
