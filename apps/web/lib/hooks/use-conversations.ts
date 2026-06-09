import { useQuery } from '@tanstack/react-query'
import { chatService } from '@/lib/api/chat'

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatService.getConversations(),
    select: (data) => data.content,
  })
}
