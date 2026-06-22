import { useQuery } from '@tanstack/react-query'
import { authService } from '@/lib/api/auth'

export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => authService.getUser(userId!),
    enabled: !!userId,
    // Short staleTime so a peer's avatar/displayName change is picked up quickly.
    // Avatar uploads produce a NEW unique URL per change (POST /api/uploads →
    // /api/uploads/<objectId>), so a refetched profile carries a fresh image path
    // that bypasses the HTTP cache without any volatile cache-busting query param.
    staleTime: 30 * 1000, // 30s
  })
}
