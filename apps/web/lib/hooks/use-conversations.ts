import { useQuery } from '@tanstack/react-query'
import { chatService } from '@/lib/api/chat'

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatService.getConversations(),
    staleTime: 2 * 60 * 1000,
    select: (data) => data.content,
  })
}

export function useBlockedConversations() {
  return useQuery({
    queryKey: ['blocked-conversations'],
    queryFn: () => chatService.getBlockedConversations(),
    staleTime: 2 * 60 * 1000,
    select: (data) => data.content,
  })
}
