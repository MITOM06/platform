import { useMutation } from '@tanstack/react-query'
import { chatService } from '@/lib/api/chat'
import type { FeedbackRating } from '@/lib/api/types'

interface FeedbackVars {
  messageId: string
  rating: FeedbackRating
  comment?: string
}

/**
 * Submit thumbs feedback on an AI answer. The active vote is held as local
 * optimistic state in the UI (no historical votes preloaded for v1), so this
 * hook only owns the network mutation.
 */
export function useMessageFeedback() {
  return useMutation({
    mutationFn: ({ messageId, rating, comment }: FeedbackVars) =>
      chatService.submitFeedback(messageId, rating, comment),
  })
}
