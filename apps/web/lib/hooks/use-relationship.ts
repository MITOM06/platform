import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authService } from '@/lib/api/auth'

export function useRelationship(userId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['relationship', userId],
    queryFn: () => authService.getRelationship(userId!),
    enabled: !!userId,
  })

  // Block/unblock changes the relationship + may toggle conversation pending
  // status, so we refresh the relationship query and the conversations list.
  // We intentionally do NOT invalidate ['conversation'] without an id (that
  // refetched every open conversation) — the relationship query drives the
  // blocked-composer UI on its own.
  const blockMutation = useMutation({
    mutationFn: (id: string) => authService.blockUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', userId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const unblockMutation = useMutation({
    mutationFn: (id: string) => authService.unblockUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', userId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  return {
    relationship: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    block: blockMutation.mutateAsync,
    isBlocking: blockMutation.isPending,
    unblock: unblockMutation.mutateAsync,
    isUnblocking: unblockMutation.isPending,
  }
}
