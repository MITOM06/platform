'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Coins,
  MessageSquare,
  DollarSign,
  ThumbsDown,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { usageService } from '@/lib/api/usage'
import {
  StatCard,
  DailyBarChart,
  PerModelCostTable,
  TopUsersTable,
  WorstAnswers,
  fmtTokens,
  fmtUsd,
} from '@/components/admin/usage-dashboard-parts'

// ── month options (current month + previous 11) ─────────────────────────────

function buildMonthOptions(): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push(m)
  }
  return out
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="rounded-xl border bg-card p-4">{children}</div>
    </div>
  )
}

// ── Main dashboard ───────────────────────────────────────────────────────────

export function UsageDashboard() {
  const t = useTranslations('usageDashboard')
  const monthOptions = useMemo(() => buildMonthOptions(), [])
  const [month, setMonth] = useState(monthOptions[0])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-usage', month],
    queryFn: () => usageService.getDashboard({ month }),
  })

  const thumbsDownPercent = data
    ? `${(data.feedback.thumbsDownRate * 100).toFixed(1)}%`
    : '—'

  return (
    <div className="space-y-6">
      {/* Header + month selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('month')}</span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="size-10 text-destructive/50" />
          <p className="text-sm text-destructive">{t('loadError')}</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Headline stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<Coins className="size-5 text-primary" />}
              label={t('totalTokens')}
              value={fmtTokens(data.totals.totalTokens)}
              glowColor="rgba(106,201,255,0.06)"
            />
            <StatCard
              icon={<MessageSquare className="size-5 text-[#B47FFF]" />}
              label={t('requests')}
              value={data.totals.requestCount.toString()}
              glowColor="rgba(180,127,255,0.06)"
            />
            <StatCard
              icon={<DollarSign className="size-5 text-pon-peach" />}
              label={t('estimatedCost')}
              value={fmtUsd(data.totals.estimatedCostUsd)}
              glowColor="rgba(251,182,139,0.06)"
            />
            <StatCard
              icon={<ThumbsDown className="size-5 text-destructive" />}
              label={t('thumbsDownRate')}
              value={thumbsDownPercent}
              glowColor="rgba(239,68,68,0.06)"
            />
          </div>

          {/* Daily tokens chart */}
          <Section title={t('dailyChart')}>
            <DailyBarChart
              days={data.daily}
              inputLabel={t('inputTokens')}
              outputLabel={t('outputTokens')}
              noDataLabel={t('noData')}
            />
          </Section>

          {/* Per-model cost */}
          <Section title={t('perModelCost')}>
            <PerModelCostTable rows={data.perModelCost} />
          </Section>

          {/* Top users */}
          <Section title={t('topUsers')}>
            <TopUsersTable users={data.topUsers} />
          </Section>

          {/* Feedback summary + worst answers */}
          <Section title={t('worstAnswers')}>
            <p className="text-xs text-muted-foreground mb-3">
              {t('feedbackSummary', {
                up: data.feedback.up,
                down: data.feedback.down,
                total: data.feedback.total,
              })}
            </p>
            <WorstAnswers answers={data.feedback.worstAnswers} />
          </Section>
        </div>
      )}
    </div>
  )
}
