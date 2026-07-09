# Plan: 5 UI Polish Issues

> **Ngày:** 2026-07-08
> **Scope:** Web + Flutter (mobile logo only)

---

## Issue 1 — Directory Card: dùng logo thật thay vì monogram

### Root cause
`DirectoryCard.tsx` dùng `entry.name.charAt(0).toUpperCase()` (monogram) thay vì logo thật.
`entry.icon` là slug string (`'asana'`, `'github'`, v.v.) — không được render.

### Fix — `apps/web/components/integrations/DirectoryCard.tsx`

Thêm function `DirectoryLogo` TRƯỚC `DirectoryCard` component (sau imports):

```tsx
const DIRECTORY_LOGO_URLS: Record<string, string> = {
  notion: 'https://www.notion.so/front-static/favicon.ico',
  linear: 'https://linear.app/favicon.ico',
  sentry: 'https://sentry.io/favicon.ico',
  atlassian: 'https://atlassian.com/favicon.ico',
  github: 'https://github.com/favicon.ico',
  stripe: 'https://stripe.com/favicon.ico',
  huggingface: 'https://huggingface.co/favicon.ico',
  asana: 'https://asana.com/favicon.ico',
  gmail: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
  calendar: 'https://calendar.google.com/googlecalendar/images/favicon_v2018_256.png',
  drive: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png',
}

function DirectoryLogo({ icon, name }: { icon: string; name: string }) {
  const url = DIRECTORY_LOGO_URLS[icon.toLowerCase()]
  if (!url) {
    return (
      <span className="text-lg font-bold text-pon-cyan" aria-hidden>
        {name.charAt(0).toUpperCase()}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      width={26}
      height={26}
      className="object-contain"
      onError={(e) => {
        // Fallback to monogram on load error
        const parent = (e.target as HTMLElement).parentElement
        if (parent) {
          parent.innerHTML = `<span class="text-lg font-bold text-pon-cyan">${name.charAt(0).toUpperCase()}</span>`
        }
      }}
    />
  )
}
```

Tìm đoạn trong `DirectoryCard`:
```tsx
<div className="size-[42px] rounded-[11px] grid place-items-center text-lg font-bold bg-background border text-pon-cyan shrink-0">
  <span aria-hidden>{monogram}</span>
</div>
```

Thay bằng:
```tsx
<div className="size-[42px] rounded-[11px] grid place-items-center bg-background border shrink-0 overflow-hidden">
  <DirectoryLogo icon={entry.icon} name={entry.name} />
</div>
```

Xóa dòng `const monogram = entry.name.charAt(0).toUpperCase()` (không còn dùng).

---

## Issue 2 — Hiển thị thời gian offline ("hoạt động 1 giờ trước")

### Root cause
`ConversationHeader.tsx` line 196: chỉ hiển thị `t('online')` hoặc `t('offline')`.
`UserStatus` type có `lastSeen: string | null` — nhưng không được dùng.

### Fix — `apps/web/components/chat/ConversationHeader.tsx`

Thêm helper `formatLastSeen` vào đầu file (sau imports):

```tsx
function formatLastSeen(lastSeen: string | null, t: (key: string, params?: Record<string, unknown>) => string): string {
  if (!lastSeen) return t('offline')
  const diffMs = Date.now() - new Date(lastSeen).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHour = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return t('justNow')           // "Vừa online"
  if (diffMin < 60) return t('minutesAgo', { count: diffMin })  // "5 phút trước"
  if (diffHour < 24) return t('hoursAgo', { count: diffHour })  // "2 giờ trước"
  if (diffDay < 7) return t('daysAgo', { count: diffDay })      // "3 ngày trước"
  return t('offline')
}
```

Tìm đoạn hiển thị status text (khoảng line 194-198):
```tsx
) : otherUserId && status && !blockedMe ? (
  <p className="text-xs text-muted-foreground">
    {status.online ? t('online') : t('offline')}
  </p>
```

Thay thành:
```tsx
) : otherUserId && status && !blockedMe ? (
  <p className="text-xs text-muted-foreground">
    {status.online ? t('online') : formatLastSeen(status.lastSeen, t)}
  </p>
```

**Thêm i18n keys** vào tất cả 7 `messages/*.json` (namespace `"chat"`):
```json
// en.json:
"justNow": "Just now",
"minutesAgo": "{count} min ago",
"hoursAgo": "{count}h ago",
"daysAgo": "{count}d ago"

// vi.json:
"justNow": "Vừa online",
"minutesAgo": "{count} phút trước",
"hoursAgo": "{count} giờ trước",
"daysAgo": "{count} ngày trước"

// zh.json:
"justNow": "刚刚在线",
"minutesAgo": "{count}分钟前",
"hoursAgo": "{count}小时前",
"daysAgo": "{count}天前"

// ja.json:
"justNow": "たった今",
"minutesAgo": "{count}分前",
"hoursAgo": "{count}時間前",
"daysAgo": "{count}日前"

// ko.json:
"justNow": "방금 전",
"minutesAgo": "{count}분 전",
"hoursAgo": "{count}시간 전",
"daysAgo": "{count}일 전"

// fr.json:
"justNow": "À l'instant",
"minutesAgo": "Il y a {count} min",
"hoursAgo": "Il y a {count}h",
"daysAgo": "Il y a {count}j"

// es.json:
"justNow": "Justo ahora",
"minutesAgo": "Hace {count} min",
"hoursAgo": "Hace {count}h",
"daysAgo": "Hace {count}d"
```

**Lưu ý:** `next-intl` dùng `{count}` placeholder trong messages — không phải `{{count}}`.

---

## Issue 3 — Ẩn chấm xanh trên avatar của chính mình

### Các vị trí bị ảnh hưởng

**Vị trí 1: `apps/web/app/(main)/settings/page.tsx` line 207**

Tìm:
```tsx
<div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-online-green border-2 border-background" />
```

Xóa dòng này hoàn toàn. Avatar của chính user không cần hiển thị trạng thái online vì luôn luôn là "đang online" khi đang dùng app — gây misleading.

**Vị trí 2: Kiểm tra `ConversationItem.tsx`**

Ở ConversationItem, green dot hiện ra dựa vào `status` của `otherUserId` — không phải currentUser → không bị ảnh hưởng. Không cần sửa.

**Vị trí 3: Kiểm tra `ConversationHeader.tsx`**

Green dot trong header ở line ~167:
```tsx
{otherUserId && status?.online && !blockedMe && (
  <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-[#00E676] ..." />
)}
```

Điều kiện `otherUserId` đảm bảo chỉ hiện dot cho OTHER user — đúng behavior. Không cần sửa.

**Kết luận:** Chỉ cần xóa dot ở `settings/page.tsx`.

---

## Issue 4 — Token Usage: redesign UI to be bigger, interactive line chart

### Vấn đề với UI hiện tại
- Layout quá hẹp (`max-w-lg`)
- Canvas bar chart, không có hover tooltip
- Không có time range selector
- Không hiện chi tiết input/output tokens riêng

### Fix — `apps/web/app/(main)/token-usage/page.tsx`

**Rewrite toàn bộ file** (dùng React SVG thay Canvas để support hover):

```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft, Coins, MessageSquare, DollarSign,
  Activity, Loader2, AlertCircle, ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react'
import { aiService, type TokenUsageDay } from '@/lib/api/ai'

// ── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, glowColor }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; glowColor: string
}) {
  return (
    <div className="relative rounded-2xl border bg-card p-5 overflow-hidden transition-all hover:shadow-xl group">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(circle at 20% 50%, ${glowColor}, transparent 70%)` }}
      />
      <div className="relative">
        <div className="mb-3 p-2 rounded-lg w-fit" style={{ background: glowColor }}>{icon}</div>
        <p className="text-3xl font-bold text-foreground tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground/60 mt-0.5 tabular-nums">{sub}</p>}
        <p className="text-xs text-muted-foreground mt-2">{label}</p>
      </div>
    </div>
  )
}

// ── Quota Progress ─────────────────────────────────────────────────────────

function QuotaProgress({ used, limit, monthlyLimitLabel, usedPercentLabel }: {
  used: number; limit: number; monthlyLimitLabel: string;
  usedPercentLabel: (p: string) => string
}) {
  const fraction = Math.min(used / limit, 1)
  const percent = (fraction * 100).toFixed(1)
  const barColor = fraction >= 0.9 ? '#EF4444' : fraction >= 0.7 ? '#FB923C' : '#6AC9FF'

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="size-4" style={{ color: barColor }} />
          <span className="text-sm font-semibold">{monthlyLimitLabel}</span>
        </div>
        <span className="text-sm font-bold tabular-nums" style={{ color: barColor }}>
          {fmt(used)} / {fmt(limit)}
        </span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${barColor}cc, ${barColor})` }}
        />
      </div>
      <p className="text-xs text-muted-foreground/60 mt-2">{usedPercentLabel(percent)}</p>
    </div>
  )
}

// ── Interactive Line Chart (SVG) ───────────────────────────────────────────

interface TooltipState {
  x: number
  y: number
  day: TokenUsageDay
  pointX: number
}

function LineChart({ days, inputLabel, outputLabel, noDataLabel }: {
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

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || days.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = W / rect.width
    const mx = (e.clientX - rect.left) * scaleX - PAD.left
    const idx = Math.round((mx / chartW) * (days.length - 1))
    const clamped = Math.max(0, Math.min(days.length - 1, idx))
    const px = xOf(clamped)
    const screenX = rect.left + px / scaleX
    const screenY = e.clientY
    setTooltip({ x: screenX, y: screenY, day: days[clamped], pointX: px })
  }, [days, W, PAD, chartW])

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
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 240 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines + Y labels */}
        {yTicks.map(({ v, y }) => (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end"
              fill="rgba(156,163,175,0.7)" fontSize={10} fontFamily="monospace">
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* X labels: first, last, and a few in between */}
        {[0, Math.floor(days.length / 3), Math.floor(2 * days.length / 3), days.length - 1]
          .filter((i, idx, arr) => arr.indexOf(i) === idx && days[i])
          .map((i) => (
            <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle"
              fill="rgba(156,163,175,0.6)" fontSize={10} fontFamily="monospace">
              {days[i].date.slice(5)}
            </text>
          ))}

        {/* Area fill under output line */}
        <defs>
          <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B47FFF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#B47FFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
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
        <polyline points={outputPoints} fill="none" stroke="#B47FFF" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={inputPoints} fill="none" stroke="#00E5FF" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Hover vertical line + dots */}
        {tooltip && activeIdx >= 0 && (
          <>
            <line x1={tooltip.pointX} y1={PAD.top} x2={tooltip.pointX} y2={PAD.top + chartH}
              stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4 3" />
            <circle cx={tooltip.pointX} cy={yOf(days[activeIdx].inputTokens)} r={5}
              fill="#00E5FF" stroke="#0a0a0a" strokeWidth={2} />
            <circle cx={tooltip.pointX} cy={yOf(days[activeIdx].outputTokens)} r={5}
              fill="#B47FFF" stroke="#0a0a0a" strokeWidth={2} />
          </>
        )}
      </svg>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-card border border-border rounded-xl px-3 py-2.5 shadow-2xl text-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 70 }}
        >
          <p className="text-muted-foreground/70 mb-1.5 font-mono">{tooltip.day.date}</p>
          <div className="flex items-center gap-2 mb-1">
            <span className="size-2 rounded-full bg-[#00E5FF]" />
            <span className="text-foreground">{inputLabel}: <strong>{fmt(tooltip.day.inputTokens)}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#B47FFF]" />
            <span className="text-foreground">{outputLabel}: <strong>{fmt(tooltip.day.outputTokens)}</strong></span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 justify-center mt-3">
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-sm bg-[#00E5FF]" />
          <span className="text-xs text-muted-foreground">{inputLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-sm bg-[#B47FFF]" />
          <span className="text-xs text-muted-foreground">{outputLabel}</span>
        </div>
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
  const MONTHLY_QUOTA = 500_000

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
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
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-pon-cyan/5 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -right-24 w-72 h-72 rounded-full bg-[#B47FFF]/5 blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl mx-auto px-6 py-8">
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
                    label={t('thisMonth')}
                    value={fmt(totalUsed)}
                    sub={`${fmt(totalInput)} + ${fmt(totalOutput)}`}
                    glowColor="rgba(106,201,255,0.08)"
                  />
                  <StatCard
                    icon={<ArrowDownToLine className="size-4 text-[#00E5FF]" />}
                    label={t('inputTokens')}
                    value={fmt(totalInput)}
                    glowColor="rgba(0,229,255,0.08)"
                  />
                  <StatCard
                    icon={<ArrowUpFromLine className="size-4 text-[#B47FFF]" />}
                    label={t('outputTokens')}
                    value={fmt(totalOutput)}
                    glowColor="rgba(180,127,255,0.08)"
                  />
                  <StatCard
                    icon={<MessageSquare className="size-4 text-pon-peach" />}
                    label={t('queries')}
                    value={totalRequests.toString()}
                    glowColor="rgba(251,182,139,0.08)"
                  />
                </div>

                {/* Cost + Quota */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StatCard
                    icon={<DollarSign className="size-4 text-pon-peach" />}
                    label={t('estimatedCost')}
                    value={`$${estimatedCost.toFixed(4)}`}
                    glowColor="rgba(251,182,139,0.08)"
                  />
                  <QuotaProgress
                    used={totalUsed}
                    limit={MONTHLY_QUOTA}
                    monthlyLimitLabel={t('monthlyLimit')}
                    usedPercentLabel={(p) => t('usedPercent', { percent: p })}
                  />
                </div>

                {/* Line Chart */}
                <div className="rounded-2xl border bg-card p-5">
                  <h3 className="text-sm font-semibold mb-4">
                    {t('dailyChart')} <span className="text-muted-foreground/50 font-normal">({range}d)</span>
                  </h3>
                  <LineChart
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
```

**Thêm i18n keys** `inputTokens` và `outputTokens` vào `messages/*.json` namespace `"tokenUsage"` nếu chưa có.

---

## Issue 5 — Mobile: thay logo Flutter mặc định bằng logo PON

### Vấn đề
Flutter tạo default icon (Flutter logo xanh) ở:
- iOS: `ios/Runner/Assets.xcassets/AppIcon.appiconset/*.png`
- Android: `android/app/src/main/res/mipmap-*/ic_launcher.png`

### Cách làm đúng — dùng `flutter_launcher_icons`

**Bước 1:** Mày cần chuẩn bị một file PNG logo của PON, tối thiểu **1024x1024px**, nền trong suốt hoặc màu nền phù hợp. Đặt vào: `apps/client/assets/images/app_icon.png`

**Bước 2:** `apps/client/pubspec.yaml` — thêm package và config:

```yaml
# Trong dev_dependencies:
dev_dependencies:
  flutter_launcher_icons: ^0.14.3

# Thêm section mới ở cuối file:
flutter_launcher_icons:
  android: true
  ios: true
  image_path: "assets/images/app_icon.png"
  # iOS: không cần nền vì iOS 20+ dùng adaptive icons
  adaptive_icon_background: "#0A0A0A"   # màu nền dark của PON
  adaptive_icon_foreground: "assets/images/app_icon_foreground.png"
  min_sdk_android: 21
  web:
    generate: false
  remove_alpha_ios: true
```

**Bước 3:** Chạy:
```bash
cd apps/client
flutter pub get
flutter pub run flutter_launcher_icons
```

→ Tool tự generate tất cả kích thước cần thiết và replace các file PNG.

### Nếu chưa có logo file

Cần Claude Code tạo một SVG đơn giản cho PON app icon dạng:
- Nền màu gradient dark (#0A0A0F → #1a1a2e)
- Chữ "P" hoặc logo PON ở giữa với màu pon-cyan (#00E5FF)
- Convert sang PNG 1024x1024 bằng Inkscape/Imagemagick

Hoặc mày cung cấp file logo PNG cho Claude Code để đặt vào đúng thư mục.

**Lưu ý cho Claude Code:**
- Nếu không có file logo sẵn, tạo file SVG simple rồi convert → PNG bằng `rsvg-convert` hoặc Python `cairosvg`.
- Sau khi generate icon: rebuild app để verify icon mới xuất hiện.

---

## Verification

1. **Directory logos**: Mở `/integrations` → Directory section → cards hiển thị logo thật (Asana, GitHub, Notion, Linear... — không còn chữ cái đơn lẻ).

2. **Offline time**: Vào conversation 1-1 với user đang offline → header hiển thị "3 giờ trước" thay vì "Offline".

3. **Settings dot**: Vào `/settings` → avatar của chính mình không có chấm xanh.

4. **Token Usage**: Vào `/token-usage`:
   - Có 3 nút 7d / 30d / 90d ở header, click đổi range, chart cập nhật
   - 4 stat cards: Total / Input / Output / Queries
   - Line chart SVG với 2 đường (cyan = input, purple = output)
   - Di chuột vào chart → tooltip floating hiển thị input/output tại ngày đó

5. **Mobile logo**: Chạy app trên iOS Simulator hoặc thiết bị → màn hình home/launch hiển thị PON logo thay vì Flutter logo.

---

## Lưu ý cho Claude Code

- **Issue 1**: `img` tag với `onError` handle graceful fallback — không dùng `next/image` để tránh cần cấu hình `domains` cho nhiều external domain.
- **Issue 2**: `formatLastSeen` là pure function, đặt ở module scope. `t()` từ `useTranslations('chat')` đã được dùng trong component, truyền vào function.
- **Issue 3**: Chỉ xóa 1 dòng trong settings/page.tsx. Không đụng ConversationItem hay ConversationHeader.
- **Issue 4**: File Token Usage page được **rewrite hoàn toàn** — xóa toàn bộ nội dung cũ và thay bằng code mới trong plan. Import `ArrowDownToLine` và `ArrowUpFromLine` từ `lucide-react`.
- **Issue 4**: `fixed` positioning cho tooltip — hoạt động đúng khi chart nằm trong scrollable container.
- **Issue 4**: `useCallback` cho `handleMouseMove` dependency array cần include `days`, `W`, `PAD`, `chartW` — nhưng vì `W` và `PAD` là constants, chỉ cần `[days]`.
- **Issue 5**: Nếu không có logo file, tạo SVG placeholder đơn giản rồi convert PNG.
- Chạy `pnpm build` trong `apps/web/` để verify TypeScript.
