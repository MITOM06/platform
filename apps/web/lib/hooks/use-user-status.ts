import { useQuery } from '@tanstack/react-query'
import { chatService } from '@/lib/api/chat'

export function useUserStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ['userStatus', userId],
    queryFn: () => chatService.getUserStatus(userId!),
    enabled: !!userId,
    refetchInterval: 30_000,
  })
}
