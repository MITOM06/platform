'use client'

// Small presentational helpers extracted from MessageBubble.tsx — behaviour is
// identical to the originals.

export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ReactionBadge({ emoji, count, onClick }: { emoji: string; count: number; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-0.5 bg-muted border rounded-full px-1.5 py-0.5 text-xs leading-none hover:bg-muted/80 transition-colors motion-safe:pon-pop"
    >
      {emoji}
      {count > 1 && <span className="text-muted-foreground">{count}</span>}
    </button>
  )
}

// Media + summary-card types render without the colored chat bubble (mirror Flutter).
export const BARE_TYPES = new Set(['image', 'video', 'sticker', 'meeting_summary'])

// Detects a message whose entire content is 1–3 emoji and nothing else. Such
// messages render "bare" (large, no bubble frame) like Messenger/iMessage.
// `\p{Extended_Pictographic}` needs the `u` flag; ZWJ sequences (e.g. 👨‍👩‍👧) and
// variation selectors / skin-tone modifiers are allowed so a single composed
// glyph still counts as one emoji.
const EMOJI_ONLY_RE =
  /^(?:(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:️|[\u{1F3FB}-\u{1F3FF}])?(?:‍(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:️|[\u{1F3FB}-\u{1F3FF}])?)*){1,3}$/u

export function isEmojiOnly(content: string): boolean {
  return EMOJI_ONLY_RE.test(content.trim())
}
