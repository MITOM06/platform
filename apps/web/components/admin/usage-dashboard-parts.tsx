'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import type {
  UsageDailyPoint,
  UsagePerModelCost,
  UsageTopUser,
  UsageWorstAnswer,
} from '@/lib/api/types'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'

// ── number helpers (shared with the dashboard) ──────────────────────────────

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

// ── Stat card ────────────────────────────────────────────────────────────────

export function StatCard({
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
    <div className="relative rounded-xl border bg-card p-4 overflow-hidden transition-all hover:shadow-lg group">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
        style={{ background: `radial-gradient(circle at 20% 50%, ${glowColor}, transparent 70%)` }}
      />
      <div className="relative">
        <div className="mb-3">{icon}</div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  )
}

// ── Daily bar chart (canvas — reused from /token-usage) ─────────────────────

export function DailyBarChart({
  days,
  inputLabel,
  outputLabel,
  noDataLabel,
}: {
  days: UsageDailyPoint[]
  inputLabel: string
  outputLabel: string
  noDataLabel: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const t = useTranslations('usageDashboard')

  // Compute summary values from the days data
  const total = days.reduce((sum, d) => sum + d.totalTokens, 0)
  const peakDay = days.reduce<UsageDailyPoint | null>((best, d) => {
    if (!best || d.totalTokens > best.totalTokens) return d
    return best
  }, null)
  const peakLabel = peakDay ? `${peakDay.date.slice(5)} (${fmtTokens(peakDay.totalTokens)})` : '—'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || days.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
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

        ctx.fillStyle = outputColor
        ctx.beginPath()
        ctx.roundRect(x, chartH - totalH, barW, outputH, [3, 3, 0, 0])
        ctx.fill()

        ctx.fillStyle = inputColor
        ctx.fillRect(x, chartH - inputH, barW, inputH)
      }

      // Thin x-axis labels on narrow widths to prevent overlap
      const step = rect.width < 480 ? Math.ceil(days.length / 6) : 1

      ctx.font = '10px system-ui'
      ctx.fillStyle = '#9CA3AF'

      days.forEach((d, i) => {
        if (i % step !== 0) return
        const x = i * gap + (gap - barW) / 2
        const label = d.date.slice(5)
        // Right-align last visible label, left-align first, center others
        if (i === 0) {
          ctx.fillText(label, x, rect.height - 2)
        } else {
          const measure = ctx.measureText(label)
          const labelX = Math.min(x - measure.width / 2, rect.width - measure.width - 2)
          ctx.fillText(label, Math.max(0, labelX), rect.height - 2)
        }
      })
    }

    draw()

    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
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
      <div className="mb-2 text-sm text-muted-foreground">
        {t('usageDailySummary', { total: total.toLocaleString(), peak: peakLabel })}
      </div>
      <canvas ref={canvasRef} className="w-full h-40" />
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

// ── Per-model cost table ─────────────────────────────────────────────────────

const perModelColumns: ResponsiveColumn<UsagePerModelCost>[] = [
  { key: 'model', header: 'Model', primary: true },
  {
    key: 'inputTokens',
    header: 'Input',
    render: (r) => fmtTokens(r.inputTokens),
  },
  {
    key: 'outputTokens',
    header: 'Output',
    render: (r) => fmtTokens(r.outputTokens),
  },
  {
    key: 'requestCount',
    header: 'Requests',
    render: (r) => r.requestCount.toLocaleString(),
  },
  {
    key: 'costUsd',
    header: 'Cost',
    render: (r) => fmtUsd(r.costUsd),
    className: 'text-pon-peach font-medium',
  },
]

export function PerModelCostTable({ rows }: { rows: UsagePerModelCost[] }) {
  const t = useTranslations('usageDashboard')

  // Override headers with translated strings at render time
  const columns: ResponsiveColumn<UsagePerModelCost>[] = [
    { ...perModelColumns[0], header: t('model') },
    { ...perModelColumns[1], header: t('inputTokens') },
    { ...perModelColumns[2], header: t('outputTokens') },
    { ...perModelColumns[3], header: t('requests') },
    { ...perModelColumns[4], header: t('cost') },
  ]

  return (
    <ResponsiveTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.model}
      empty={t('noData')}
    />
  )
}

// ── Top users table ──────────────────────────────────────────────────────────

const topUsersColumnsBase: ResponsiveColumn<UsageTopUser>[] = [
  { key: 'displayName', header: 'User', primary: true },
  {
    key: 'totalTokens',
    header: 'Tokens',
    render: (r) => fmtTokens(r.totalTokens),
  },
  {
    key: 'requestCount',
    header: 'Requests',
    render: (r) => r.requestCount.toLocaleString(),
  },
  {
    key: 'estimatedCostUsd',
    header: 'Cost',
    render: (r) => fmtUsd(r.estimatedCostUsd),
  },
]

export function TopUsersTable({ users }: { users: UsageTopUser[] }) {
  const t = useTranslations('usageDashboard')

  const columns: ResponsiveColumn<UsageTopUser>[] = [
    { ...topUsersColumnsBase[0], header: t('user') },
    { ...topUsersColumnsBase[1], header: t('tokens') },
    { ...topUsersColumnsBase[2], header: t('requests') },
    { ...topUsersColumnsBase[3], header: t('cost') },
  ]

  return (
    <ResponsiveTable
      columns={columns}
      rows={users}
      getRowKey={(r) => r.userId}
      empty={t('noData')}
    />
  )
}

// ── Worst-rated answers list ─────────────────────────────────────────────────

export function WorstAnswers({ answers }: { answers: UsageWorstAnswer[] }) {
  const t = useTranslations('usageDashboard')

  if (answers.length === 0) {
    return <p className="text-sm text-muted-foreground/60">{t('noWorstAnswers')}</p>
  }

  return (
    <div className="space-y-2">
      {answers.map((a) => (
        <div key={a.messageId} className="rounded-lg border px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">👎</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}
            </span>
          </div>
          <p className="text-sm text-foreground/90 line-clamp-3">{a.answerPreview}</p>
          {a.comment && (
            <p className="text-xs text-destructive/80 italic">&ldquo;{a.comment}&rdquo;</p>
          )}
        </div>
      ))}
    </div>
  )
}
