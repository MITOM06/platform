import type { Message, MessageType, StompEvent } from '@/lib/api/types'

/**
 * Classifies frames on `/topic/conversation/{id}`.
 *
 * The topic multiplexes persisted messages with UPPER_CASE events (edits,
 * reactions, AI streaming, KB indexing status…). Anything that is not a known
 * event used to be appended to the thread as a message — a `KB_STATUS_UPDATE`
 * then reached MessageBubble with no `content` and crashed the whole chat
 * screen. Now a frame is only appended when it really looks like a message.
 */

const STOMP_EVENT_TYPES = new Set<string>([
  'MESSAGE_UPDATED', 'MESSAGE_RECALLED', 'MESSAGE_READ', 'REACTION_UPDATED',
  'PINNED_MESSAGE', 'CONVERSATION_UPDATED',
  'AI_STREAM_CHUNK', 'AI_STREAM_DONE', 'AI_STREAM_ERROR', 'AI_TOOL_CALL', 'AI_ACTION_PENDING',
  'KB_STATUS_UPDATE',
])

export function isStompEvent(parsed: Record<string, unknown>): parsed is StompEvent {
  return typeof parsed.type === 'string' && STOMP_EVENT_TYPES.has(parsed.type)
}

const MESSAGE_TYPES = new Set<MessageType>([
  'text', 'image', 'video', 'file', 'voice', 'sticker', 'system', 'call_log', 'ai',
  'meeting_summary',
])

/**
 * A persisted message for THIS conversation: id, sender, string content, a known
 * lowercase type and a timestamp. Frames for another conversation, unknown event
 * types and malformed payloads are rejected (never rendered).
 */
export function isMessageFrame(
  parsed: Record<string, unknown>,
  conversationId: string,
): parsed is Record<string, unknown> & Message {
  return (
    typeof parsed.id === 'string' &&
    parsed.id.length > 0 &&
    typeof parsed.senderId === 'string' &&
    typeof parsed.content === 'string' &&
    typeof parsed.createdAt === 'string' &&
    typeof parsed.type === 'string' &&
    MESSAGE_TYPES.has(parsed.type as MessageType) &&
    (parsed.conversationId === undefined || parsed.conversationId === conversationId)
  )
}
