'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import type {
  UsageDailyPoint,
  UsagePerModelCost,
  UsageTopUser,
  UsageWorstAnswer,
} from '@/lib/api/types'

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

      ctx.fillStyle = outputColor
      ctx.beginPath()
      ctx.roundRect(x, chartH - totalH, barW, outputH, [3, 3, 0, 0])
      ctx.fill()

      ctx.fillStyle = inputColor
      ctx.fillRect(x, chartH - inputH, barW, inputH)
    }

    ctx.font = '10px system-ui'
    ctx.fillStyle = '#9CA3AF'
    if (days.length > 0) ctx.fillText(days[0].date.slice(5), 2, rect.height - 2)
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

export function PerModelCostTable({ rows }: { rows: UsagePerModelCost[] }) {
  const t = useTranslations('usageDashboard')

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground/60">{t('noData')}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b">
            <th className="py-2 pr-3 font-medium">{t('model')}</th>
            <th className="py-2 px-3 font-medium text-right">{t('inputTokens')}</th>
            <th className="py-2 px-3 font-medium text-right">{t('outputTokens')}</th>
            <th className="py-2 px-3 font-medium text-right">{t('requests')}</th>
            <th className="py-2 pl-3 font-medium text-right">{t('cost')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.model} className="border-b last:border-0">
              <td className="py-2 pr-3 font-mono text-xs">{r.model}</td>
              <td className="py-2 px-3 text-right tabular-nums">{fmtTokens(r.inputTokens)}</td>
              <td className="py-2 px-3 text-right tabular-nums">{fmtTokens(r.outputTokens)}</td>
              <td className="py-2 px-3 text-right tabular-nums">{r.requestCount}</td>
              <td className="py-2 pl-3 text-right tabular-nums font-medium text-pon-peach">
                {fmtUsd(r.costUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Top users table ──────────────────────────────────────────────────────────

export function TopUsersTable({ users }: { users: UsageTopUser[] }) {
  const t = useTranslations('usageDashboard')

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground/60">{t('noData')}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b">
            <th className="py-2 pr-3 font-medium">{t('user')}</th>
            <th className="py-2 px-3 font-medium text-right">{t('tokens')}</th>
            <th className="py-2 px-3 font-medium text-right">{t('requests')}</th>
            <th className="py-2 pl-3 font-medium text-right">{t('cost')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.userId} className="border-b last:border-0">
              <td className="py-2 pr-3 font-medium truncate max-w-[12rem]">{u.displayName}</td>
              <td className="py-2 px-3 text-right tabular-nums">{fmtTokens(u.totalTokens)}</td>
              <td className="py-2 px-3 text-right tabular-nums">{u.requestCount}</td>
              <td className="py-2 pl-3 text-right tabular-nums">{fmtUsd(u.estimatedCostUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
            <p className="text-xs text-destructive/80 italic">“{a.comment}”</p>
          )}
        </div>
      ))}
    </div>
  )
}
