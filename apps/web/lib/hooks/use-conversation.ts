import { useQuery } from '@tanstack/react-query'
import { chatService } from '@/lib/api/chat'

export function useConversation(id: string) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => chatService.getConversation(id),
    enabled: !!id,
  })
}
