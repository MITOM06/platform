/**
 * The caller's monthly AI quota (`GET /usage/quota` on ai-service, HANDOFF §5.2):
 * `{ used, limit, periodStart, periodEnd }` for the current UTC calendar month,
 * `periodEnd` exclusive. `limit` is the workspace `monthlyTokenLimit` or the
 * server default; `0` blocks the assistant; the quota is exceeded once `used >= limit`.
 */
export interface QuotaStatus {
  used: number
  limit: number
  periodStart: string
  periodEnd: string
}

export interface QuotaView {
  used: number
  limit: number
  /** 0..1 (capped). */
  fraction: number
  /** One decimal, for "{percent}% used". */
  percent: string
  /** The assistant is turned off for this workspace / member (`limit === 0`). */
  blocked: boolean
  /** Nothing left this period. */
  exceeded: boolean
}

export function quotaView(q: Pick<QuotaStatus, 'used' | 'limit'>): QuotaView {
  const used = Math.max(0, Number(q.used) || 0)
  const limit = Math.max(0, Number(q.limit) || 0)
  const blocked = limit === 0
  const fraction = blocked ? 1 : Math.min(used / limit, 1)
  return {
    used,
    limit,
    fraction,
    percent: (fraction * 100).toFixed(1),
    blocked,
    exceeded: used >= limit,
  }
}

/** When the quota resets (`periodEnd`, the first instant of the next UTC month). */
export function quotaResetDate(periodEnd: string, locale: string): string | null {
  const ms = Date.parse(periodEnd)
  if (!Number.isFinite(ms)) return null
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(ms))
}

/** `YYYY-MM` of the current UTC month and the [count]-1 before it (newest first). */
export function utcMonthOptions(now: Date, count = 12): string[] {
  const out: string[] = []
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(y, m - i, 1))
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

/** "October 2026" for `2026-10`, in [locale], read in UTC (never shifted a month). */
export function utcMonthLabel(month: string, locale: string): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  )
}
