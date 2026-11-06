import { AI_BOT_ID } from '@/lib/constants'

const AI_MENTION = /@(?:AI|ponai)\b/i

interface ConversationLike {
  type?: string
  participants?: string[]
}

/** A 1-1 chat with the AI — not a group that merely contains the bot. */
export function isDirectAiConversation(conversation: ConversationLike | undefined): boolean {
  const participants = conversation?.participants ?? []
  return (
    conversation?.type !== 'group' &&
    participants.length === 2 &&
    participants.includes(AI_BOT_ID)
  )
}

/**
 * Whether sending this message makes the AI answer. In a 1-1 AI chat every text
 * does (the server needs no @AI there, so the text is sent exactly as typed);
 * elsewhere only an explicit @AI / @ponai mention does.
 */
export function expectsAiReply(
  conversation: ConversationLike | undefined,
  content: string,
  type: string,
): boolean {
  if (type !== 'text') return false
  return isDirectAiConversation(conversation) || AI_MENTION.test(content)
}
