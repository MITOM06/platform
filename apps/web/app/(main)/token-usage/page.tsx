'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Coins,
  MessageSquare,
  DollarSign,
  Activity,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { aiService, type TokenUsageDay } from '@/lib/api/ai'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  glowColor,
}: {
  label: string
  value: string
  icon: React.ReactNode
  glowColor: string
}) {
  return (
    <div
      className="relative rounded-xl border bg-card p-4 overflow-hidden transition-all hover:shadow-lg group"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
        style={{
          background: `radial-gradient(circle at 20% 50%, ${glowColor}, transparent 70%)`,
        }}
      />
      <div className="relative">
        <div className="mb-3">{icon}</div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  )
}

// ── Quota Progress ───────────────────────────────────────────────────────────

function QuotaProgress({ used, limit, usedPercentLabel, monthlyLimitLabel }: { used: number; limit: number; usedPercentLabel: (percent: string) => string; monthlyLimitLabel: string }) {
  const fraction = Math.min(used / limit, 1)
  const percent = (fraction * 100).toFixed(1)

  const barColor =
    fraction >= 0.9
      ? 'rgb(239 68 68)' // red
      : fraction >= 0.7
        ? 'rgb(251 146 60)' // orange
        : 'rgb(106 201 255)' // pon-cyan

  return (
    <div className="rounded-xl border bg-card p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4" style={{ color: barColor }} />
          <span className="text-sm font-semibold text-muted-foreground">{monthlyLimitLabel}</span>
        </div>
        <span className="text-sm font-bold" style={{ color: barColor }}>
          {fmt(used)} / {fmt(limit)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percent}%`, background: barColor }}
        />
      </div>

      <p className="text-xs text-muted-foreground/60 mt-2">{usedPercentLabel(percent)}</p>
    </div>
  )
}

// ── Bar Chart (Canvas) ───────────────────────────────────────────────────────

function BarChart({ days, inputLabel, outputLabel, noDataLabel }: { days: TokenUsageDay[]; inputLabel: string; outputLabel: string; noDataLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || days.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const maxVal = Math.max(1, ...days.map((d) => d.totalTokens))
    const barW = (rect.width / days.length) * 0.6
    const gap = rect.width / days.length
    const chartH = rect.height - 20

    const inputColor = '#00E5FF'
    const outputColor = '#B47FFF'

    for (let i = 0; i < days.length; i++) {
      const d = days[i]
      const x = i * gap + (gap - barW) / 2
      if (d.totalTokens === 0) continue

      const totalH = (d.totalTokens / maxVal) * chartH
      const inputH = (d.inputTokens / maxVal) * chartH
      const outputH = totalH - inputH

      // Output (top)
      ctx.fillStyle = outputColor
      ctx.beginPath()
      ctx.roundRect(x, chartH - totalH, barW, outputH, [3, 3, 0, 0])
      ctx.fill()

      // Input (bottom)
      ctx.fillStyle = inputColor
      ctx.fillRect(x, chartH - inputH, barW, inputH)
    }

    // Legend at bottom
    ctx.font = '10px system-ui'
    ctx.fillStyle = '#9CA3AF'
    if (days.length > 0) {
      ctx.fillText(days[0].date.slice(5), 2, rect.height - 2)
    }
    if (days.length > 1) {
      const lastLabel = days[days.length - 1].date.slice(5)
      const measure = ctx.measureText(lastLabel)
      ctx.fillText(lastLabel, rect.width - measure.width - 2, rect.height - 2)
    }
  }, [days])

  if (days.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground/50">
        {noDataLabel}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="w-full h-40" />
      {/* Legend */}
      <div className="flex items-center gap-6 justify-center">
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-sm" style={{ background: '#00E5FF' }} />
          <span className="text-xs text-muted-foreground">{inputLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-sm" style={{ background: '#B47FFF' }} />
          <span className="text-xs text-muted-foreground">{outputLabel}</span>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function TokenUsagePage() {
  const t = useTranslations('tokenUsage')
  const { data: days, isLoading, error } = useQuery({
    queryKey: ['token-usage', 30],
    queryFn: () => aiService.getTokenUsage(30),
  })

  const totalInput = days?.reduce((s, d) => s + d.inputTokens, 0) ?? 0
  const totalOutput = days?.reduce((s, d) => s + d.outputTokens, 0) ?? 0
  const totalRequests = days?.reduce((s, d) => s + d.requestCount, 0) ?? 0
  const estimatedCost = totalInput * 0.000003 + totalOutput * 0.000015
  const totalUsed = totalInput + totalOutput
  const MONTHLY_QUOTA = 500_000

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Background glows */}
        <div className="relative">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-pon-cyan/5 blur-3xl pointer-events-none dark:bg-pon-cyan/8" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-[#B47FFF]/5 blur-3xl pointer-events-none dark:bg-[#B47FFF]/8" />

          <div className="relative max-w-lg mx-auto px-6 py-8">
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
              <div className="space-y-5">
                {/* Summary stat cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StatCard
                    icon={<Coins className="size-5 text-primary" />}
                    label={t('thisMonth')}
                    value={fmt(totalUsed)}
                    glowColor="rgba(106,201,255,0.06)"
                  />
                  <StatCard
                    icon={<MessageSquare className="size-5 text-[#B47FFF]" />}
                    label={t('queries')}
                    value={totalRequests.toString()}
                    glowColor="rgba(180,127,255,0.06)"
                  />
                </div>

                <StatCard
                  icon={<DollarSign className="size-5 text-pon-peach" />}
                  label={t('estimatedCost')}
                  value={`$${estimatedCost.toFixed(4)}`}
                  glowColor="rgba(251,182,139,0.06)"
                />

                {/* Quota progress bar */}
                <QuotaProgress
                  used={totalUsed}
                  limit={MONTHLY_QUOTA}
                  monthlyLimitLabel={t('monthlyLimit')}
                  usedPercentLabel={(percent) => t('usedPercent', { percent })}
                />

                {/* Daily chart */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    {t('dailyChart')}
                  </h3>
                  <div className="rounded-xl border bg-card p-4">
                    <BarChart
                      days={days}
                      inputLabel={t('inputTokens')}
                      outputLabel={t('outputTokens')}
                      noDataLabel={t('noData')}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
