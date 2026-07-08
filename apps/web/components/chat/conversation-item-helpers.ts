// Small pure helpers + constants extracted from ConversationItem.tsx to keep the
// component under the 400-line limit. Behaviour is identical to the originals.

export const AI_BOT_ID = 'ai-bot-000000000000000000000001'

/** epoch ms value chat-service uses for "muted forever" (Long.MAX_VALUE proxy) */
export const MUTE_FOREVER_MS = 9_200_000_000_000_000

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function formatTime(iso: string | null, locale: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}

/** Returns a short human-readable remaining time string for mute expiry. */
export function formatMuteExpiry(expiresAt: number): string {
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return ''
  const mins = Math.ceil(remaining / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(remaining / 3_600_000)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export const MUTE_OPTIONS = [
  { labelKey: 'mute15min',   seconds: 900   },
  { labelKey: 'mute30min',   seconds: 1800  },
  { labelKey: 'mute1hour',   seconds: 3600  },
  { labelKey: 'mute24hours', seconds: 86400 },
  { labelKey: 'muteForever', seconds: -1    },
] as const
