export interface Reaction {
  userId: string
  emoji: string
}

export interface PinnedMessage {
  id: string
  senderId: string
  content: string
  createdAt: string
}

export interface Conversation {
  id: string
  participants: string[]
  type: 'direct' | 'group'
  name: string | null
  avatarUrl: string | null
  admins: string[]
  createdBy: string
  isPublic: boolean
  status: 'pending' | 'accepted'
  isMuted: boolean
  isArchived: boolean
  pinnedMessages: PinnedMessage[]
  autoDeleteSeconds: number | null
  lastMessage: {
    content: string
    senderId: string
    createdAt: string
  } | null
  lastMessageAt: string | null
  unreadCount: number
}

export type MessageType =
  | 'text' | 'image' | 'video' | 'file' | 'voice' | 'sticker' | 'system' | 'call_log' | 'ai'

export interface UploadResult {
  url: string
  filename: string
  size: number
}

export interface LinkPreview {
  url: string
  title?: string | null
  description?: string | null
  image?: string | null
  siteName?: string | null
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName?: string
  content: string
  type: MessageType
  createdAt: string
  editedAt?: string
  replyToId?: string
  replyPreview?: {
    messageId: string
    senderId: string
    content: string
  }
  recalled?: boolean
  reactions?: Reaction[]
  deletedFor?: string[]
  readBy?: string[]
}

export interface MessagesResponse {
  content: Message[]
  page: number
  size: number
  totalElements: number
  hasNext: boolean
}

export interface ConversationsResponse {
  content: Conversation[]
  page: number
  size: number
  totalElements: number
}

export interface UserSearchResult {
  _id?: string
  id?: string
  email: string
  displayName: string
  avatarUrl: string | null
}

export interface UserStatus {
  userId: string
  online: boolean
  lastSeen: string | null
}

export interface AiTraceResponse {
  messageId: string
  inputTokens: number
  outputTokens: number
  thinkingBlocks?: string[]
  toolCalls?: Array<{ name: string; input: unknown; output: unknown }>
  ragSources?: Array<{ documentId: string; excerpt: string; score: number }>
  promptVariables?: Record<string, string>
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
}

// STOMP event shapes (broadcasted on /topic/conversation/{id})
export type StompEvent =
  | { type: 'MESSAGE_UPDATED'; messageId: string; conversationId: string; content: string; editedAt: string }
  | { type: 'MESSAGE_RECALLED'; messageId: string; conversationId: string }
  | { type: 'MESSAGE_READ'; messageId: string; readerId: string }
  | { type: 'REACTION_UPDATED'; messageId: string; reactions: Reaction[] }
  | { type: 'PINNED_MESSAGE'; conversationId: string; messageId: string; pinnedMessages: string[] }
  | { type: 'CONVERSATION_UPDATED'; conversation: Conversation }
  | { type: 'AI_STREAM_CHUNK'; chunk: string; senderId: string; conversationId: string }
  | { type: 'AI_STREAM_DONE'; senderId: string; conversationId: string }
  | { type: 'AI_STREAM_ERROR'; error: string; senderId: string; conversationId: string }
  | { type: 'AI_TOOL_CALL'; toolName: string; inputSummary: string; senderId: string; conversationId: string }
