import { authApi } from './axios'
import type { UserSearchResult } from './types'

/**
 * Incoming friend requests come back from auth-service as
 * `{ friendshipId, requester }[]` (see FriendsService.listIncomingRequests),
 * NOT a flat user list. We normalise to the requester profile so the UI can
 * treat friends and requests uniformly.
 */
interface IncomingRequestDto {
  friendshipId: string
  requester: UserSearchResult
}

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
    authApi
      .get<UserSearchResult[]>('/api/friends')
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  listRequests: () =>
    authApi
      .get<IncomingRequestDto[]>('/api/friends/requests')
      .then((r) =>
        (Array.isArray(r.data) ? r.data : []).map((req) => req.requester).filter(Boolean),
      ),

  sendRequest: (recipientId: string) =>
    authApi.post<{ success: boolean }>('/api/friends/request', { recipientId }).then((r) => r.data),

  acceptRequest: (requesterId: string) =>
    authApi.put<{ success: boolean }>('/api/friends/accept', { requesterId }).then((r) => r.data),

  removeFriend: (userId: string) =>
    authApi.delete<{ success: boolean }>(`/api/friends/${userId}`).then((r) => r.data),

  getStatus: (userId: string) =>
    authApi.get<FriendStatusResponse>(`/api/friends/status/${userId}`).then((r) => r.data),
}
