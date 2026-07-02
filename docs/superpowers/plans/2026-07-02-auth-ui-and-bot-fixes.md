# Plan: Auth UI Fixes + AI Bot Naming

> **Ngày:** 2026-07-02  
> **Scope:** Web (Next.js) — `apps/web/`  
> **3 issues độc lập.**

---

## Issue 1 — Auth form quá hẹp + Terms wrapping

### Root cause

`apps/web/app/(auth)/layout.tsx` set `max-w-sm` (384px) cho toàn bộ auth container:
```tsx
<div className="relative z-10 w-full max-w-sm motion-safe:pon-enter">{children}</div>
```

Ở 384px, checkbox label "I agree to the Privacy Policy and Terms of Service" bị wrap xuống 2 dòng vì `Privacy Policy` và `Terms of Service` là các link riêng, browser tính từng link là một unit → wrap sai chỗ.

### Fix 1a — `layout.tsx`: Tăng max-width

```tsx
{/* Trước: max-w-sm (384px) */}
<div className="relative z-10 w-full max-w-sm motion-safe:pon-enter">{children}</div>

{/* Sau: max-w-md (448px) — đủ rộng cho form register với Terms một dòng */}
<div className="relative z-10 w-full max-w-md motion-safe:pon-enter">{children}</div>
```

### Fix 1b — `register/page.tsx`: Fix Terms label không bị wrap

Thêm `flex-wrap items-center gap-1` vào label để các từ và links align trên cùng một dòng khi đủ chỗ, không bị wrap vụng về:

```tsx
{/* Tìm đoạn render Terms checkbox — hiện tại khoảng line 185-200 */}
<div className="flex flex-row items-start space-x-3 space-y-0 rounded-md py-2">
  <Checkbox
    id="agreeToTerms"
    checked={watch('agreeToTerms')}
    onCheckedChange={(checked) => setValue('agreeToTerms', checked as boolean)}
  />
  <div className="space-y-1 leading-none">
    {/* Thay Label render bằng inline-flex để tránh word-wrap vụng về */}
    <Label
      htmlFor="agreeToTerms"
      className="font-normal text-sm text-muted-foreground cursor-pointer flex flex-wrap items-center gap-x-1"
    >
      {t.rich('register.agreeToTerms', {
        privacy: (chunks) => (
          <Link href="/privacy" className="text-primary underline underline-offset-2 whitespace-nowrap">
            {chunks}
          </Link>
        ),
        terms: (chunks) => (
          <Link href="/terms" className="text-primary underline underline-offset-2 whitespace-nowrap">
            {chunks}
          </Link>
        ),
      })}
    </Label>
    {errors.agreeToTerms && (
      <p className="text-sm text-destructive">{errors.agreeToTerms.message}</p>
    )}
  </div>
</div>
```

Key thay đổi:
- Label dùng `flex flex-wrap items-center gap-x-1` → các từ và link flow tự nhiên trên cùng hàng
- Các link dùng `whitespace-nowrap` → "Privacy Policy" và "Terms of Service" không bị tách từ

---

## Issue 2 — Pre-fill credentials sau khi reset password thành công

### Flow hiện tại

```
/forgot-password → step: request (nhập email) → step: otp (verify) → step: reset (nhập password mới)
→ onResetSuccess: router.push('/login')  ← không mang thông tin gì theo
```

User phải tự nhập lại email + password mới → friction không cần thiết.

### Giải pháp: sessionStorage bridge

Dùng `sessionStorage` (không phải localStorage) — tự clear khi đóng tab, an toàn hơn URL params (không lưu vào history).

### Fix — `apps/web/app/(auth)/forgot-password/page.tsx`

Tìm đoạn `onResetPassword` handler (khoảng line 145-155):

```tsx
const onResetPassword = async ({ password }: { password: string }) => {
  try {
    await authService.resetPassword(email, collectedOtp, password)
    toast.success(t('resetSuccess'))

    // ← THÊM: Lưu tạm email + password vào sessionStorage để pre-fill login form
    // Dùng sessionStorage (clear khi đóng tab) — an toàn, không lưu vào URL history
    try {
      sessionStorage.setItem(
        'pon:auth:prefill',
        JSON.stringify({ email, password, _ts: Date.now() }),
      )
    } catch {
      // sessionStorage có thể bị blocked (incognito strict mode) — không phải lỗi nghiêm trọng
    }

    router.push('/login')
  } catch (err: unknown) {
    ...
  }
}
```

### Fix — `apps/web/app/(auth)/login/page.tsx`

Trong `LoginPage`, thêm `useEffect` đọc prefill data khi mount:

```tsx
import { useEffect } from 'react'

// Trong component, sau khi form được khởi tạo:
useEffect(() => {
  try {
    const raw = sessionStorage.getItem('pon:auth:prefill')
    if (!raw) return
    sessionStorage.removeItem('pon:auth:prefill')  // dùng 1 lần rồi xóa

    const { email, password, _ts } = JSON.parse(raw) as {
      email: string; password: string; _ts: number
    }

    // Chỉ dùng nếu mới reset < 5 phút (tránh stale data)
    if (Date.now() - _ts > 5 * 60 * 1000) return

    // Pre-fill form
    setValue('email', email, { shouldDirty: false })
    setValue('password', password, { shouldDirty: false })
  } catch {
    // Malformed JSON hoặc storage blocked — bỏ qua
  }
}, [setValue])  // setValue là stable ref từ react-hook-form
```

**Lưu ý UX**: password field vẫn là `type="password"` → user thấy dots, không thấy plain text. Đây là acceptable UX vì user vừa tự set password đó. Không cần thêm warning gì.

---

## Issue 3 — AI Bot: tên đúng + badge cho external bots

### Vấn đề hiện tại

**3a — Tên hardcoded "AI Assistant":**
- `ConversationItem.tsx` line 105: `isAI ? t('aiAssistant') : ...` → luôn hiện "AI Assistant"
- `ConversationHeader.tsx` line 87: tương tự
- Tên thật của bot (configured qua Admin → AI Settings → `personaName`) không được dùng

**3b — External bots (Bot Factory) không có "AI" badge:**
- `isAI` chỉ check `conv.participants.includes(AI_BOT_ID)` với ID cứng `ai-bot-000...`
- Các bot từ Bot Factory có participant ID dạng `extbot:xxx` — không được detect là AI
- → Không có "AI" badge trong conversation list và header

### Fix 3a — Expose assistant name từ workspace settings

Workspace AI settings đã có `personaName` ở ai-service. Cần fetch và sử dụng client-side.

**Option A (recommended — nếu đã có settings hook):**
Tìm hook hoặc store đang fetch workspace AI settings (grep `useAiSettings\|workspaceSettings\|ai.*settings` trong `apps/web/lib`). Nếu đã có, thêm `personaName` vào response type và dùng trong conversation components.

**Option B (nếu chưa có):**
Tạo hook `useAssistantName()` đơn giản:

```tsx
// apps/web/lib/hooks/use-assistant-name.ts
import { useQuery } from '@tanstack/react-query'
import { aiSettingsApi } from '@/lib/api/ai-settings'  // endpoint GET /api/settings trên ai-service

export function useAssistantName(): string {
  const { data } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: aiSettingsApi.getSettings,
    staleTime: 5 * 60 * 1000,  // cache 5 phút
    select: (d) => d.personaName ?? null,
  })
  return data ?? 'AI'  // fallback ngắn gọn
}
```

**Dùng trong `ConversationItem.tsx` và `ConversationHeader.tsx`:**
```tsx
const assistantName = useAssistantName()
const displayName = conv.name ?? (isAI ? assistantName : ...)
```

### Fix 3b — "AI" badge cho external bots (extbot:)

**`apps/web/components/chat/ConversationItem.tsx`:**

```tsx
// Hiện tại:
const AI_BOT_ID = 'ai-bot-000000000000000000000001'
const isAI = conv.participants.includes(AI_BOT_ID)

// Sau:
const AI_BOT_ID = 'ai-bot-000000000000000000000001'
const isAI = conv.participants.includes(AI_BOT_ID)
const isExtBot = !isAI && conv.participants.some((p) => p.startsWith('extbot:'))
const isAnyBot = isAI || isExtBot  // dùng cho badge và avatar bot icon
```

Thay tất cả chỗ render dùng `isAI` để hiện badge/bot-icon bằng `isAnyBot`:

```tsx
{/* Avatar */}
{isAnyBot ? (
  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
    <Bot className="size-4" />
  </AvatarFallback>
) : (
  // ... avatar người thường
)}

{/* "AI" badge bên cạnh tên */}
{isAnyBot && (
  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">
    AI
  </span>
)}
```

Làm tương tự trong **`ConversationHeader.tsx`** — tìm chỗ check `isAI` để render bot icon và "AI" badge, thêm `isExtBot` logic tương tự.

### Fix 3c — Display name cho external bot trong conversation list/header

External bot name đã được resolve từ `useAssistant()` (xem `ExternalBotBubble.tsx` line 16). Cần dùng tương tự trong `ConversationItem` và `ConversationHeader`.

Trong `ConversationItem.tsx`:
```tsx
// Nếu isExtBot, lấy extbot ID từ participants
const extBotId = isExtBot
  ? conv.participants.find((p) => p.startsWith('extbot:')) ?? null
  : null

// Hook này đã có — trả về { name, avatarUrl } của bot
const { data: extBotAssistant } = useAssistant(extBotId ?? undefined)

const displayName =
  conv.name ??
  (isAI
    ? assistantName                           // tên từ workspace settings
    : isExtBot
    ? (extBotAssistant?.name ?? 'Bot')        // tên từ Bot Factory
    : (otherNickname || otherUser?.displayName || t('conversationDefault')))
```

---

## Verification

1. **Form width**: Mở `/register` → form rộng hơn, "I agree to the Privacy Policy and Terms of Service" hiện trên một dòng.
2. **Pre-fill**: Hoàn tất forgot password flow → redirect sang `/login` → email + password được pre-fill tự động. Check sessionStorage đã bị clear sau khi dùng.
3. **Bot naming**: Vào Admin → AI Settings → đổi persona name thành "Aria" → quay lại chat với AI Assistant → hiện "Aria" thay vì "AI Assistant".
4. **ExtBot badge**: Trong conversation list, bot từ Bot Factory hiện "AI" badge giống native AI bot. Avatar hiện Bot icon thay vì initials.
