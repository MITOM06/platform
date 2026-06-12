import { chatApi } from './axios'
import type {
  AiTraceResponse,
  Conversation,
  ConversationsResponse,
  LinkPreview,
  Message,
  MessageType,
  MessagesResponse,
  PageResponse,
  UploadResult,
  UserStatus,
} from './types'

export const chatService = {
  // ── Conversations ──────────────────────────────────────────────────────────

  getConversations: (archived = false) =>
    chatApi
      .get<ConversationsResponse>('/api/conversations', { params: { archived } })
      .then((r) => r.data),

  getConversation: (id: string) =>
    chatApi.get<Conversation>(`/api/conversations/${id}`).then((r) => r.data),

  createConversation: (participantId: string) =>
    chatApi.post<Conversation>('/api/conversations', { participantId }).then((r) => r.data),

  createGroup: (name: string, participantIds: string[], isPublic = false) =>
    chatApi
      .post<Conversation>('/api/conversations/group', {
        name,
        participantIds,
        publicChannel: isPublic,
      })
      .then((r) => r.data),

  updateGroup: (id: string, name?: string, avatarUrl?: string) =>
    chatApi.put<Conversation>(`/api/conversations/${id}`, { name, avatarUrl }).then((r) => r.data),

  addMembers: (id: string, userIds: string[]) =>
    chatApi.post<Conversation>(`/api/conversations/${id}/members`, { userIds }).then((r) => r.data),

  removeMember: (id: string, userId: string) =>
    chatApi.delete<Conversation>(`/api/conversations/${id}/members/${userId}`).then((r) => r.data),

  deleteConversation: (id: string) =>
    chatApi.delete(`/api/conversations/${id}`),

  clearHistory: (id: string) =>
    chatApi.post(`/api/conversations/${id}/clear`),

  muteConversation: (id: string) =>
    chatApi.post<Conversation>(`/api/conversations/${id}/mute`).then((r) => r.data),

  unmuteConversation: (id: string) =>
    chatApi.post<Conversation>(`/api/conversations/${id}/unmute`).then((r) => r.data),

  archiveConversation: (id: string) =>
    chatApi.post<Conversation>(`/api/conversations/${id}/archive`).then((r) => r.data),

  unarchiveConversation: (id: string) =>
    chatApi.post<Conversation>(`/api/conversations/${id}/unarchive`).then((r) => r.data),

  markConversationRead: (conversationId: string) =>
    chatApi.post(`/api/conversations/${conversationId}/read`),

  markConversationUnread: (conversationId: string) =>
    chatApi.post(`/api/conversations/${conversationId}/unread`),

  blockUser: (userId: string) =>
    chatApi.post(`/api/users/block/${userId}`),

  unblockUser: (userId: string) =>
    chatApi.post(`/api/users/unblock/${userId}`),

  acceptConversation: (id: string) =>
    chatApi.post<Conversation>(`/api/conversations/${id}/accept`).then((r) => r.data),

  updateSettings: (id: string, autoDeleteSeconds: number | null) =>
    chatApi
      .put<Conversation>(`/api/conversations/${id}/settings`, { autoDeleteSeconds })
      .then((r) => r.data),

  listPublicChannels: (q?: string, page = 0, size = 20) =>
    chatApi
      .get<PageResponse<Conversation>>('/api/conversations/public', { params: { q, page, size } })
      .then((r) => r.data),

  joinChannel: (id: string) =>
    chatApi.post<Conversation>(`/api/conversations/${id}/join`).then((r) => r.data),

  getAttachments: (conversationId: string, type = 'media', page = 0) =>
    chatApi
      .get<PageResponse<Message>>(`/api/conversations/${conversationId}/attachments`, {
        params: { type, page, size: 30 },
      })
      .then((r) => r.data),

  // ── Messages ───────────────────────────────────────────────────────────────

  getMessages: (conversationId: string, beforeId?: string) => {
    const params: Record<string, string | number> = { size: 30 }
    if (beforeId) params.before = beforeId
    return chatApi
      .get<MessagesResponse>(`/api/conversations/${conversationId}/messages`, { params })
      .then((r) => r.data)
  },

  sendMessage: (
    conversationId: string,
    content: string,
    type: MessageType = 'text',
    replyToId?: string,
  ) =>
    chatApi
      .post<Message>('/api/messages', {
        conversationId,
        content,
        type,
        ...(replyToId ? { replyToId } : {}),
      })
      .then((r) => r.data),

  // ── Uploads & utils ──────────────────────────────────────────────────────────

  /** Upload a file (image/video/document/voice) to GridFS. Returns stored url + meta. */
  uploadFile: (file: File | Blob, filename?: string) => {
    const form = new FormData()
    form.append('file', file, filename ?? (file instanceof File ? file.name : 'file'))
    return chatApi
      .post<UploadResult>('/api/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  /** Server-side Open Graph unfurl (bypasses browser CORS). */
  fetchLinkPreview: (url: string) =>
    chatApi
      .get<LinkPreview>('/api/utils/link-preview', { params: { url } })
      .then((r) => r.data),

  editMessage: (id: string, content: string) =>
    chatApi.put<Message>(`/api/messages/${id}`, { content }).then((r) => r.data),

  recallMessage: (id: string) =>
    chatApi.delete<Message>(`/api/messages/${id}`).then((r) => r.data),

  deleteForMe: (id: string) =>
    chatApi.post(`/api/messages/${id}/delete-for-me`),

  addReaction: (id: string, emoji: string) =>
    chatApi.post<Message>(`/api/messages/${id}/reactions`, { emoji }).then((r) => r.data),

  removeReaction: (id: string) =>
    chatApi.delete<Message>(`/api/messages/${id}/reactions`).then((r) => r.data),

  pinMessage: (id: string) =>
    chatApi
      .post<{ pinnedMessages: string[] }>(`/api/messages/${id}/pin`)
      .then((r) => r.data),

  unpinMessage: (id: string) =>
    chatApi
      .delete<{ pinnedMessages: string[] }>(`/api/messages/${id}/pin`)
      .then((r) => r.data),

  forwardMessage: (id: string, targetConversationId: string) =>
    chatApi
      .post<Message>(`/api/messages/${id}/forward`, { targetConversationId })
      .then((r) => r.data),

  searchMessages: (conversationId: string, q: string) =>
    chatApi
      .get<Message[]>('/api/messages/search', { params: { q, conversationId } })
      .then((r) => r.data),

  getTrace: (id: string) =>
    chatApi.get<AiTraceResponse>(`/api/messages/${id}/trace`).then((r) => r.data),

  getUserStatus: (userId: string) =>
    chatApi.get<UserStatus>(`/api/users/${userId}/status`).then((r) => r.data),
}
