import { chatApi } from './axios'
import type {
  AiTraceResponse,
  Conversation,
  ConversationsResponse,
  FeedbackRating,
  LinkPreview,
  Message,
  MessageFeedbackResult,
  MessageType,
  MessagesResponse,
  PageResponse,
  UploadResult,
  UserStatus,
} from './types'

// Filename-extension → MIME map covering the upload types chat-service allows.
// Used as a fallback when a Blob/File has no `.type` (e.g. some MediaRecorder
// outputs) so the per-file content-type passes server-side validation.
const EXT_CONTENT_TYPE: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

function inferContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXT_CONTENT_TYPE[ext] ?? 'application/octet-stream'
}

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

  createGroup: (
    name: string,
    participantIds: string[],
    isPublic = false,
    departmentId?: string,
  ) =>
    chatApi
      .post<Conversation>('/api/conversations/group', {
        name,
        participantIds,
        ...(isPublic ? { publicChannel: isPublic } : {}),
        ...(departmentId ? { departmentId } : {}),
      })
      .then((r) => r.data),

  updateGroup: (id: string, name?: string, avatarUrl?: string) =>
    chatApi.put<Conversation>(`/api/conversations/${id}`, { name, avatarUrl }).then((r) => r.data),

  /**
   * Set the shared conversation wallpaper (direct + group). Any participant may
   * set it — the backend broadcasts CONVERSATION_UPDATED so every member
   * re-resolves the wallpaper. Empty string resets to the default for everyone.
   */
  setWallpaper: (id: string, wallpaper: string) =>
    chatApi
      .put<Conversation>(`/api/conversations/${id}/wallpaper`, { wallpaper })
      .then((r) => r.data),

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
    const name = filename ?? (file instanceof File ? file.name : 'file')
    // chat-service validates the per-file content-type via magic bytes; a blob
    // with an empty `.type` (or a generic octet-stream) gets rejected with 400.
    // Set an explicit type on the FormData entry: prefer the file's own type,
    // else infer from the extension. Do NOT hand-set the multipart request
    // Content-Type header — the browser must add the boundary itself.
    const type = file.type || inferContentType(name)
    const form = new FormData()
    form.append('file', new File([file], name, { type }))
    return chatApi
      .post<UploadResult>('/api/uploads', form)
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

  /** Submit thumbs feedback on an AI answer. `none` clears a prior vote. */
  submitFeedback: (messageId: string, rating: FeedbackRating, comment?: string) =>
    chatApi
      .post<MessageFeedbackResult>(`/api/messages/${messageId}/feedback`, {
        rating,
        ...(comment ? { comment } : {}),
      })
      .then((r) => r.data),

  getUserStatus: (userId: string) =>
    chatApi.get<UserStatus>(`/api/users/${userId}/status`).then((r) => r.data),
}
