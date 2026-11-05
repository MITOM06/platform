import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { aiThreadsApi } from '@/lib/api/ai-threads'
import { AI_THREADS_KEY, upsertAiThread } from '@/lib/realtime/conversation-cache'

export function useAiThreads() {
  return useQuery({
    queryKey: AI_THREADS_KEY,
    queryFn: () => aiThreadsApi.list(),
    staleTime: 60 * 1000,
  })
}

export function useCreateAiThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => aiThreadsApi.create(),
    onSuccess: (conv) => upsertAiThread(queryClient, conv),
  })
}

export function useRenameAiThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => aiThreadsApi.rename(id, name),
    onSuccess: (conv) => upsertAiThread(queryClient, conv, { keepPosition: true }),
  })
}
