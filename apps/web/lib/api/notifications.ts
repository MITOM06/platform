import { authApi } from './axios'

export type AppNotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'SYSTEM'
  | 'PASSWORD_SETUP'
  | 'PHONE_SETUP'

export interface AppNotification {
  _id: string
  id?: string
  recipientId: string
  type: AppNotificationType
  title: string
  body: string
  actorId?: string
  actorName?: string
  actorAvatarUrl?: string
  relatedEntityId?: string
  readAt: string | null
  createdAt: string
}

export const notificationsApi = {
  list: () =>
    authApi.get<AppNotification[]>('/api/notifications').then((r) => r.data),

  unreadCount: () =>
    authApi
      .get<{ count: number }>('/api/notifications/unread-count')
      .then((r) => r.data.count),

  markRead: (id: string) => authApi.post(`/api/notifications/${id}/read`),

  markAllRead: () => authApi.post('/api/notifications/read-all'),
}
