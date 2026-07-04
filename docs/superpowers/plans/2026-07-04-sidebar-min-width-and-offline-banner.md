# Plan: Sidebar Min Width + OfflineBanner Compact

> **Ngày:** 2026-07-04
> **Scope:** Web only (`apps/web/`)
> **2 issues.**

---

## Issue 1 — Sidebar drag minimum dừng sai chỗ

### Vấn đề hiện tại

Min drag width = 68px. Ở 68px: tabs icon-only ✓, conversation items **avatar-only** (text bị ẩn bởi `@[200px]` threshold).

User muốn: khi kéo hết, sidebar dừng ở điểm **tab vừa thu về icon-only** — conversation items vẫn còn đọc được (avatar + name). Không cho kéo nhỏ hơn nữa.

### Fix — `apps/web/app/(main)/layout.tsx`: Đổi min width thành 200px

Tìm đoạn `handleDragStart`, thay `Math.max(..., 68)` thành `Math.max(..., 200)`:

```tsx
// Trước:
const next = Math.min(
  Math.max(dragStartWidth.current + delta, 68),
  window.innerWidth * 0.8,
)

// Sau:
const next = Math.min(
  Math.max(dragStartWidth.current + delta, 200),
  window.innerWidth * 0.8,
)
```

Tương tự cập nhật validation khi đọc localStorage:

```tsx
// Trước:
if (!isNaN(w) && w >= 68 && w <= window.innerWidth * 0.8) {

// Sau:
if (!isNaN(w) && w >= 200 && w <= window.innerWidth * 0.8) {
```

### Kết quả

| Sidebar width | Tab bar | Conversation items |
|---|---|---|
| ≥ 200px | Icon + text | Avatar + name + preview ✓ |
| **= 200px (minimum)** | **Icon only** | **Avatar + name + preview ✓** |
| < 200px | *(không còn kéo được)* | *(không có)* |

Ở đúng 200px (minimum stop): `@[200px]:inline` ẩn tab text (tab chỉ còn icon), nhưng conversation item vẫn còn `@[200px]:block` cho phần text → avatar + name + preview vẫn hiển thị bình thường.

**Không cần thay đổi gì thêm** trong ConversationItem hay ConversationList — threshold `@[200px]` đã đúng.

---

## Issue 2 — OfflineBanner cần compact mode khi sidebar hẹp

### Vấn đề hiện tại

`OfflineBanner` luôn hiển thị full: icon + text "No internet connection", không có responsive behavior khi sidebar hẹp.

### Fix — `apps/web/components/chat/OfflineBanner.tsx`

Dùng `TooltipProvider` + `Tooltip` từ shadcn để icon-only khi compact, hover mới hiện text:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { stompService } from '@/lib/stomp/client'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const OFFLINE_DEBOUNCE_MS = 3_000

export function OfflineBanner() {
  const t = useTranslations('chat')
  const [isOffline, setIsOffline] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const unsubscribe = stompService.onStateChange((connected) => {
      if (connected) {
        clearTimeout(timerRef.current)
        setIsOffline(false)
      } else {
        timerRef.current = setTimeout(() => {
          setIsOffline(true)
        }, OFFLINE_DEBOUNCE_MS)
      }
    })
    return () => {
      unsubscribe()
      clearTimeout(timerRef.current)
    }
  }, [])

  if (!isOffline) return null

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="bg-red-500/10 border-b border-red-500/20 px-3 py-2 flex items-center gap-2 cursor-default">
            <WifiOff className="size-4 text-red-500 shrink-0" />
            {/* Text: ẩn khi sidebar compact (< 200px), hiển thị khi đủ rộng */}
            <span className="hidden @[200px]:inline text-sm font-medium text-red-600 dark:text-red-400 truncate">
              {t('offlineBanner')}
            </span>
          </div>
        </TooltipTrigger>
        {/* Tooltip chỉ hiện khi text bị ẩn (compact mode) — dùng @[200px] để ẩn tooltip khi full */}
        <TooltipContent side="right" className="@[200px]:hidden">
          <p>{t('offlineBanner')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

### Behavior

| Sidebar width | Banner hiển thị | Hover |
|---|---|---|
| ≥ 200px (full) | Icon + "No internet connection" | Không cần tooltip |
| = 200px (minimum) | Icon + text vẫn hiện (vừa đủ) | Không cần tooltip |

**Lưu ý:** Vì Issue 1 đặt min = 200px, sidebar không bao giờ xuống dưới 200px nữa → `@[200px]:hidden` tooltip sẽ luôn luôn ẩn trong thực tế. Tooltip là safety net nếu sau này min thay đổi, hoặc trên các screen size nhỏ hơn.

Nếu muốn test tooltip: tạm thời set min = 68px trong handleDragStart, kéo sidebar về 68px → icon-only + hover hiện tooltip.

---

---

## Issue 3 — Xóa nút toggle sidebar trong ConversationHeader

### Vấn đề

Button `PanelLeftOpen`/`PanelLeftClose` kế bên avatar trong header thừa — user kéo drag handle bằng tay thay thế.

### Fix — `apps/web/components/chat/ConversationHeader.tsx`

Xóa hoàn toàn đoạn button toggle (khoảng line 117-130):

```tsx
{/* XÓA toàn bộ block này: */}
{/* Sidebar toggle — desktop only. Shows/hides the conversation sidebar. */}
<Button variant="ghost" size="icon" className="hidden md:flex h-8 w-8 shrink-0" ...>
  {sidebarCollapsed ? <PanelLeftOpen .../> : <PanelLeftClose .../>}
</Button>
```

Xóa luôn các dòng không còn dùng ở đầu file:
```tsx
// Xóa khỏi import lucide-react:
PanelLeftOpen, PanelLeftClose

// Xóa khỏi component body:
const sidebarCollapsed = useUiStore((s) => s.sidebarWidth <= SIDEBAR_COLLAPSE_THRESHOLD)
const toggleSidebar = useUiStore((s) => s.toggleSidebar)
```

Nếu sau khi xóa `SIDEBAR_COLLAPSE_THRESHOLD` và `toggleSidebar` không còn được dùng ở **bất kỳ file nào khác**, xóa luôn khỏi `lib/store/ui.store.ts`. Nếu còn dùng ở nơi khác thì giữ nguyên store, chỉ xóa trong ConversationHeader.

---

## Verification

1. Kéo sidebar về bên trái → dừng lại khi tab bar chỉ còn icon (không text), conversation items vẫn còn avatar + tên.
2. Không thể kéo thêm vào nữa (min stop ở 200px).
3. Reload → sidebar nhớ width cũ (localStorage), nếu width cũ < 200 thì reset về 200.
4. Khi mất mạng (disconnect STOMP → wait 3s) → icon WifiOff hiện trong banner; khi sidebar ≥ 200px thì thấy text luôn; khi < 200px (nếu test ở min=68) thì chỉ icon, hover mới thấy "No internet connection".
5. Nút `PanelLeftOpen`/`PanelLeftClose` không còn xuất hiện trong ConversationHeader. Header chỉ còn avatar + tên + action buttons (phone, video, search, more).

---

## Lưu ý cho Claude Code

- `@[200px]:hidden` trên TooltipContent là Tailwind container query — cần `@tailwindcss/container-queries` đã được thêm ở plan trước. Nếu build lỗi, check lại plugin.
- `TooltipProvider` phải wrap bên ngoài `Tooltip` — đã include trong component để self-contained, không cần thêm vào layout.
- Không thay đổi gì trong ConversationItem, ConversationList, hay các component khác.
