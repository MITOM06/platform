# Plan: Block UX — Call Guard + Block-Back Prevention + Online Status Hide

> **Ngày:** 2026-07-07
> **Scope:** Web only (`apps/web/`)
> **3 issues — tất cả liên quan đến block relationship (A blocks B).**

---

## Thuật ngữ

| Biến | Ý nghĩa từ góc nhìn của current user (B) |
|---|---|
| `iBlocked` | **B đã chặn A** — B chủ động chặn |
| `blockedMe` | **A đã chặn B** — B bị chặn |
| `isBlocked` (cũ, combined) | `iBlocked \|\| blockedMe` — không phân biệt ai chặn ai |

---

## Issue 1 — B vẫn gọi được A dù bị A chặn

### Root cause

`ConversationHeader.tsx` không dùng relationship data. Nút Phone/Video chỉ check `otherUserId`:
```tsx
{otherUserId && (
  <Button onClick={() => startCall(otherUserId, displayName, conversationId, false)}>
    <Phone />
  </Button>
)}
```
Không có guard nào khi `blockedMe === true`.

### Fix — `apps/web/components/chat/ConversationHeader.tsx`

**Thêm import:**
```tsx
import { useRelationship } from '@/lib/hooks/use-relationship'
import { toast } from 'sonner'
```

**Trong component body, sau khi có `otherUserId`:**
```tsx
const { relationship } = useRelationship(otherUserId)
const blockedMe = relationship?.blockedMe ?? false
```

**Wrap mỗi call button bằng guard function thay vì gọi `startCall` trực tiếp:**
```tsx
// Thêm helper:
const guardedCall = (video: boolean) => {
  if (blockedMe) {
    toast.error(t('callBlockedByUser'))
    return
  }
  startCall(otherUserId!, displayName, conversationId, video)
}
```

**Thay các onClick:**
```tsx
// Voice call:
onClick={() => guardedCall(false)}

// Video call (desktop inline):
onClick={() => guardedCall(true)}

// Mobile overflow DropdownMenuItem video:
onClick={() => guardedCall(true)}
```

**Thêm i18n key** vào tất cả 7 `messages/*.json`:
```json
// messages/en.json (namespace "chat"):
"callBlockedByUser": "This user is not accepting calls"

// messages/vi.json:
"callBlockedByUser": "Người này không muốn liên lạc với bạn"

// messages/zh.json:
"callBlockedByUser": "该用户不接受通话"

// messages/ja.json:
"callBlockedByUser": "このユーザーは通話を受け付けていません"

// messages/ko.json:
"callBlockedByUser": "이 사용자는 통화를 받지 않습니다"

// messages/fr.json:
"callBlockedByUser": "Cet utilisateur ne répond pas aux appels"

// messages/es.json:
"callBlockedByUser": "Este usuario no acepta llamadas"
```

**Lưu ý:** Nút vẫn hiện nhưng khi click chỉ hiện toast, không khởi tạo WebRTC. UX tốt hơn là ẩn nút (user sẽ nhầm rằng tính năng gọi bị hỏng).

---

## Issue 2 — B có thể chặn ngược A dù đã bị A chặn (+ unblock bug)

### Root cause

`use-conversation-settings.ts` dùng `conversation.isBlocked` — combined boolean không phân biệt
`iBlocked` và `blockedMe`. Kết quả:
- A chặn B → `conversation.isBlocked = true` → B thấy nút "Unblock A" dù B chưa từng chặn A
- Nếu B click "Unblock" → call `authService.unblockUser(A)` dù B chưa block A → API lỗi hoặc side-effect sai

`PrivacySupportSection.tsx` dùng `isBlocked: boolean` để toggle text "Block" / "Unblock" — không
biết `blockedMe` nên hiển thị sai.

### Fix 2a — `apps/web/components/chat/use-conversation-settings.ts`

**Thêm import:**
```typescript
import { useRelationship } from '@/lib/hooks/use-relationship'
```

**Trong hook body, sau khi có `otherUserId`:**
```typescript
// Relationship granular — phân biệt B chặn A vs A chặn B
const { relationship } = useRelationship(otherUserId ?? undefined)
const iBlocked = relationship?.iBlocked ?? (conversation.isBlocked ?? false)
const blockedMe = relationship?.blockedMe ?? false
```

**Sửa `handleBlockButtonClick` và `handleBlockToggle`** — dùng `iBlocked` thay vì `isBlocked`:
```typescript
const handleBlockButtonClick = () => {
  if (iBlocked) {           // ← B đã chặn A → unblock
    handleBlockToggle()
  } else if (!blockedMe) {  // ← B chưa bị chặn và chưa chặn → confirm block
    setBlockConfirmOpen(true)
  }
  // Nếu blockedMe === true → không làm gì cả (B bị chặn, không cho block ngược)
}

const handleBlockToggle = async () => {
  if (!otherUserId) return
  setSaving(true)
  try {
    if (iBlocked) {   // ← unblock (B từng chặn A)
      await authService.unblockUser(otherUserId)
      await chatService.blockRestoreConversation(conversation.id)
      setLocalBlockedConvId(conversation.id)
      setLocalBlockedValue(false)
      invalidateAll()
      toast.success(t('unblockSuccess'))
    } else if (!blockedMe) {  // ← block (B chặn A, chỉ khi chưa bị A chặn)
      await authService.blockUser(otherUserId)
      await chatService.blockArchiveConversation(conversation.id)
      setLocalBlockedConvId(conversation.id)
      setLocalBlockedValue(true)
      invalidateAll()
      toast.success(t('blockSuccess'))
    }
  } catch {
    toast.error(t('actionError'))
  } finally {
    setSaving(false)
  }
}
```

**Expose `iBlocked` và `blockedMe` trong return:**
```typescript
return {
  // ... existing fields
  iBlocked,
  blockedMe,
  isBlocked: iBlocked || blockedMe,  // backward compat cho các chỗ khác vẫn dùng
  // ...
}
```

### Fix 2b — `apps/web/components/chat/ConversationSettingsDrawer.tsx`

Truyền `iBlocked` và `blockedMe` xuống `PrivacySupportSection`:
```tsx
<PrivacySupportSection
  isDirect={s.isDirect}
  isGroup={s.isGroup}
  isAI={s.isAI}
  iBlocked={s.iBlocked}          // ← mới
  blockedMe={s.blockedMe}        // ← mới
  isBlocked={s.isBlocked}        // ← giữ để backward compat nếu cần
  saving={s.saving}
  onBlockToggle={s.handleBlockButtonClick}
  ...
/>
```

### Fix 2c — `apps/web/components/chat/group/PrivacySupportSection.tsx`

**Thay `isBlocked: boolean` bằng `iBlocked` và `blockedMe`:**
```tsx
interface Props {
  isDirect: boolean
  isGroup: boolean
  isAI: boolean
  iBlocked: boolean    // B chủ động chặn A
  blockedMe: boolean   // A chặn B
  saving: boolean
  onBlockToggle: () => void
  // ... rest unchanged
}
```

**Block button logic:**
```tsx
{isDirect && !isAI && (
  <>
    {/* Chỉ hiện Block/Unblock khi B chưa bị chặn bởi A */}
    {!blockedMe && (
      <button onClick={onBlockToggle} disabled={saving} className={ROW_CLS}>
        {iBlocked
          ? <Shield className="size-4" />
          : <ShieldOff className="size-4" />
        }
        <span>{iBlocked ? t('unblockUser') : t('blockUser')}</span>
      </button>
    )}
    {/* Khi bị chặn: không có nút block, chỉ có thể xóa/lưu trữ */}
  </>
)}
```

**Behavior:**

| Tình huống | Nút Block hiển thị | Text |
|---|---|---|
| Chưa ai chặn ai | ✅ | "Block User" |
| B đã chặn A (`iBlocked`) | ✅ | "Unblock User" |
| A chặn B (`blockedMe`) | ❌ ẩn hoàn toàn | - |
| Cả hai đều chặn | ✅ | "Unblock User" (B unblock A trước) |

---

## Issue 3 — B thấy trạng thái online của A dù A đã chặn B

### Root cause

`ConversationHeader.tsx` hiển thị online status từ `useUserStatus(otherUserId)` mà không check
relationship. Khi A chặn B, backend vẫn trả status (hoặc B vẫn có cache).

Green dot trên avatar (line ~152):
```tsx
{otherUserId && status?.online && (
  <span className="absolute ... bg-[#00E676] ..." />
)}
```

Status text dưới tên (line ~178):
```tsx
) : otherUserId && status ? (
  <p className="text-xs text-muted-foreground">
    {status.online ? t('online') : t('offline')}
  </p>
```

Cả hai đều cần ẩn khi `blockedMe === true`.

### Fix — `apps/web/components/chat/ConversationHeader.tsx`

Dùng `blockedMe` (đã lấy ở Issue 1 trên cùng file):

**Green dot:**
```tsx
{/* Ẩn online dot khi A đã chặn B */}
{otherUserId && status?.online && !blockedMe && (
  <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-[#00E676] border-2 border-background shadow-[0_0_6px_rgba(0,230,118,0.6)]" />
)}
```

**Status text:**
```tsx
{isTyping ? (
  <p className="text-xs text-pon-cyan font-medium animate-pulse">{t('typing')}</p>
) : otherUserId && status && !blockedMe ? (   // ← thêm && !blockedMe
  <p className="text-xs text-muted-foreground">
    {status.online ? t('online') : t('offline')}
  </p>
) : isGroup ? (
  <p className="text-xs text-muted-foreground">
    {t('membersCount', { count: conversation?.participants.length ?? 0 })}
  </p>
) : null}
```

**Kết quả:** Khi A chặn B, B thấy header của A không có green dot, không có text "Đang hoạt động"
hay "Offline" — chỉ thấy tên. Đây là behavior chuẩn (WhatsApp, Messenger đều làm vậy).

---

## Verification

1. **Call guard**: Đăng nhập user B (bị A chặn). Vào conversation với A. Click Phone → toast "Người này không muốn liên lạc với bạn". Click Video → cùng toast. Không có WebRTC call nào được tạo.

2. **Block-back prevention**: B vào settings drawer của conversation với A. Section "Privacy & Support" → **không có nút Block/Unblock**. B vẫn thấy: Clear History, Delete Conversation.

3. **Unblock only when iBlocked**: User C chặn D. C vào settings → thấy "Unblock User". Click → unblock thành công. Quay lại → thấy "Block User".

4. **Online status hidden**: B xem header conversation với A (A đã chặn B). Không có green dot trên avatar. Không có text "Đang hoạt động" hay "Offline". Chỉ thấy tên A.

5. **Regression**: User X chưa block user Y. X xem conversation header → vẫn thấy online status bình thường. X vào settings → thấy "Block User" bình thường.

---

## Lưu ý cho Claude Code

- **Issue 2**: `useRelationship` trong `use-conversation-settings.ts` cần `otherUserId` là `string | undefined`. Hiện `otherUserId` trong hook này có type `string | null` → dùng `otherUserId ?? undefined` khi truyền vào hook.
- **Issue 2**: `localBlockedValue` state hiện track combined `isBlocked`. Sau fix, nó track `iBlocked` (B's block state). Logic set/reset giữ nguyên.
- **Issue 2**: `blockConfirmOpen` state trong `use-conversation-settings.ts` vẫn dùng bình thường — dialog confirm chỉ xuất hiện khi B muốn chặn A (không phải unblock). Không thay đổi.
- **Issue 1 + 3 cùng file**: `useRelationship(otherUserId)` chỉ gọi 1 lần trong `ConversationHeader.tsx` — dùng `blockedMe` cho cả call guard lẫn online status hide.
- Chạy `pnpm build` trong `apps/web` để verify TypeScript.
