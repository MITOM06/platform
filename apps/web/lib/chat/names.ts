/**
 * Guards against rendering machine identifiers as names
 * (.claude/rules/no-raw-system-data-in-ui.md): chat-service falls back to the raw
 * user id when it cannot resolve a sender, and assistants use synthetic ids.
 */

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i

/** A Mongo ObjectId, a synthetic bot id, or the literal `system` sender. */
export function looksLikeRawId(value: string): boolean {
  const v = value.trim()
  return (
    OBJECT_ID_RE.test(v) ||
    v === 'system' ||
    v.startsWith('extbot:') ||
    v.startsWith('ai-bot-')
  )
}

/** `name` when it is a real display name, otherwise undefined (caller localizes). */
export function safeDisplayName(
  name: string | null | undefined,
  id?: string | null,
): string | undefined {
  const trimmed = name?.trim()
  if (!trimmed) return undefined
  if (id && trimmed === id) return undefined
  if (looksLikeRawId(trimmed)) return undefined
  return trimmed
}
