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
