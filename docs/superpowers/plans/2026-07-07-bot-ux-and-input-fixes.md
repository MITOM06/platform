# Plan: Input Box Size Fix + Bot Read/Unread + AI Bot RBAC

> **Ngày:** 2026-07-07
> **Scope:** Web only (`apps/web/`)
> **3 issues.**

---

## Issue 1 — Textarea quá to trên mobile (root cause: field-sizing-content + placeholder dài)

### Root cause

`components/ui/textarea.tsx` base class có `field-sizing-content` — CSS property khiến textarea tự
size theo nội dung **bao gồm cả placeholder text**. Trên mobile ~390px, placeholder:
- EN: "Type a message... (Enter to send, Shift+Enter for new line)"
- VI: "Nhập tin nhắn... (Enter để gửi, Shift+Enter xuống dòng)"

Wrap thành 3 dòng → textarea cao ~60-70px dù chưa nhập gì. `min-h-10` override không hiệu quả vì
`field-sizing-content` ignore min-height khi content (placeholder) taller.

Fix plan trước (`p-2 md:p-3`) không đủ vì không đụng root cause.

### Fix 1a — `apps/web/components/chat/MessageInput.tsx`: Override field-sizing + JS auto-resize

Thêm `[field-sizing:fixed]` vào Textarea className để disable `field-sizing-content`. Kết hợp với
JS auto-resize để textarea vẫn grow khi user gõ nhiều dòng:

```tsx
// Tìm Textarea component trong MessageInput:
<Textarea
  ref={textareaRef}
  value={value}
  onChange={handleChange}
  onKeyDown={handleKeyDown}
  placeholder={...}
  className="min-h-10 max-h-32 resize-none w-full [field-sizing:fixed]"
  rows={1}
  disabled={disabled || sending}
/>
```

Thêm JS auto-resize vào `handleChange` — textarea grow theo content khi user gõ, nhưng KHÔNG grow
theo placeholder:

```tsx
// Tìm handleChange function, thêm auto-resize logic:
const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const text = e.target.value
  setValue(text)

  // Auto-resize height: reset → let scrollHeight determine actual size → cap at max-h-32 (128px)
  const el = textareaRef.current
  if (el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

  // ... rest of existing handleChange logic (typing notification, mention detection, slash command)
}
```

Thêm reset height trong `handleSend` (sau khi clear value):

```tsx
// Tìm handleSend function, sau khi setValue(''):
setValue('')
// Reset textarea height sau khi clear
if (textareaRef.current) {
  textareaRef.current.style.height = 'auto'
}
```

Tương tự cho `handleEditSend` nếu có.

### Fix 1b — Rút ngắn `inputPlaceholder` trong tất cả 7 message files

Placeholder hint keyboard shortcut vô nghĩa trên mobile (không có keyboard shortcut trên phone).
Rút ngắn thành text đơn giản trong **tất cả** `messages/*.json`:

```json
// messages/en.json
"inputPlaceholder": "Message..."

// messages/vi.json
"inputPlaceholder": "Nhập tin nhắn..."

// messages/zh.json
"inputPlaceholder": "发消息..."

// messages/ja.json
"inputPlaceholder": "メッセージを入力..."

// messages/ko.json
"inputPlaceholder": "메시지 입력..."

// messages/fr.json
"inputPlaceholder": "Message..."

// messages/es.json
"inputPlaceholder": "Mensaje..."
```

`editPlaceholder` giữ nguyên (desktop-only, user biết Enter = save).

### Kết quả sau fix

| Trạng thái | Chiều cao textarea |
|---|---|
| Empty (mobile) | ~40px (min-h-10, 1 dòng) |
| 1 dòng text | ~40px |
| 3 dòng text | ~80px |
| Nhiều dòng | max 128px (max-h-32) + scroll |

---

## Issue 2 — Unread badge + mark read/unread không có nghĩa trên bot conversation

### Vấn đề

AI bot và extbot (personal assistant) không cần:
- Unread count badge (chấm + số) trong conversation list
- "Mark as read / Mark as unread" trong context menu
- "Mark as read / Mark as unread" trong ConversationSettingsDrawer
- Auto-delete timer (không có nghĩa với AI)

### Fix 2a — `apps/web/components/chat/ConversationItem.tsx`: Ẩn badge khi isAnyBot

Tìm 2 chỗ hiển thị unread, wrap với `{!isAnyBot && ...}`:

```tsx
{/* Compact dot — chỉ hiện khi KHÔNG phải bot */}
{conv.unreadCount > 0 && !isAnyBot && (
  <span className="@[120px]:hidden absolute -top-0.5 -right-0.5 size-3 rounded-full bg-primary border-2 border-background" />
)}
```

```tsx
{/* Full badge — chỉ hiện khi KHÔNG phải bot */}
{conv.unreadCount > 0 && !isAnyBot && (
  <Badge variant="default" className="text-xs h-4 min-w-4 px-1 shrink-0 rounded-full">
    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
  </Badge>
)}
```

**Context menu** (cuối ConversationItem) — ẩn "Mark as read/unread" khi isAnyBot:

```tsx
{/* Context menu mark read/unread — không hiện với bot */}
{!isAnyBot && (
  <>
    {conv.unreadCount > 0 ? (
      <ContextMenuItem onClick={handleMarkRead}>
        <MailOpen className="size-4" />
        {t('markAsRead')}
      </ContextMenuItem>
    ) : (
      <ContextMenuItem onClick={handleMarkUnread}>
        <Mail className="size-4" />
        {t('markAsUnread')}
      </ContextMenuItem>
    )}
  </>
)}
```

### Fix 2b — `apps/web/components/chat/ConversationSettingsDrawer.tsx`: Ẩn ActionOptionsSection cho AI

```tsx
{/* Action Options — ẩn hoàn toàn với AI bot (mark read/unread và auto-delete không apply) */}
{!s.isAI && (
  <ActionOptionsSection
    saving={s.saving}
    isArchived={s.isArchived}
    autoDeleteOptions={s.autoDeleteOptions}
    sliderValue={s.sliderValue}
    onMarkRead={s.handleMarkRead}
    onMarkUnread={s.handleMarkUnread}
    onArchiveToggle={s.handleArchiveToggle}
    onAutoDelete={s.handleAutoDelete}
  />
)}
```

**Lưu ý:** Archive vẫn có thể giữ trong drawer nếu muốn (AI conversation cũng có thể lưu trữ).
Nhưng user yêu cầu bỏ hết → ẩn cả section. Nếu cần archive riêng cho AI, tách thành component nhỏ sau.

---

## Issue 3 — AI bot settings: chỉ Admin/Owner được customize

### Vấn đề

`AiAssistantSection.tsx` hiện show tất cả options với mọi user:
- AI Personality (`/ai-persona`) — nên admin/owner only
- AI Memory (`/ai-memory`) — nên admin/owner only
- AI Skills (`/skills`) — nên admin/owner only
- Connected Apps / Integrations (`/integrations`) — MỌI user (kết nối tool của mình)
- Token Usage (`/token-usage`) — MỌI user (xem usage của mình)

### Fix — `apps/web/components/chat/group/AiAssistantSection.tsx`

Dùng `useHasCapability('MANAGE_WORKSPACE')` để check quyền admin/owner:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Bot, BrainCircuit, Sparkles, Plug, Coins, Lock } from 'lucide-react'
import {
  AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { useHasCapability } from '@/lib/hooks/use-capabilities'

const ROW_CLS = 'flex items-center gap-3 w-full text-left px-2 py-2.5 hover:bg-muted/50 rounded-lg text-sm transition-colors'
const ROW_DISABLED_CLS = 'flex items-center gap-3 w-full text-left px-2 py-2.5 rounded-lg text-sm opacity-40 cursor-not-allowed select-none'

interface Props {
  conversationId: string
  onClose: () => void
}

export function AiAssistantSection({ conversationId, onClose }: Props) {
  const t = useTranslations('chat')
  const router = useRouter()
  const canManage = useHasCapability('MANAGE_WORKSPACE')  // true = admin hoặc owner

  const go = (href: string) => {
    onClose()
    router.push(href)
  }

  return (
    <AccordionItem value="ai" className="border-none">
      <AccordionTrigger className="hover:no-underline py-2 data-[state=open]:text-pon-cyan">
        <span className="font-semibold text-sm flex items-center gap-2">
          <Bot className="size-4" /> {t('aiAssistant')}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pt-1 space-y-1">

        {/* Persona — Admin/Owner only */}
        {canManage ? (
          <button onClick={() => go(`/ai-persona?conversationId=${conversationId}`)} className={ROW_CLS}>
            <Sparkles className="size-4 text-muted-foreground" />
            <span>{t('aiPersonality')}</span>
          </button>
        ) : (
          <div className={ROW_DISABLED_CLS} title={t('adminOnly')}>
            <Lock className="size-4 text-muted-foreground" />
            <span>{t('aiPersonality')}</span>
          </div>
        )}

        {/* Memory — Admin/Owner only */}
        {canManage ? (
          <button onClick={() => go('/ai-memory')} className={ROW_CLS}>
            <BrainCircuit className="size-4 text-muted-foreground" />
            <span>{t('aiMemory')}</span>
          </button>
        ) : (
          <div className={ROW_DISABLED_CLS} title={t('adminOnly')}>
            <Lock className="size-4 text-muted-foreground" />
            <span>{t('aiMemory')}</span>
          </div>
        )}

        {/* Skills — Admin/Owner only */}
        {canManage ? (
          <button onClick={() => go('/skills')} className={ROW_CLS}>
            <Sparkles className="size-4 text-muted-foreground" />
            <span>{t('aiSkills')}</span>
          </button>
        ) : (
          <div className={ROW_DISABLED_CLS} title={t('adminOnly')}>
            <Lock className="size-4 text-muted-foreground" />
            <span>{t('aiSkills')}</span>
          </div>
        )}

        {/* Connected Apps / Integrations — MỌI user (kết nối tool cá nhân) */}
        <button onClick={() => go('/integrations')} className={ROW_CLS}>
          <Plug className="size-4 text-muted-foreground" />
          <span>{t('aiConnectedApps')}</span>
        </button>

        {/* Token Usage — MỌI user */}
        <button onClick={() => go('/token-usage')} className={ROW_CLS}>
          <Coins className="size-4 text-muted-foreground" />
          <span>{t('aiUsage')}</span>
        </button>

      </AccordionContent>
    </AccordionItem>
  )
}
```

Thêm i18n key `adminOnly` vào tất cả 7 `messages/*.json`:
```json
// messages/en.json (trong namespace "chat"):
"adminOnly": "Admin or Owner only"

// messages/vi.json:
"adminOnly": "Chỉ Admin hoặc Owner"

// messages/zh.json:
"adminOnly": "仅限管理员或所有者"

// messages/ja.json:
"adminOnly": "管理者またはオーナーのみ"

// messages/ko.json:
"adminOnly": "관리자 또는 소유자만 가능"

// messages/fr.json:
"adminOnly": "Admin ou propriétaire uniquement"

// messages/es.json:
"adminOnly": "Solo administrador o propietario"
```

### Behavior

| User role | Persona | Memory | Skills | Integrations | Usage |
|---|---|---|---|---|---|
| Admin / Owner | ✅ Click → edit | ✅ Click → edit | ✅ Click → edit | ✅ | ✅ |
| Member / khác | 🔒 Greyed out, no click | 🔒 | 🔒 | ✅ | ✅ |

---

## Verification

1. **Input box**: Mở conversation trên mobile. Textarea chiều cao ~40px khi empty. Gõ 5 dòng → textarea grow lên ~100px, không vượt quá ~128px. Placeholder là "Message..." (ngắn).
2. **Bot unread badge**: Xem conversation list → AI bot conversation không có chấm đỏ hay badge số kể cả khi có tin nhắn mới. Context menu chuột phải vào AI conversation → không có "Mark as read/unread".
3. **Bot settings drawer**: Mở AI conversation → cài đặt → không có section "Mark read/unread/Archive/Auto-delete".
4. **AI RBAC**: Đăng nhập bằng user thường → vào AI conversation → cài đặt → AI Assistant section → Persona/Memory/Skills bị greyed out, không click được. Integrations và Usage vẫn click được. Đăng nhập admin → cả 5 items đều active.

---

## Lưu ý cho Claude Code

- **Issue 1**: `handleChange` hiện có thể chứa typing notification, mention detection, slash detection — thêm auto-resize vào ĐẦU function trước các logic đó, hoặc sau khi setValue, nhưng không thay thế logic cũ.
- **Issue 1**: `[field-sizing:fixed]` là Tailwind arbitrary CSS value — nếu build lỗi CSS unknown property, thay bằng inline style `style={{ fieldSizing: 'fixed' } as React.CSSProperties}` trên Textarea.
- **Issue 2**: `isAnyBot` đã được compute ở đầu `ConversationItem` component — không cần thêm import. Chỉ cần wrap `{!isAnyBot && (...)}`.
- **Issue 3**: `useHasCapability` import từ `@/lib/hooks/use-capabilities`. `Capability` type cần check trong `admin-types.ts` — `MANAGE_WORKSPACE` phải có trong `Capability` union type. Nếu không có, thêm vào type definition.
- Chạy `pnpm build` trong `apps/web` để verify TypeScript clean.
