import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authService } from '@/lib/api/auth'

export function useRelationship(userId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['relationship', userId],
    queryFn: () => authService.getRelationship(userId!),
    enabled: !!userId,
  })

  const blockMutation = useMutation({
    mutationFn: (id: string) => authService.blockUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', userId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversation'] })
    },
  })

  const unblockMutation = useMutation({
    mutationFn: (id: string) => authService.unblockUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship', userId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversation'] })
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
