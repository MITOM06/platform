import { authApi } from './axios'
import type { UserSearchResult } from './types'

export interface FriendRequestDto {
  recipientId: string
}

export interface AcceptFriendDto {
  requesterId: string
}

export interface FriendStatusResponse {
  status: 'none' | 'outgoing' | 'incoming' | 'accepted'
}

export const friendsService = {
  listFriends: () =>
    authApi.get<UserSearchResult[]>('/api/friends').then((r) => r.data),

  listRequests: () =>
    authApi.get<UserSearchResult[]>('/api/friends/requests').then((r) => r.data),

  sendRequest: (recipientId: string) =>
    authApi.post<{ success: boolean }>('/api/friends/request', { recipientId }).then((r) => r.data),

  acceptRequest: (requesterId: string) =>
    authApi.put<{ success: boolean }>('/api/friends/accept', { requesterId }).then((r) => r.data),

  removeFriend: (userId: string) =>
    authApi.delete<{ success: boolean }>(`/api/friends/${userId}`).then((r) => r.data),

  getStatus: (userId: string) =>
    authApi.get<FriendStatusResponse>(`/api/friends/status/${userId}`).then((r) => r.data),
}
