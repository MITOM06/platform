import { useQuery } from '@tanstack/react-query'
import { authService } from '@/lib/api/auth'

export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => authService.getUser(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  })
}
