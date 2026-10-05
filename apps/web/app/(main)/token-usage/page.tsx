'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft, Coins, MessageSquare, DollarSign,
  Loader2, AlertCircle, ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react'
import { aiService } from '@/lib/api/ai'
import { fmtTokens as fmt } from '@/lib/usage/format'
import { TokenLineChart } from '@/components/usage/TokenLineChart'
import { QuotaCard } from '@/components/usage/QuotaCard'

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon }: {
  label: string; value: string; sub?: string; icon: React.ReactNode
}) {
  return (
    <div className="relative rounded-lg border bg-card p-5 overflow-hidden transition-colors group hover:bg-accent">
      <div className="relative">
        <div className="mb-3 p-2 rounded-lg w-fit bg-primary/10">{icon}</div>
        <p className="text-3xl font-bold text-foreground tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground/60 mt-0.5 tabular-nums">{sub}</p>}
        <p className="text-xs text-muted-foreground mt-2">{label}</p>
      </div>
    </div>
  )
}

// ── Time Range Tabs ────────────────────────────────────────────────────────

const RANGES = [7, 30, 90] as const
type Range = typeof RANGES[number]

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TokenUsagePage() {
  const t = useTranslations('tokenUsage')
  const [range, setRange] = useState<Range>(30)

  const { data: days, isLoading, error } = useQuery({
    queryKey: ['token-usage', range],
    queryFn: () => aiService.getTokenUsage(range),
  })

  const totalInput = days?.reduce((s, d) => s + d.inputTokens, 0) ?? 0
  const totalOutput = days?.reduce((s, d) => s + d.outputTokens, 0) ?? 0
  const totalRequests = days?.reduce((s, d) => s + d.requestCount, 0) ?? 0
  const estimatedCost = totalInput * 0.000003 + totalOutput * 0.000015
  const totalUsed = totalInput + totalOutput

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>

        {/* Time range selector */}
        <div className="ml-auto flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                range === r
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('rangeDays', { days: r })}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -right-24 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl mx-auto px-6 py-8 pb-tabbar md:pb-8">
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

            {days && (
              <div className="space-y-4">
                {/* 4 stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    icon={<Coins className="size-4 text-primary" />}
                    label={t('rangeTokens', { days: range })}
                    value={fmt(totalUsed)}
                    sub={`${fmt(totalInput)} + ${fmt(totalOutput)}`}
                  />
                  <StatCard
                    icon={<ArrowDownToLine className="size-4 text-primary" />}
                    label={t('inputTokens')}
                    value={fmt(totalInput)}
                  />
                  <StatCard
                    icon={<ArrowUpFromLine className="size-4 text-primary" />}
                    label={t('outputTokens')}
                    value={fmt(totalOutput)}
                  />
                  <StatCard
                    icon={<MessageSquare className="size-4 text-primary" />}
                    label={t('queries')}
                    value={totalRequests.toString()}
                  />
                </div>

                {/* Cost + Quota */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StatCard
                    icon={<DollarSign className="size-4 text-primary" />}
                    label={t('estimatedCost')}
                    value={`$${estimatedCost.toFixed(4)}`}
                  />
                  {/* The quota is the current UTC month as enforced — not this window. */}
                  <QuotaCard />
                </div>

                {/* Line Chart */}
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-semibold mb-4">
                    {t('dailyChart')}{' '}
                    <span className="text-muted-foreground/50 font-normal">
                      ({t('rangeDays', { days: range })})
                    </span>
                  </h3>
                  <TokenLineChart
                    days={days}
                    inputLabel={t('inputTokens')}
                    outputLabel={t('outputTokens')}
                    noDataLabel={t('noData')}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
