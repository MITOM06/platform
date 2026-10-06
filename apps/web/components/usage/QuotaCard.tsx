'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usageService } from '@/lib/api/usage'
import { quotaView, quotaResetDate } from '@/lib/usage/quota'
import { fmtTokens } from '@/lib/usage/format'

/**
 * The caller's monthly AI quota exactly as ai-service enforces it
 * (`GET /usage/quota`): the current UTC calendar month, the workspace limit
 * (never a hard-coded one), and when it resets.
 */
export function QuotaCard() {
  const t = useTranslations('tokenUsage')
  const locale = useLocale()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['usage-quota'],
    queryFn: () => usageService.getQuota(),
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return <div className="rounded-lg border bg-card p-5 h-[132px] animate-pulse" />
  }
  if (isError || !data) {
    return (
      <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        {t('quotaLoadError')}
      </div>
    )
  }

  const q = quotaView(data)
  const resets = quotaResetDate(data.periodEnd, locale)
  const danger = q.blocked || q.exceeded || q.fraction >= 0.9

  return (
    <div className="rounded-lg border bg-card p-5" data-testid="quota-card">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className={cn('size-4 shrink-0', danger ? 'text-destructive' : 'text-primary')} />
          <span className="text-sm font-semibold">{t('quotaTitle')}</span>
        </div>
        {!q.blocked && (
          <span
            className={cn('text-sm font-semibold tabular-nums', danger && 'text-destructive')}
          >
            {fmtTokens(q.used)} / {fmtTokens(q.limit)}
          </span>
        )}
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            danger ? 'bg-destructive' : 'bg-primary',
          )}
          style={{ width: `${q.blocked ? 100 : Number(q.percent)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {q.blocked
          ? t('quotaBlocked')
          : q.exceeded
            ? t('quotaExceeded')
            : t('usedPercent', { percent: q.percent })}
      </p>
      {resets && <p className="text-xs text-muted-foreground mt-0.5">{t('quotaResets', { date: resets })}</p>}
    </div>
  )
}
