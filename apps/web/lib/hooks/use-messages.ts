import { useInfiniteQuery } from '@tanstack/react-query'
import { chatService } from '@/lib/api/chat'

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) =>
      chatService.getMessages(conversationId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursorId ?? undefined) : undefined,
    enabled: !!conversationId,
    select: (data) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      // oldest pages first → flat list in chronological order
      messages: [...data.pages].reverse().flatMap((page) => page.content),
    }),
  })
}
