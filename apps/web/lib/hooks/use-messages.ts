import { useInfiniteQuery } from '@tanstack/react-query'
import { chatService } from '@/lib/api/chat'

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) =>
      chatService.getMessages(conversationId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    // Backend returns a cursor-style PageResponse: { content (DESC, newest first),
    // page, size, totalElements, hasNext }. There is no server cursor token — the
    // `before` param is the OLDEST message id we already have, i.e. the last item
    // of the (newest-first) page. Empty content → stop.
    getNextPageParam: (lastPage) =>
      lastPage.hasNext && lastPage.content.length > 0
        ? lastPage.content[lastPage.content.length - 1].id
        : undefined,
    enabled: !!conversationId,
    select: (data) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      // oldest pages first → flat list in chronological order
      messages: [...data.pages].reverse().flatMap((page) => [...page.content].reverse()),
    }),
  })
}
