import { chatApi } from './axios'
import type { Conversation, ConversationsResponse, Message, MessagesResponse } from './types'

export const chatService = {
  getConversations: () =>
    chatApi.get<ConversationsResponse>('/api/conversations').then((r) => r.data),

  getConversation: (id: string) =>
    chatApi.get<Conversation>(`/api/conversations/${id}`).then((r) => r.data),

  getMessages: (conversationId: string, beforeId?: string) => {
    const params: Record<string, string | number> = { size: 30 }
    if (beforeId) params.beforeId = beforeId
    return chatApi
      .get<MessagesResponse>(`/api/conversations/${conversationId}/messages`, { params })
      .then((r) => r.data)
  },

  sendMessage: (conversationId: string, content: string) =>
    chatApi
      .post<Message>('/api/messages', { conversationId, content, type: 'text' })
      .then((r) => r.data),

  markConversationRead: (conversationId: string) =>
    chatApi.post(`/api/conversations/${conversationId}/read`),
}
