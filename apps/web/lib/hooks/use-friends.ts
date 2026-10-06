import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { friendsService } from '@/lib/api/friends'
import { parseChatError } from '@/lib/api/chat-errors'
import { toast } from 'sonner'

/** `friends.*` key for a friend-action failure (403 USER_BLOCKED has its own text). */
export function friendErrorKey(err: unknown, fallbackKey: string): string {
  const { code, status, network } = parseChatError(err)
  if (code === 'USER_BLOCKED') return 'errUserBlocked'
  if (status === 429) return 'errRateLimited'
  if (network) return 'errNetwork'
  return fallbackKey
}

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
    onError: (err) => toast.error(t(friendErrorKey(err, 'sendRequestError'))),
  })

  const acceptRequest = useMutation({
    mutationFn: (userId: string) => friendsService.acceptRequest(userId),
    onSuccess: () => {
      toast.success(t('acceptRequestSuccess'))
      invalidateAll()
    },
    onError: (err) => toast.error(t(friendErrorKey(err, 'acceptRequestError'))),
  })

  const removeFriend = useMutation({
    mutationFn: (userId: string) => friendsService.removeFriend(userId),
    onSuccess: () => {
      toast.success(t('removeFriendSuccess'))
      invalidateAll()
    },
    onError: (err) => toast.error(t(friendErrorKey(err, 'removeFriendError'))),
  })

  return {
    sendRequest,
    acceptRequest,
    removeFriend,
  }
}
