# Plan: Fix Loading Feedback + Restore Sidebar Drag-Resize

> **Ngày:** 2026-07-02  
> **Ưu tiên: URGENT** — 2 bug do implement sai plan cũ.  
> **Scope:** Web only (`apps/web/`).

---

## Issue 1 — Loading feedback không hiện khi navigate/load data

### Root cause

`NextTopLoader` chỉ fire trong thời gian route transition (~50-100ms). Cái "đứng màn hình" user thấy là **sau** khi route đã đổi, trong khi TanStack Query đang fetch data — lúc đó bar đã tắt. Cần thêm in-page loading skeleton.

### Fix 1a — Tăng visibility của NextTopLoader

**File**: `apps/web/app/layout.tsx`

```tsx
<NextTopLoader
  color="#6AC9FF"
  height={3}           // tăng từ 2 lên 3px — dễ thấy hơn
  showSpinner={false}
  shadow="0 0 12px #6AC9FF, 0 0 6px #6AC9FF"
  initialPosition={0.1}
  crawlSpeed={200}
/>
```

### Fix 1b — Conversation page: skeleton khi chưa có conversation data

**File**: `apps/web/app/(main)/conversations/[id]/page.tsx`

Tìm đoạn `const { data: conversation } = useConversation(id)` — hiện không có loading state cho `conversation`. Thêm skeleton full-page khi cả conversation lẫn messages chưa load:

```tsx
const { data: conversation, isLoading: convLoading } = useConversation(id)
// ...
const { data, isLoading: msgLoading, ... } = useMessages(id)

// Hiển thị full skeleton khi conversation chưa load (first visit, no cache)
if (convLoading && !conversation) {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="h-14 border-b px-4 flex items-center gap-3 shrink-0">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
      </div>
      {/* Message skeletons */}
      <div className="flex-1 p-4 space-y-3 overflow-hidden">
        {[80, 55, 70, 40, 65, 50].map((w, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
            {i % 2 !== 0 && <Skeleton className="size-7 rounded-full mr-2 shrink-0 self-end" />}
            <Skeleton
              className="h-9 rounded-2xl"
              style={{ width: `${w}%`, maxWidth: '320px' }}
            />
          </div>
        ))}
      </div>
      {/* Input skeleton */}
      <div className="h-16 border-t px-4 flex items-center gap-3 shrink-0">
        <Skeleton className="flex-1 h-10 rounded-xl" />
        <Skeleton className="size-9 rounded-full" />
      </div>
    </div>
  )
}
```

Import cần thêm: `import { Skeleton } from '@/components/ui/skeleton'`

### Fix 1c — ConversationList: skeleton đã có, chỉ cần verify

`ConversationList.tsx` đã có `ConversationSkeleton` và check `isLoading`. Không cần thay đổi.

---

## Issue 2 — Sidebar drag-resize bị xóa, thay bằng 2-state toggle (SAI)

### Root cause

Commit `1fca0533` implement plan cũ sai — xóa drag-resize, thay bằng toggle ẩn/hiện. User muốn **giữ drag-resize** và nội dung sidebar tự adapt khi kéo hẹp.

### Fix 2a — `apps/web/app/(main)/layout.tsx`: Khôi phục drag-resize

**Xóa bỏ** phần 2-state toggle hiện tại:
```tsx
// XÓA các dòng này:
const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)
const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
useEffect(() => {
  if (localStorage.getItem('pon-sidebar-collapsed') === 'true') {
    setSidebarCollapsed(true)
  }
}, [setSidebarCollapsed])
```

**Thêm lại** drag-resize code từ commit `1a25b217` (đây là code ĐÚNG cần restore):

```tsx
import { useState, useRef, useEffect, type CSSProperties } from 'react'

// ── Resizable sidebar (desktop only) ──────────────────────────────────────
const [sidebarWidth, setSidebarWidth] = useState(288)
const isDragging = useRef(false)
const dragStartX = useRef(0)
const dragStartWidth = useRef(0)
const currentWidth = useRef(288)

// Restore persisted width on mount
useEffect(() => {
  const stored = localStorage.getItem('pon-sidebar-width')
  if (stored) {
    const w = parseInt(stored, 10)
    if (!isNaN(w) && w >= 68 && w <= window.innerWidth * 0.8) {
      setSidebarWidth(w)
      currentWidth.current = w
    }
  }
}, [])

const handleDragStart = (e: React.MouseEvent) => {
  e.preventDefault()
  isDragging.current = true
  dragStartX.current = e.clientX
  dragStartWidth.current = sidebarWidth

  const onMove = (ev: MouseEvent) => {
    if (!isDragging.current) return
    const delta = ev.clientX - dragStartX.current
    const next = Math.min(
      Math.max(dragStartWidth.current + delta, 68),
      window.innerWidth * 0.8,
    )
    currentWidth.current = next
    setSidebarWidth(next)
  }
  const onUp = () => {
    isDragging.current = false
    localStorage.setItem('pon-sidebar-width', String(currentWidth.current))
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
```

**Thay `<aside>` className**:

```tsx
<aside
  className={cn(
    'w-full border-r flex-col shrink-0 relative overflow-hidden',
    '@container',    // ← THÊM: enable CSS container queries cho compact mode
    isConversationOpen ? 'hidden md:flex' : 'flex',
    'md:w-[var(--sidebar-w)]',
  )}
  style={{ '--sidebar-w': `${sidebarWidth}px` } as CSSProperties}
>
  {/* ... nội dung sidebar ... */}

  {/* Drag handle — thanh kéo bên phải sidebar */}
  <div
    onMouseDown={handleDragStart}
    className="hidden md:block absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-20 hover:bg-primary/20 active:bg-primary/40 transition-colors"
  />
</aside>
```

**Giữ lại toggle button** trong `ConversationHeader.tsx` — đây là tính năng BONUS hữu ích, chỉ cần đổi behavior: thay vì ẩn hoàn toàn sidebar, toggle button collapse về `68px`:

```tsx
// Trong ConversationHeader, onClick của toggle button:
onClick={() => {
  const current = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w') || '288'
  )
  // Toggle: nếu đang > 68px → collapse về 68px; nếu đang 68px → mở ra 288px
  // Đọc từ localStorage thay vì store
  const stored = localStorage.getItem('pon-sidebar-width')
  const expanded = stored ? parseInt(stored, 10) : 288
  // Không thể trực tiếp set sidebarWidth từ Header — cần expose setter qua store
  // Hoặc đơn giản hơn: xóa toggle button, user dùng drag thay thế
}
```

**Đơn giản nhất**: Xóa toggle button khỏi `ConversationHeader.tsx` — user dùng drag-resize là đủ. Nếu muốn giữ toggle, cần refactor để expose `setSidebarWidth` qua `useUiStore`.

### Fix 2b — Thêm CSS Container Queries cho compact mode

**Yêu cầu Tailwind config**: Kiểm tra `tailwind.config.ts` có `@tailwindcss/container-queries` plugin chưa:

```bash
grep -r "container-queries" apps/web/tailwind.config.ts
```

Nếu chưa có:
```bash
pnpm add @tailwindcss/container-queries --filter @platform/web
```

Trong `tailwind.config.ts`:
```ts
plugins: [
  require('@tailwindcss/container-queries'),
  // ... other plugins
]
```

**Hoặc nếu dùng Tailwind v4**: container queries đã built-in, không cần plugin.

### Fix 2c — Sidebar components: compact mode với container queries

Dưới đây là pattern áp dụng cho từng component. Ngưỡng compact: `200px` (`@[200px]:`).

**Sidebar header** (component render logo + "PON" + icons — tìm trong layout.tsx hoặc component riêng):
```tsx
{/* Logo area */}
<div className="flex items-center gap-2 px-3 py-3 shrink-0">
  <PonLogo className="size-7 shrink-0" />
  <span className="font-bold text-sm truncate @[200px]:block hidden">PON</span>
</div>

{/* Icon buttons */}
<div className="flex items-center @[200px]:gap-1 justify-center @[200px]:justify-start @[200px]:px-2">
  {/* Mỗi button giữ nguyên icon, chỉ spacing thay đổi */}
</div>
```

**`ConversationList.tsx`** — tabs:
```tsx
<TabsTrigger value="messages" className="flex-1 gap-1 min-w-0">
  <MessageSquare className="size-4 shrink-0" />
  <span className="@[200px]:inline hidden truncate text-xs">{t('tabChats')}</span>
</TabsTrigger>
```

Tương tự cho tabs Archive và Requests.

**Conversation item** trong list (`ConversationItem.tsx`):
```tsx
<div className="flex items-center @[200px]:px-3 px-2 py-2.5 gap-3 @[200px]:gap-3 gap-0 @[200px]:justify-start justify-center">
  <Avatar className="size-9 shrink-0" />
  {/* Text block — ẩn khi compact */}
  <div className="flex-1 min-w-0 @[200px]:block hidden">
    <div className="flex items-center gap-1">
      <span className="text-sm font-medium truncate">{displayName}</span>
      {isAI && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">AI</span>}
    </div>
    <p className="text-xs text-muted-foreground truncate">{previewText}</p>
  </div>
  {/* Unread badge — vẫn hiện khi compact */}
  {unreadCount > 0 && (
    <span className="ml-auto shrink-0 text-[10px] bg-primary text-primary-foreground rounded-full min-w-[18px] text-center px-1">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )}
</div>
```

**`AssistantEntry.tsx`** và **`ActiveFriendsRow.tsx`**: ẩn hoàn toàn khi compact (không có icon-only variant hữu ích):
```tsx
// Wrap component trong div cha ở layout:
<div className="@[200px]:block hidden">
  <ActiveFriendsRow />
</div>
<div className="@[200px]:block hidden">
  <AssistantEntry />
</div>
```

**`SidebarAiHubButton.tsx`**:
```tsx
<div className="@[200px]:px-3 px-2 py-2">
  <Button ...>
    <SomeIcon className="size-4 shrink-0" />
    <span className="@[200px]:inline hidden truncate">{label}</span>
  </Button>
</div>
```

**`SidebarProfileBar.tsx`**:
```tsx
<div className="flex items-center @[200px]:px-3 px-2 py-3 border-t @[200px]:justify-start justify-center gap-2">
  <Avatar className="size-8 shrink-0 cursor-pointer" />
  <div className="flex-1 min-w-0 @[200px]:block hidden">
    <p className="text-sm font-medium truncate">{displayName}</p>
  </div>
  <Button variant="ghost" size="icon" className="h-7 w-7 @[200px]:flex hidden shrink-0">
    <Settings className="size-3.5" />
  </Button>
</div>
```

**`NotificationBell.tsx`** (icon trong header) — không ảnh hưởng vì ở bên ngoài sidebar `<aside>`.

---

## Verification

1. **Loading**: Click vào conversation chưa có cache → thấy skeleton header + skeleton messages ngay lập tức (không blank screen). Navigator bar (cyan 3px) hiện khi click Link giữa các route.
2. **Sidebar drag**: Drag handle (dải 4px bên phải sidebar) cho phép kéo tự do. Kéo đến ~150px → text ẩn, chỉ còn avatar/icon. Kéo về 288px → full layout. Reload trang → sidebar nhớ width cũ.
3. **Build**: `pnpm build` không lỗi TypeScript.

---

## Lưu ý cho Claude Code

- Khi restore drag-resize code: dùng `git show 1a25b217:apps/web/app/(main)/layout.tsx` để xem code gốc chính xác và tránh thiếu sót.
- `@container` class cần Tailwind container-queries plugin **hoặc** Tailwind v4. Kiểm tra version trước khi apply.
- Nếu `useUiStore` vẫn có `sidebarCollapsed` từ lần trước: giữ nguyên store (có thể dùng cho feature khác sau này), chỉ thay đổi logic trong layout.tsx.
- Toggle button trong ConversationHeader: **đơn giản nhất là xóa nó** và để user dùng drag. Nếu muốn giữ, cần thêm `setSidebarWidth` vào `useUiStore`.
