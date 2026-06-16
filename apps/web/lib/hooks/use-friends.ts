import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { friendsService } from '@/lib/api/friends'
import { toast } from 'sonner'

export function useFriends() {
  return useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsService.listFriends(),
  })
}

export function useFriendRequests() {
  return useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => friendsService.listRequests(),
  })
}

export function useFriendActions() {
  const queryClient = useQueryClient()
  const t = useTranslations('friends')

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['friends'] })
    queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    // Invalidate individual relationships just in case
    queryClient.invalidateQueries({ queryKey: ['relationship'] })
  }

  const sendRequest = useMutation({
    mutationFn: (userId: string) => friendsService.sendRequest(userId),
    onSuccess: () => {
      toast.success(t('sendRequestSuccess'))
      invalidateAll()
    },
    onError: () => toast.error(t('sendRequestError')),
  })

  const acceptRequest = useMutation({
    mutationFn: (userId: string) => friendsService.acceptRequest(userId),
    onSuccess: () => {
      toast.success(t('acceptRequestSuccess'))
      invalidateAll()
    },
    onError: () => toast.error(t('acceptRequestError')),
  })

  const removeFriend = useMutation({
    mutationFn: (userId: string) => friendsService.removeFriend(userId),
    onSuccess: () => {
      toast.success(t('removeFriendSuccess'))
      invalidateAll()
    },
    onError: () => toast.error(t('removeFriendError')),
  })

  return {
    sendRequest,
    acceptRequest,
    removeFriend,
  }
}
