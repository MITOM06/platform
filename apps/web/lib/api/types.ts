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
  type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'sticker'
  createdAt: string
  editedAt?: string
  replyToId?: string
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
