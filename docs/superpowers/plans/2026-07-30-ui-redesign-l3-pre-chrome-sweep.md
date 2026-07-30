# Plan: UI Redesign — L3-pre: cross-cutting chrome sweep (shadows, glass, radii)

> **Ngày:** 2026-07-30 | **Commit:** `11d641aa` | **Trạng thái:** ✅ Done
> **Scope:** 57 file (web + Flutter). Đây là pass *cross-cutting* nằm giữa Layer 2 và Layer 3 —
> không phải một batch per-screen. Đọc `docs/superpowers/UI-REDESIGN-DIRECTION.md` trước.

---

## Bối cảnh

Plan này được viết **trong lúc thực thi**, làm decision record (giống cách Layer 2 đã làm), vì nó
không tồn tại trước đó: một session Claude Code trước đã bắt đầu pass này ngay sau Layer 2, bị lỗi
giữa đường, và để lại 55 file dirty chưa commit + 4 file rác `_tmp_*` (0 byte).

Lý do pass này tách khỏi Layer 3: 3 quy tắc `UI-REDESIGN-DIRECTION.md` §2 (rule 2 no glass, rule 3
no elevation shadow, rule 4/5 radius) là **mechanical và cross-cutting** — áp dụng cho mọi screen
theo cùng một cách. Làm chúng một lượt rẻ hơn và nhất quán hơn là rải vào 6 batch per-screen, và
nó dọn sạch nền để mỗi batch Layer 3 chỉ còn phải lo spacing/typography/layout riêng của screen đó.

---

## Đã làm

### 1. Elevation shadow → hairline border (§2 rule 3)
- Web: xoá `shadow-sm|md|lg|xl|2xl|xs` khỏi mọi card/row/button/popover/FAB/tooltip.
- Flutter: xoá toàn bộ `boxShadow` (kể cả glow màu accent) khỏi banner, dots, OTP box, theme card,
  conversation tile, avatar section, call prompt.
- **Đã verify từng surface floating vẫn còn `border`** trước khi bỏ shadow (CallOverlay,
  IncomingGroupCall, tooltip token-usage, popover MessageInputParts, prompt call Flutter) — không
  surface nào bị mất cả shadow lẫn border.

### 2. Glassmorphism → opaque (§2 rule 2)
- Web `backdrop-blur*`: **28 → 0**. Flutter `BackdropFilter`: **1 → 0**
  (`floating_reaction_sheet.dart` — kèm sửa docstring "premium, glassmorphic" đã sai).
- Quan trọng: các surface chỉ *tồn tại để được blur* (`bg-background/80..95`, `bg-card/40`) giờ
  thành **opaque thật**. Bỏ blur mà giữ alpha là một regression thị giác — sticky header, tab bar,
  composer chrome sẽ để content scroll lòi qua mà không có blur che.
- Cách áp dụng an toàn: chỉ de-alpha đúng những element **đã mất blur trong pass này** (đối chiếu
  từng file bằng `git diff` xem token nào nằm trên dòng có `backdrop-blur` bị xoá), không sed
  toàn bộ. Nhờ vậy giữ nguyên các translucency có chủ đích.

### 3. Radius (§2 rule 4 + 5)
- `rounded-2xl` (16px) → `rounded-lg` (8px) cho card/media/tile; `rounded-[24px]` → `rounded-[14px]`
  cho bubble; bubble asymmetric `rounded-tl-[4px]` / `rounded-tr-[4px]` (rule 5).
- OTP box về **10px trên CẢ 2 platform** (trước: web `rounded-md` 6px, Flutter `circular(12)`) —
  vừa đúng rule 4 (control 8–10px) vừa là fix parity theo `.claude/rules/sync.md`.
- Sheet/modal giữ 16–20px (đúng rule 4): `CallOverlay`/`IncomingGroupCall` giữ `rounded-2xl`,
  `floating_reaction_sheet` 28 → 20.

### 4. Degenerate gradient → flat fill
`LinearGradient([ponAccent, ponAccent])` (di sản Layer 1 collapse 3 màu → 1) đổi thành
`color: ponAccent` ở `chat_input_bar.dart` (2 chỗ: send button của normal row + recording row).

### 5. Bug do session bị lỗi để lại — đã sửa
- `ConversationList.tsx`: sweep đã cắt chuỗi `md:backdrop-blur-none` thành class rác **`md:-none`**
  (Tailwind không hiểu, im lặng không lỗi build).
- `chat_input_bar.dart`: `flutter analyze` đang **FAIL** (`prefer_const_constructors`) vì sau khi bỏ
  boxShadow thì decoration const-able được; ngoài ra còn 1 `BoxDecoration` chỉ còn `borderRadius`
  → no-op paint, đã xoá.
- Xoá 4 file rác `_tmp_*` (0 byte, untracked, không được reference ở đâu).

### 6. Contrast
`ChatTypingIndicator` dùng ad-hoc `text-foreground/50`; trên `bg-card` giờ opaque (`#FFFFFF` light)
tỉ lệ chỉ **3.2:1** — dưới AA 4.5 cho text 12px. Đổi sang token `text-muted-foreground` (đã verify
AA ở Layer 1: 5.4:1 light / 7.6:1 dark). Không đổi hue, không đổi giá trị token nào.

---

## Verification

| Gate | Kết quả |
|---|---|
| `pnpm --filter @platform/web build` | **PASS** — exit 0, 0 error, toàn bộ route compile |
| `cd apps/client && flutter analyze` | **No issues found!** |
| `backdrop-blur` / `BackdropFilter` còn lại | 0 / 0 |
| Class Tailwind bị mangle (`-none`, double-space) | 0 |

Chưa verify bằng mắt trên browser/emulator — vẫn là nợ tồn từ Layer 1/2 (xem §3 direction doc).

---

## Cố ý KHÔNG làm (để lại cho Layer 3 batch)

- `MessageBubble` select-checkbox (`bg-background/80`) và `MessageViewport` date pill: translucency
  **có chủ đích** vì nằm trên wallpaper user chọn → thuộc batch Chat core.
- Presence-dot green glow (`shadow-[0_0_6px_rgba(0,230,118,0.6)]`, 2 chỗ) và
  `shadow-[inset_2px_0_0_0_var(--primary)]` (thanh selection, không phải elevation): out of scope
  theo §2 (success green giữ nguyên).
- **37 chỗ `BorderRadius.circular(20..39)` còn lại trong Flutter**, rải trong 25 widget per-screen
  (sheet, dialog, menu, bottom sheet). Không normalize ở đây vì web *chưa* được normalize tương ứng
  ở mức đó — sửa một bên sẽ làm 2 platform lệch nhau, trái `sync.md`. Thuộc từng batch Layer 3.
- Các text dùng ad-hoc alpha (`text-foreground/50`, `/70`…) thay vì token `muted-foreground`: chỉ
  sửa đúng 1 chỗ mà pass này làm đổi background. Audit đầy đủ thuộc Layer 3.
