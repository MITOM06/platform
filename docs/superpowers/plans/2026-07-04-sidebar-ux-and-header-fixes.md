# Plan: Sidebar UX Fixes + Header Button Order + Wallpaper CSP

> **Ngày:** 2026-07-04  
> **Scope:** Web only (`apps/web/`)  
> **4 issues.**

---

## Issue 1 — Sidebar: threshold sai, conversation mất text quá sớm, tab chồng lên nhau

### Vấn đề

Tất cả đang dùng cùng threshold `@[200px]`:
- Conversation item text ẩn khi width < 200px → quá sớm, avatar trơ trọi giữa
- Tab labels ("Chats", "Archived", "Requests") ẩn khi width < 200px → quá muộn, text còn đang chồng nhau ở ~250-300px

### Fix 1a — `apps/web/app/(main)/layout.tsx`: Tăng min drag lên 240px

```tsx
// handleDragStart — thay 200 → 240:
const next = Math.min(
  Math.max(dragStartWidth.current + delta, 240),
  window.innerWidth * 0.8,
)

// localStorage validation — thay 200 → 240:
if (!isNaN(w) && w >= 240 && w <= window.innerWidth * 0.8) {
```

Đồng thời update `SIDEBAR_MIN_WIDTH` trong **`apps/web/lib/store/ui.store.ts`** nếu có:
```tsx
export const SIDEBAR_MIN_WIDTH = 240   // trước là 68 hoặc 200
```

### Fix 1b — `apps/web/components/chat/ConversationList.tsx`: Tab threshold lên `@[300px]`

Tab labels ("Chats", "Archived", "Requests") bắt đầu chồng nhau khi sidebar ~280-300px. Ẩn sớm hơn:

```tsx
// Thay toàn bộ @[200px]:inline → @[300px]:inline trong TabsTrigger spans:
<span className="hidden @[300px]:inline">{t('tabChats')}</span>
<span className="hidden @[300px]:inline">{t('tabArchived')}</span>
<span className="hidden @[300px]:inline">{t('tabRequests')}</span>
```

Search bar (ẩn khi compact) — cũng đổi threshold:
```tsx
<div className="hidden @[300px]:block px-3 py-2 shrink-0">
  {/* Search input */}
</div>
```

### Fix 1c — `apps/web/components/chat/ConversationItem.tsx`: Conversation threshold xuống `@[120px]`

Conversation items giữ text lâu hơn — chỉ ẩn khi sidebar CỰC hẹp (<120px), nhưng min=240px nên text luôn hiện ở trạng thái thu nhỏ nhất:

```tsx
// Row container — thay @[200px]: → @[120px]:
className={cn(
  'flex items-center gap-0 @[120px]:gap-3 justify-center @[120px]:justify-start px-3 py-3 ...',
)}

// Unread dot (chỉ hiện khi compact) — thay @[200px]: → @[120px]:
<span className="@[120px]:hidden absolute -top-0.5 -right-0.5 ..." />

// Text block — thay @[200px]: → @[120px]:
<div className="hidden @[120px]:block flex-1 min-w-0">
```

### Fix 1d — Layout: AssistantEntry và ActiveFriendsRow — đổi threshold

Trong `apps/web/app/(main)/layout.tsx`, các wrapper ẩn khi compact:

```tsx
// AssistantEntry wrapper — thay @[200px]: → @[300px]:
<div className="hidden @[300px]:block">
  <ActiveFriendsRow />
</div>

// AssistantEntry — thay threshold tương tự nếu có
```

### Kết quả sau fix

| Width | Tabs | Conversation items | Search bar |
|-------|------|--------------------|------------|
| ≥ 300px | Icon + text | Avatar + name + preview | Hiện |
| 240–299px (gồm min) | **Icon only** | Avatar + name + preview ✓ | Ẩn |
| < 240px | *(drag blocked)* | — | — |

---

## Issue 2 — ConversationHeader: thứ tự nút sai

### Vấn đề hiện tại (trái → phải)

`Phone` → `Settings` → `Video` → `MoreVertical` (mobile)

### Đúng phải là

`Phone` → `Video` → `Settings`

### Fix — `apps/web/components/chat/ConversationHeader.tsx`

Di chuyển block `Settings` button xuống SAU block `Video` button. Thứ tự JSX sau khi fix:

```tsx
{/* 1. Phone call — DM only */}
{otherUserId && (
  <Button ... onClick={() => startCall(..., false)}>
    <Phone className="size-4" />
  </Button>
)}

{/* 2. Video call — Desktop inline, DM only */}
{otherUserId && (
  <div className="hidden md:flex items-center gap-0.5">
    <Button ... onClick={() => startCall(..., true)}>
      <Video className="size-4" />
    </Button>
  </div>
)}

{/* 3. Settings — always visible */}
<Button ... onClick={() => isGroup ? setGroupSettingsOpen(true) : setSettingsOpen(true)}>
  <Settings className="size-4" />
</Button>

{/* 4. Mobile overflow menu — video call */}
{otherUserId && (
  <DropdownMenu>
    ...
  </DropdownMenu>
)}
```

---

## Issue 3 — Wallpaper Themes: ảnh không hiển thị do CSP block Unsplash

### Root cause

Plan `2026-07-03-security-hardening.md` thêm CSP vào `next.config.ts` với:
```
img-src 'self' data: blob: ${NEXT_PUBLIC_CHAT_URL} https://lh3.googleusercontent.com
```

`images.unsplash.com` bị thiếu → browser block tất cả thumb và wallpaper từ Unsplash.

### Fix — `apps/web/next.config.ts`: Thêm Unsplash vào `img-src`

```tsx
`img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_CHAT_URL ?? ''} https://lh3.googleusercontent.com https://images.unsplash.com`,
```

---

## Verification

1. **Sidebar**: Kéo hết sang trái → dừng ở ~240px. Ở 240px: tabs chỉ còn icon, conversation items vẫn có avatar + tên + preview text. Không có trạng thái avatar-only.
2. **Tab overlap**: Kéo sidebar từ full → hẹp dần. Khi đạt ~300px, tab text biến mất (icon only) — không có giai đoạn text chồng nhau.
3. **Header**: Thứ tự từ trái sang phải là Phone → Video → Settings. Trên mobile: Phone → Settings → (More menu có Video).
4. **Wallpaper**: Mở conversation settings → Wallpaper → Themes → thumbnails Unsplash hiển thị bình thường.

---

## Lưu ý cho Claude Code

- `SIDEBAR_MIN_WIDTH` trong `ui.store.ts` (nếu tồn tại) phải sync với giá trị 240 trong `layout.tsx`.
- Dùng `replace_all: true` khi đổi `@[200px]:inline` → `@[300px]:inline` trong ConversationList để không sót.
- Dùng `replace_all: true` khi đổi `@[200px]:` → `@[120px]:` trong ConversationItem để không sót.
- **Không đụng** đến `resolveWallpaper()`, `splitWallpaperFit()`, `splitWallpaperLayout()`.
