import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['friends'] })
    queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    // Invalidate individual relationships just in case
    queryClient.invalidateQueries({ queryKey: ['relationship'] })
  }

  const sendRequest = useMutation({
    mutationFn: (userId: string) => friendsService.sendRequest(userId),
    onSuccess: () => {
      toast.success('Đã gửi lời mời kết bạn')
      invalidateAll()
    },
    onError: () => toast.error('Không thể gửi lời mời kết bạn'),
  })

  const acceptRequest = useMutation({
    mutationFn: (userId: string) => friendsService.acceptRequest(userId),
    onSuccess: () => {
      toast.success('Đã chấp nhận lời mời')
      invalidateAll()
    },
    onError: () => toast.error('Không thể chấp nhận lời mời'),
  })

  const removeFriend = useMutation({
    mutationFn: (userId: string) => friendsService.removeFriend(userId),
    onSuccess: () => {
      toast.success('Đã xóa bạn bè/hủy lời mời')
      invalidateAll()
    },
    onError: () => toast.error('Không thể thực hiện hành động này'),
  })

  return {
    sendRequest,
    acceptRequest,
    removeFriend,
  }
}
