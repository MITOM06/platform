'use client'

import { useCallback, useRef, useState } from 'react'
import type { TokenUsageDay } from '@/lib/api/ai'
import { fmtTokens as fmt } from '@/lib/usage/format'

// ── Interactive Line Chart (SVG) ───────────────────────────────────────────

interface TooltipState {
  x: number
  y: number
  day: TokenUsageDay
  pointX: number
}

export function TokenLineChart({ days, inputLabel, outputLabel, noDataLabel }: {
  days: TokenUsageDay[]; inputLabel: string; outputLabel: string; noDataLabel: string
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const W = 800
  const H = 220
  const PAD = { top: 16, right: 16, bottom: 32, left: 52 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const maxVal = Math.max(1, ...days.flatMap((d) => [d.inputTokens, d.outputTokens]))
  // Round up to a nice number for y-axis
  const yMax = Math.ceil(maxVal / 1000) * 1000

  const xOf = (i: number) => PAD.left + (i / Math.max(days.length - 1, 1)) * chartW
  const yOf = (v: number) => PAD.top + chartH - (v / yMax) * chartH

  const inputPoints = days.map((d, i) => `${xOf(i)},${yOf(d.inputTokens)}`).join(' ')
  const outputPoints = days.map((d, i) => `${xOf(i)},${yOf(d.outputTokens)}`).join(' ')

  // Y-axis ticks (4 steps)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    v: Math.round(yMax * f),
    y: PAD.top + chartH - f * chartH,
  }))

  // Pointer-agnostic core so the chart is readable on touch too — a mouse-only
  // handler leaves the tooltip permanently unreachable on a phone.
  const showTooltipAt = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current || days.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = W / rect.width
    const mx = (clientX - rect.left) * scaleX - PAD.left
    const idx = Math.round((mx / chartW) * (days.length - 1))
    const clamped = Math.max(0, Math.min(days.length - 1, idx))
    const px = xOf(clamped)
    setTooltip({ x: rect.left + px / scaleX, y: clientY, day: days[clamped], pointX: px })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => showTooltipAt(e.clientX, e.clientY),
    [showTooltipAt],
  )

  const handleTouch = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      const t = e.touches[0]
      if (t) showTooltipAt(t.clientX, t.clientY)
    },
    [showTooltipAt],
  )

  if (days.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground/50">
        {noDataLabel}
      </div>
    )
  }

  const activeIdx = tooltip
    ? Math.round(((tooltip.pointX - PAD.left) / chartW) * (days.length - 1))
    : -1

  return (
    <div className="relative">
      {/* touch-pan-y: horizontal touches drive the tooltip, but the vertical swipe
          must stay with the page or scrolling dies wherever the chart is. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y"
        style={{ height: 240 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={() => setTooltip(null)}
      >
        {/* Grid lines + Y labels */}
        {yTicks.map(({ v, y }) => (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end"
              fill="var(--muted-foreground)" fontSize={10} fontFamily="monospace">
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* X labels: first, last, and a few in between */}
        {[0, Math.floor(days.length / 3), Math.floor(2 * days.length / 3), days.length - 1]
          .filter((i, idx, arr) => arr.indexOf(i) === idx && days[i])
          .map((i) => (
            <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle"
              fill="var(--muted-foreground)" fontSize={10} fontFamily="monospace">
              {days[i].date.slice(5)}
            </text>
          ))}

        {/* Area fill under output line */}
        <defs>
          <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={`${xOf(0)},${PAD.top + chartH} ${outputPoints} ${xOf(days.length - 1)},${PAD.top + chartH}`}
          fill="url(#outputGrad)" stroke="none"
        />
        <polyline
          points={`${xOf(0)},${PAD.top + chartH} ${inputPoints} ${xOf(days.length - 1)},${PAD.top + chartH}`}
          fill="url(#inputGrad)" stroke="none"
        />

        {/* Lines */}
        <polyline points={outputPoints} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={inputPoints} fill="none" stroke="var(--primary)" strokeOpacity={0.45} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Hover vertical line + dots */}
        {tooltip && activeIdx >= 0 && (
          <>
            <line x1={tooltip.pointX} y1={PAD.top} x2={tooltip.pointX} y2={PAD.top + chartH}
              stroke="var(--border)" strokeWidth={1} strokeDasharray="4 3" />
            <circle cx={tooltip.pointX} cy={yOf(days[activeIdx].inputTokens)} r={5}
              fill="var(--primary)" fillOpacity={0.45} stroke="var(--card)" strokeWidth={2} />
            <circle cx={tooltip.pointX} cy={yOf(days[activeIdx].outputTokens)} r={5}
              fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
          </>
        )}
      </svg>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-card border border-border rounded-xl px-3 py-2.5 text-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 70 }}
        >
          <p className="text-muted-foreground/70 mb-1.5 font-mono">{tooltip.day.date}</p>
          <div className="flex items-center gap-2 mb-1">
            <span className="size-2 rounded-full bg-primary/45" />
            <span className="text-foreground">{inputLabel}: <strong>{fmt(tooltip.day.inputTokens)}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" />
            <span className="text-foreground">{outputLabel}: <strong>{fmt(tooltip.day.outputTokens)}</strong></span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 justify-center mt-3">
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-sm bg-primary/45" />
          <span className="text-xs text-muted-foreground">{inputLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-sm bg-primary" />
          <span className="text-xs text-muted-foreground">{outputLabel}</span>
        </div>
      </div>
    </div>
  )
}
