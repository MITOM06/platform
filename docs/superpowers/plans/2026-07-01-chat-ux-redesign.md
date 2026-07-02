# Plan: Chat UX Redesign — 3 Issues

> **Ngày:** 2026-07-01  
> **Scope:** Web only (Next.js) — `apps/web/`  
> **Files chính:** `layout.tsx`, `MessageList.tsx`, `MessageBubble.tsx`, `MessageActions.tsx`, `message-bubble-helpers.tsx`

---

## Issue 1 — Sidebar bị vỡ layout khi kéo quá hẹp

### Root cause

`layout.tsx` cho phép kéo sidebar nhỏ đến `min: 68px`. Ở mức đó:
- Header không đủ chỗ cho logo + "PON" text + 4 icon → overflow hoặc wrap.
- `ConversationList` (tabs Archive/Pending/Messages) render theo width container → label bị cắt.
- `ActiveFriendsRow`, `AssistantEntry`, `SidebarAiHubButton`, `SidebarProfileBar` tương tự.

### Giải pháp: 2-state sidebar (expanded / hidden)

Bỏ continuous-resize. Thay bằng:
- **Expanded** (default, `288px`): layout hiện tại.
- **Collapsed/hidden** (`0px`, hidden hẳn): sidebar ẩn đi, main area mở rộng full width.
- Toggle bằng 1 button nhỏ ở góc trên header của conversation page (khi conversation mở).

Lý do không dùng icon-rail (68px):
- Phải refactor tất cả child components để accept `compact` prop = nhiều file thay đổi.
- 2-state (show/hide) là pattern phổ biến hơn và ít bug hơn (Discord, Slack mobile).

---

### Task 1a — `layout.tsx`: Thay drag-resize bằng 2-state toggle

**Xóa bỏ:**
- `sidebarWidth` state và `setSidebarWidth`
- `isDragging`, `dragStartX`, `dragStartWidth`, `currentWidth` refs
- `handleDragStart` function
- `useEffect` restore từ localStorage
- `style={{ '--sidebar-w': ... }}` và `md:w-[var(--sidebar-w)]`
- `<div onMouseDown={handleDragStart} ... />` drag handle

**Thêm:**
```tsx
// Sidebar collapsed state — persisted to localStorage
const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('pon-sidebar-collapsed') === 'true'
})

const toggleSidebar = () => {
  setSidebarCollapsed((v) => {
    localStorage.setItem('pon-sidebar-collapsed', String(!v))
    return !v
  })
}
```

**Thay `<aside>` width:**
```tsx
<aside
  className={cn(
    // transition để animation mượt
    'flex-col shrink-0 relative overflow-hidden transition-all duration-200',
    // Mobile: full width khi list, hidden khi conversation open
    isConversationOpen ? 'hidden md:flex' : 'flex',
    // Desktop: 288px khi expanded, 0/hidden khi collapsed
    sidebarCollapsed ? 'md:hidden' : 'md:w-72',
    'w-full border-r',
  )}
>
```

**Expose `toggleSidebar` và `sidebarCollapsed`** qua Context hoặc Zustand `useUiStore` (đã có), để `ConversationHeader` có thể trigger toggle.

Tốt nhất: thêm vào `useUiStore`:
```ts
// ui.store.ts
sidebarCollapsed: boolean
toggleSidebar: () => void
```

Trong `layout.tsx`: đọc từ store và khởi tạo từ localStorage một lần.

---

### Task 1b — `ConversationHeader.tsx`: Thêm toggle button

Trong header của conversation page, thêm button toggle sidebar (desktop only):

```tsx
import { PanelLeftOpen, PanelLeftClose } from 'lucide-react'
import { useUiStore } from '@/lib/store/ui.store'

// Trong ConversationHeader:
const { sidebarCollapsed, toggleSidebar } = useUiStore()

// Trong JSX, bên trái header (trước avatar/tên):
<Button
  variant="ghost"
  size="icon"
  className="hidden md:flex h-8 w-8 shrink-0"
  onClick={toggleSidebar}
  title={sidebarCollapsed ? 'Mở sidebar' : 'Đóng sidebar'}
>
  {sidebarCollapsed
    ? <PanelLeftOpen className="size-4" />
    : <PanelLeftClose className="size-4" />
  }
</Button>
```

---

## Issue 2 — Timestamp: chỉ hiện mốc thời gian nhóm, không hiện trong từng bubble

### Thiết kế mới (giống Messenger)

- **Timestamp separator**: xuất hiện giữa các nhóm tin nhắn. Trigger khi khoảng cách thời gian > 15 phút. Label: `"18:57"` (giờ:phút) thay vì chỉ ngày.
- **Trong bubble**: xóa `timeLabel` khỏi bubble content.
- **Khi hover message**: hiện exact time là tooltip nhỏ bên cạnh bubble (thay thế việc show ở trong bubble).
- **Khi mở 3-dots menu**: hiện exact time dưới dạng sticky chip ở **đầu viewport chat** (phía trên message list).

---

### Task 2a — `MessageList.tsx`: Thêm time-group separator

Sửa logic tạo `rows`:

```tsx
// Thay vì chỉ group by date, group by TIME (khoảng cách > 15 phút)
const TIME_GAP_MS = 15 * 60 * 1000 // 15 phút

const rows = useMemo<VirtualRow[]>(() => {
  const result: VirtualRow[] = []
  let lastDate = ''
  let lastTimestamp = 0

  for (const msg of messages) {
    const msgDate = new Date(msg.createdAt)
    const dateStr = msgDate.toDateString()
    const msgTs = msgDate.getTime()

    // Date separator (giống hiện tại)
    if (dateStr !== lastDate) {
      result.push({ kind: 'date-separator', isoDate: msg.createdAt })
      lastDate = dateStr
      lastTimestamp = msgTs
    } else if (msgTs - lastTimestamp > TIME_GAP_MS) {
      // Time group separator (mới)
      result.push({ kind: 'time-separator', isoDate: msg.createdAt })
      lastTimestamp = msgTs
    } else {
      // Update last timestamp mỗi message (track tail of group)
      lastTimestamp = msgTs
    }

    result.push({ kind: 'message', msg })
  }
  return result
}, [messages])
```

Cập nhật `VirtualRow` type:
```tsx
type VirtualRow =
  | { kind: 'date-separator'; isoDate: string }
  | { kind: 'time-separator'; isoDate: string }
  | { kind: 'message'; msg: Message }
```

Render `time-separator`:
```tsx
row.kind === 'time-separator' && (
  <div key={`tsep-${row.isoDate}`} className="flex justify-center my-2 select-none">
    <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">
      {new Date(row.isoDate).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
    </span>
  </div>
)
```

---

### Task 2b — `MessageBubble.tsx`: Xóa timestamp trong bubble, thêm hover tooltip

**Xóa `timeLabel`** khỏi render (không còn show giờ bên trong bubble).

**Giữ lại `readTick`** (checkmark seen/sent) nhưng đặt ở ngoài bubble, ngay dưới:
```tsx
// Sau khối bubble, thêm read receipt + time tooltip
<div className={cn('flex items-center gap-1 mt-0.5', isOwn ? 'justify-end' : 'justify-start')}>
  {readTick}
</div>
```

**Thêm time tooltip khi hover** — dùng Tailwind group + tooltip nhỏ:

Wrap message row bên ngoài bằng `<div className="group relative">`.

Trong bubble (hoặc bên cạnh bubble), thêm:
```tsx
<span
  className={cn(
    'absolute top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap',
    isOwn ? 'right-full mr-2' : 'left-full ml-2',
  )}
>
  {formatTime(message.createdAt, locale)}
</span>
```

**Không cần i18n mới** cho phần này.

---

### Task 2c — Hiện exact time khi mở 3-dots

Add state `activeMessageTime` vào `MessageViewport` hoặc `MessageList`:
```tsx
const [activeMessageTime, setActiveMessageTime] = useState<string | null>(null)
```

Truyền callback vào `MessageActions`:
```tsx
onMenuOpen?: (createdAt: string) => void
onMenuClose?: () => void
```

Trong `MessageActions`, khi `DropdownMenu` open:
```tsx
<DropdownMenu
  onOpenChange={(open) => {
    if (open) onMenuOpen?.(message.createdAt)
    else onMenuClose?.()
  }}
>
```

Hiện sticky time chip **ở đầu MessageViewport** (không phải top of page):
```tsx
{activeMessageTime && (
  <div className="absolute top-2 left-0 right-0 flex justify-center z-30 pointer-events-none">
    <span className="text-[11px] bg-background/90 backdrop-blur-sm border px-3 py-1 rounded-full shadow-sm text-muted-foreground font-medium">
      {new Date(activeMessageTime).toLocaleString(locale, {
        hour: '2-digit', minute: '2-digit',
        day: '2-digit', month: '2-digit', year: 'numeric',
      })}
    </span>
  </div>
)}
```

`MessageViewport.tsx` cần `relative` positioning (kiểm tra xem đã có chưa).

---

## Issue 3 — Emoji đơn lẻ không bọc trong bubble frame

### Thiết kế

Khi tin nhắn là **emoji thuần** (chỉ chứa 1–3 emoji, không có text khác), render bare — không có bubble background/border.
- Font size lớn hơn (2xl/3xl thay vì sm)
- Không shadow, không border
- Vẫn có timestamp tooltip khi hover

### Task 3a — `message-bubble-helpers.tsx`: Thêm emoji detector

```tsx
// Regex detect tin nhắn chỉ gồm emoji (không có text ASCII khác)
const EMOJI_ONLY_RE = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}){1,3}$/u

export function isEmojiOnly(content: string): boolean {
  return EMOJI_ONLY_RE.test(content.trim())
}
```

Lưu ý: `\p{Extended_Pictographic}` cần flag `u` và được support trên modern browsers/Node 18+.

---

### Task 3b — `MessageBubble.tsx`: Render bare cho emoji-only message

Import `isEmojiOnly` từ helpers.

Trong render logic (phần `!isBare`):
```tsx
const isEmojiMsg = message.type === 'text' && isEmojiOnly(message.content)

// Nếu isEmojiMsg → dùng bare render thay vì bubble
if (isEmojiMsg) {
  return (
    <div className={cn('flex group relative', isOwn ? 'flex-row-reverse' : 'flex-row', 'items-end gap-1')}>
      <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {senderLabel}
        {replyPreview}
        {/* Emoji bare — to, không có frame */}
        <span className="text-4xl leading-none select-none">{message.content}</span>
        <div className={cn('flex items-center gap-1 mt-0.5', isOwn ? 'justify-end' : 'justify-start')}>
          {readTick}
        </div>
      </div>
      {/* Actions menu hiện khi hover */}
      <div className={cn('flex items-center mb-1', !hovered && !longPressActive && 'invisible')}>
        <MessageActions ... />
      </div>
    </div>
  )
}
```

---

## Verification

1. **Sidebar**: kéo sidebar → giờ không có drag-resize nữa, chỉ toggle button. Click toggle → sidebar ẩn/hiện mượt. State persists sau refresh.
2. **Timestamps**: nhắn 5 tin nhắn liên tiếp → chỉ có 1 time separator ở đầu nhóm, không có time trong bubble. Nhắn 1 tin → chờ 15 phút → nhắn tiếp → xuất hiện time separator mới. Hover bubble → tooltip giờ hiện bên cạnh. Mở 3-dots → sticky chip thời gian xuất hiện ở top viewport.
3. **Emoji bare**: nhắn "❤️" → render to không có bubble. Nhắn "hello ❤️" (có text kèm) → render bình thường trong bubble.
4. `pnpm build` pass, không lỗi TypeScript.

---

## Lưu ý

- Việc bỏ `sidebarWidth` localStorage key (thay bằng `pon-sidebar-collapsed`) không breaking — key cũ tự expire khi không còn đọc.
- `isEmojiOnly` cần unit test nhanh cho các edge case: text kèm emoji, emoji sequence (👨‍👩‍👧), nhiều hơn 3 emoji.
- Time group threshold `15 phút` là hardcode — có thể extract thành constant `TIME_GROUP_GAP_MS` ở top file nếu muốn tune sau.
- Hover tooltip cho timestamp sẽ không hoạt động tốt trên mobile (không có hover). Mobile thì vẫn ok vì đã có time separator ở group. Nếu muốn mobile tap-to-reveal time, có thể làm phase sau.
