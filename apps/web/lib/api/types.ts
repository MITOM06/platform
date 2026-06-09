export interface Reaction {
  userId: string
  emoji: string
}

export interface Conversation {
  id: string
  participants: string[]
  type: 'direct' | 'group'
  name: string | null
  avatarUrl: string | null
  admins: string[]
  createdBy: string
  publicChannel: boolean
  status: 'pending' | 'accepted'
  mutedUsers: string[]
  archivedBy: string[]
  pinnedMessages: string[]
  autoDeleteSeconds: number | null
  lastMessage: {
    content: string
    senderId: string
    createdAt: string
  } | null
  lastMessageAt: string | null
  unreadCount: number
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderName?: string
  content: string
  type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'sticker' | 'system' | 'call_log' | 'ai'
  createdAt: string
  editedAt?: string
  replyToId?: string
  recalled?: boolean
  reactions?: Reaction[]
  deletedFor?: string[]
}

export interface MessagesResponse {
  content: Message[]
  nextCursorId: string | null
  hasMore: boolean
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
  | { type: 'REACTION_UPDATED'; messageId: string; reactions: Reaction[] }
  | { type: 'PINNED_MESSAGE'; conversationId: string; messageId: string; pinnedMessages: string[] }
  | { type: 'CONVERSATION_UPDATED'; conversation: Conversation }
