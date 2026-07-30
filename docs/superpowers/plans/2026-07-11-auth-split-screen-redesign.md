# Plan: Redesign trang Login/Register — layout 2 cột, cột trái là animation minh hoạ (không copy nguyên hình tham khảo)

> **Ngày:** 2026-07-11 | **Scope:** Web (`apps/web/`) only — đây là trang web-only (login/register desktop),
> Flutter có màn hình auth riêng của nó, không đụng tới.

---

## Bối cảnh

User gửi 1 ảnh tham khảo (layout sản phẩm "NewEra") gồm: cột trái = mảng marketing màu mè có 1 mockup
hội thoại + tagline + testimonial + badge compliance; cột phải = form đăng nhập nền tối. User yêu cầu
lấy Ý TƯỞNG LAYOUT (2 cột: 1 bên form, 1 bên trang trí), KHÔNG copy y hệt nội dung/thiết kế trong ảnh
— tự thiết kế lại cho PON, và bắt buộc phải có: animation 2 bên nhắn tin qua lại LẶP LẠI (không phải
tĩnh), kèm 1 slogan/tagline riêng của PON.

Hiện trạng: `apps/web/app/(auth)/layout.tsx` là layout 1 cột, canh giữa toàn màn hình (logo trên đầu +
form ở dưới, có ambient glow nền). `login/page.tsx` và `register/page.tsx` render y nguyên bên trong
`{children}` của layout này — plan này CHỈ đổi layout bao ngoài + thêm 1 component trang trí mới, KHÔNG
đụng logic form (auth hooks, validation, submit) ở `login/page.tsx`/`register/page.tsx`/
`forgot-password/page.tsx`/`verify-otp/page.tsx` — các file đó giữ nguyên 100%, tự động thừa hưởng
layout mới vì chúng chỉ là `{children}`.

---

## Thiết kế

**Layout:** `lg:grid lg:grid-cols-2 min-h-screen` — dưới `lg` (mobile/tablet hẹp) chỉ hiện form, ẩn
hẳn cột trang trí (giống cách các sản phẩm này vẫn làm — trên mobile không đủ chỗ cho panel marketing,
và PON đã có app Flutter riêng cho mobile rồi nên không cần cố nhồi vào web mobile).

- **Cột trái** (`hidden lg:flex`, nền gradient tối-tím giống tinh thần PON — dùng đúng
  `--color-pon-cyan/peach/pink` đã có sẵn thay vì bịa màu mới): logo PON góc trên-trái, mockup hội
  thoại animation ở giữa, tagline lớn + 3 chip tính năng thật (không bịa chứng nhận compliance giả)
  ở dưới.
- **Cột phải:** giữ nguyên style hiện tại (nền `bg-background`, ambient glow nhẹ, form card) —
  y hệt layout cũ nhưng giờ chỉ chiếm 1/2 màn hình thay vì canh giữa toàn trang.

**Animation "2 bên nhắn tin lặp lại":** 1 card mockup hội thoại nhỏ, lặp vô hạn theo chu kỳ ~7s:
tin nhắn 1 (người khác, bubble trái, màu nhạt) trượt+mờ dần vào → dừng 1.8s → typing-dots hiện ra
→ dừng 1s → tin nhắn 2 (mình, bubble phải, gradient PON) trượt+mờ dần vào → dừng 2s → cả cụm mờ dần
biến mất → lặp lại từ đầu. Dùng CSS keyframes thuần (không thêm framer-motion — dự án chưa có
dependency này, tránh phình bundle), theo ĐÚNG convention `pon-*` motion đã có sẵn trong
`globals.css` (mục "MANDATORY reduced-motion" phải áp dụng cho animation mới này luôn).

---

## Code

### 1. `apps/web/app/(auth)/layout.tsx` — viết lại

```tsx
import { getTranslations } from 'next-intl/server'
import { AuthShowcasePanel } from '@/components/auth/AuthShowcasePanel'

function PonLogo({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="ponAuthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6AC9FF" />
          <stop offset="50%" stopColor="#FBB68B" />
          <stop offset="100%" stopColor="#FF85B3" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 14.52 2.93 16.82 4.46 18.6L3 21L5.8 20.3C7.54 21.37 9.6 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18Z"
        fill="url(#ponAuthGradient)"
      />
      <circle cx="12" cy="12" r="3" fill="url(#ponAuthGradient)" />
    </svg>
  )
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth')
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Left — decorative showcase, desktop only */}
      <AuthShowcasePanel />

      {/* Right — form column (also the ONLY column on mobile/tablet) */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-background p-4 min-h-screen lg:min-h-0">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-28 size-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,133,179,0.14), transparent 70%)' }}
        />

        {/* Brand mark — shown here too since the showcase panel is hidden below `lg`. */}
        <div className="relative z-10 mb-8 flex flex-col items-center gap-2 motion-safe:pon-stagger lg:hidden">
          <PonLogo className="size-16 drop-shadow-[0_0_18px_rgba(106,201,255,0.45)]" />
          <span className="text-3xl font-black tracking-tight pon-gradient-text">PON</span>
          <span className="text-sm text-muted-foreground">{t('tagline')}</span>
        </div>

        <div className="relative z-10 w-full max-w-md motion-safe:pon-enter">{children}</div>
      </div>
    </div>
  )
}
```

### 2. `apps/web/components/auth/AuthShowcasePanel.tsx` — component mới

```tsx
'use client'

import { useTranslations } from 'next-intl'

function PonMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-6">
      <defs>
        <linearGradient id="ponMarkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6AC9FF" />
          <stop offset="50%" stopColor="#FBB68B" />
          <stop offset="100%" stopColor="#FF85B3" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 14.52 2.93 16.82 4.46 18.6L3 21L5.8 20.3C7.54 21.37 9.6 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18Z"
        fill="url(#ponMarkGradient)"
      />
      <circle cx="12" cy="12" r="3" fill="url(#ponMarkGradient)" />
    </svg>
  )
}

/** Looping 2-bubble "conversation" mockup — the animated centerpiece of the panel. */
function ConversationLoop({ otherLabel, otherMsg, ownMsg }: { otherLabel: string; otherMsg: string; ownMsg: string }) {
  const t = useTranslations('auth')
  return (
    <div className="pon-convo-loop relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md shadow-2xl">
      <div className="mb-4 flex items-center gap-2 text-xs font-medium text-white/60">
        <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-pon-cyan to-pon-pink text-[10px] font-bold text-black">
          AI
        </span>
        {otherLabel}
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="pon-convo-bubble-1 max-w-[85%] rounded-2xl rounded-bl-sm bg-white/90 px-3.5 py-2 text-sm text-black/80">
          {otherMsg}
        </div>
        <div className="pon-convo-typing flex w-fit items-center gap-1 rounded-full bg-white/10 px-3 py-2">
          <span className="pon-typing-dot size-1.5 rounded-full bg-white/60" />
          <span className="pon-typing-dot size-1.5 rounded-full bg-white/60" />
          <span className="pon-typing-dot size-1.5 rounded-full bg-white/60" />
        </div>
        <div className="pon-convo-bubble-2 ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-pon-cyan via-pon-peach to-pon-pink px-3.5 py-2 text-sm font-medium text-black self-end">
          {ownMsg}
        </div>
      </div>
    </div>
  )
}

export function AuthShowcasePanel() {
  const t = useTranslations('auth')
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#181030] via-[#2a1350] to-[#120a24] lg:flex lg:flex-col lg:justify-between lg:p-10">
      {/* Ambient glow, same PON gradient family as the rest of the app */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(106,201,255,0.25), transparent 70%)' }} />
      <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 size-[28rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(255,133,179,0.2), transparent 70%)' }} />

      <div className="relative z-10 flex items-center gap-2">
        <PonMark />
        <span className="text-lg font-bold text-white">PON</span>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center py-12">
        <ConversationLoop
          otherLabel={t('showcase.convoChannel')}
          otherMsg={t('showcase.convoOtherMsg')}
          ownMsg={t('showcase.convoOwnMsg')}
        />
      </div>

      <div className="relative z-10 space-y-5">
        <h1 className="text-4xl font-black leading-tight text-white">
          {t('showcase.headline')}
        </h1>
        <p className="max-w-md text-sm text-white/60">{t('showcase.subheadline')}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {(['selfHosted', 'governedAi', 'oneWorkspace'] as const).map((key) => (
            <span
              key={key}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70"
            >
              {t(`showcase.chip.${key}`)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### 3. `apps/web/app/globals.css` — thêm keyframes cho animation lặp

Thêm cạnh các `@keyframes pon-*` đã có (sau `pon-sheen`, trước phần `.pon-enter` áp dụng class):

```css
/* F. Auth showcase — looping 2-message conversation demo (login/register panel). */
@keyframes pon-convo-cycle {
  0%, 8%   { opacity: 0; transform: translateX(-16px); }
  14%, 46% { opacity: 1; transform: translateX(0); }
  92%, 100% { opacity: 0; transform: translateX(-16px); }
}
@keyframes pon-convo-cycle-right {
  0%, 46%  { opacity: 0; transform: translateX(16px); }
  56%, 84% { opacity: 1; transform: translateX(0); }
  92%, 100% { opacity: 0; transform: translateX(16px); }
}
@keyframes pon-typing-cycle {
  0%, 32%  { opacity: 0; }
  38%, 52% { opacity: 1; }
  58%, 100% { opacity: 0; }
}
@keyframes pon-typing-bounce {
  0%, 100% { transform: translateY(0); opacity: 0.4; }
  50%      { transform: translateY(-3px); opacity: 1; }
}

.pon-convo-bubble-1 {
  animation: pon-convo-cycle 7s cubic-bezier(0.22, 1, 0.36, 1) infinite;
}
.pon-convo-bubble-2 {
  animation: pon-convo-cycle-right 7s cubic-bezier(0.22, 1, 0.36, 1) infinite;
}
.pon-convo-typing {
  animation: pon-typing-cycle 7s ease-in-out infinite;
}
.pon-convo-typing .pon-typing-dot {
  animation: pon-typing-bounce 900ms ease-in-out infinite;
}
.pon-convo-typing .pon-typing-dot:nth-child(2) { animation-delay: 150ms; }
.pon-convo-typing .pon-typing-dot:nth-child(3) { animation-delay: 300ms; }
```

Thêm vào khối "MANDATORY reduced-motion: disable all PON motion" đã có sẵn (bắt buộc — mọi animation
PON phải tắt được khi user bật giảm chuyển động):

```css
/* Tìm khối @media (prefers-reduced-motion: reduce) { ... } đã có, thêm vào danh sách selector: */
@media (prefers-reduced-motion: reduce) {
  .pon-enter,
  .pon-pop,
  .pon-sheen,
  .pon-stagger > *,
  .pon-convo-bubble-1,
  .pon-convo-bubble-2,
  .pon-convo-typing,
  .pon-convo-typing .pon-typing-dot {
    animation: none !important;
  }
  .pon-sheen { display: none; }
  /* Khi tắt animation, vẫn phải thấy đủ nội dung — không được ẩn luôn 2 bubble: */
  .pon-convo-bubble-1,
  .pon-convo-bubble-2 { opacity: 1 !important; transform: none !important; }
  .pon-convo-typing { display: none; }
}
```

### 4. i18n — thêm namespace `auth.showcase` (7 locale)

`apps/web/messages/en.json` (trong object `"auth"`, thêm key `"showcase"`):
```json
"showcase": {
  "convoChannel": "AI Teammate",
  "convoOtherMsg": "Can you pull the Q3 numbers from the shared doc before standup?",
  "convoOwnMsg": "On it — done, summary's in the thread.",
  "headline": "One AI teammate. Every conversation.",
  "subheadline": "PON puts a company-aware AI assistant right inside your team chat — governed by role, hosted entirely on your own infrastructure.",
  "chip": {
    "selfHosted": "Self-hosted",
    "governedAi": "Role-governed AI access",
    "oneWorkspace": "One workspace, every team"
  }
}
```

`apps/web/messages/vi.json`:
```json
"showcase": {
  "convoChannel": "Trợ lý AI",
  "convoOtherMsg": "Lấy giúp số liệu Q3 từ file chung trước standup được không?",
  "convoOwnMsg": "Để tao — xong rồi, tóm tắt ở trong thread nhé.",
  "headline": "Một AI đồng đội. Mọi cuộc trò chuyện.",
  "subheadline": "PON đưa 1 trợ lý AI hiểu rõ công ty vào ngay trong chat của team — phân quyền theo vai trò, tự host toàn bộ trên hạ tầng của chính bạn.",
  "chip": {
    "selfHosted": "Tự host (self-hosted)",
    "governedAi": "AI truy cập theo quyền hạn",
    "oneWorkspace": "1 workspace, mọi phòng ban"
  }
}
```

Áp dụng cùng ý nghĩa cho `zh.json`, `ja.json`, `ko.json`, `fr.json`, `es.json` (dịch giữ đúng tinh
thần: 1 AI đồng đội, governed by role, self-hosted — không dịch cứng nhắc từng chữ).

**Không bịa chứng nhận compliance giả** (SOC 2/ISO 27001/HIPAA như ảnh tham khảo) — PON hiện chưa có
những chứng nhận đó thật, hiện 3 chip đang dùng là mô tả kiến trúc CÓ THẬT (self-hosted, RBAC, single
workspace) lấy từ đúng định vị sản phẩm trong `CLAUDE.md`, không phải marketing claim không kiểm
chứng được.

---

## Verification

1. `pnpm build` — PASS, không lỗi TS/lint.
2. Desktop (≥1024px): mở `/login` → thấy 2 cột, cột trái có animation hội thoại lặp lại mượt (test ít
   nhất 2 chu kỳ ~14s để chắc nó loop đúng, không giật/nhảy khi reset).
3. Mobile/tablet (<1024px): cột trái ẩn hoàn toàn, chỉ còn form — logo/tagline nhỏ hiện phía trên form
   (mirror hành vi cũ).
4. Bật `prefers-reduced-motion: reduce` (DevTools → Rendering → Emulate CSS media) → animation dừng
   hẳn, card hội thoại vẫn hiện đủ nội dung tĩnh (không bị ẩn mất 1 bubble nào).
5. `/register`, `/forgot-password`, `/verify-otp` đều tự động có layout mới (vì dùng chung
   `(auth)/layout.tsx`) — kiểm tra nhanh cả 3 trang không bị vỡ layout.
6. i18n: chuyển locale sang `vi` → nội dung cột trái đổi ngôn ngữ đúng.

## Lưu ý cho Claude Code

- KHÔNG đụng logic bên trong `login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`,
  `verify-otp/page.tsx` — chỉ thay đổi layout bao ngoài + thêm component mới.
- `AuthShowcasePanel.tsx` là component thuần trang trí, không gọi API nào — giữ `'use client'` chỉ vì
  dùng `useTranslations` (next-intl client hook); nếu muốn tối ưu có thể chuyển thành server component
  + truyền text qua props từ `layout.tsx` (đã là server component, `await getTranslations`), nhưng
  không bắt buộc.
- Tên class `pon-convo-*` đặt theo đúng convention `pon-*` đã dùng trong `globals.css`, không đặt tên
  khác để tránh lẫn với hệ thống animation cũ.
