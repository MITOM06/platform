import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/lib/api/notifications'

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    // Poll every 30s — STOMP-based push can be added later.
    refetchInterval: 30_000,
    // Refetch when the window regains focus (user switches back to the tab).
    refetchOnWindowFocus: true,
    staleTime: 20_000,
  })
}

export function useNotificationActions() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  })

  return { markRead, markAllRead }
}
