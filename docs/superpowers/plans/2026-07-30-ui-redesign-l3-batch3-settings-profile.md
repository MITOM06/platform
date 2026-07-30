# Plan: UI Redesign — Layer 3, Batch 3: Settings & Profile

> **Ngày:** 2026-07-30 | **Trạng thái:** ✅ Done | 24 file
> **Scope:** `apps/client/lib/features/settings/` + `profile/` (21 file) và
> `apps/web/app/(main)/settings|profile|token-usage/` + `components/profile|settings/`.
> Đọc `docs/superpowers/UI-REDESIGN-DIRECTION.md` §2 trước.

---

## Bối cảnh

Batch nhỏ hơn batch 2 nhiều (21 file Flutter, 130 literal). Web gần như đã sạch từ Layer 2 (0 shadow,
0 blur) nhưng **vẫn còn 2 ổ màu ngoài palette** — xem mục 3.

`token-usage` được kéo vào batch này (thay vì batch 6) vì mirror Flutter của nó là
`settings/ui/token_usage_screen.dart`, nằm trong scope settings — tách ra sẽ làm 2 platform lệch.

---

## Đã làm — Flutter

### 1. 35 ternary `isDark ? X : Y` → token
Cùng loại với batch 2b: đã theme-aware nhưng off-palette. `white/black87` → `onSurface`;
`white54/70/38 : black54/45/38` → `mutedText`; `white12 : black12` (track progress bar) → `hairline`;
`white24 : black26` (icon chevron) → `mutedText`.

**Lưu ý phân biệt fill/border (bài học batch 2b):** `white12 : black12` ở
`token_usage_screen` là **background của LinearProgressIndicator** (fill), không phải border —
`hairline` vẫn đúng ở đây vì track cần low-contrast, nhưng phải kiểm chứ không map máy móc. Ngược lại
`white24 : black26` là **màu icon** nên dùng `mutedText`, không dùng `hairline`.

### 2. Sau khi map, 3 ternary thành thoái hoá (2 nhánh giống nhau) → thu về 1 token
Cộng thêm các ternary border `isDark ? darkBorder@50% : hairline` → `hairline`.

### 3. `SettingsCard` có `required Color glowColor` — API cho phép mỗi card một màu riêng
Đây là vi phạm §2 rule 1 ở tầng **API**, không chỉ ở call site: 11 call site truyền 10 lần
`ponAccent` + 1 lần `Colors.redAccent`. Đã refactor:
- Bỏ `glowColor` và `isDark`, thêm `bool destructive = false`.
- `accent = destructive ? colorScheme.error : colorScheme.primary`.
- Card "Blocked chats" → `destructive: true` (đỏ ở đây **có nghĩa**, không phải trang trí).
- Cùng lúc bỏ `isDark` khỏi `SecurityCard` + `NotificationsCard` (chỉ còn dùng cho param no-op).
- **Trùng khớp với web**: `SettingsCard` bên web đã có prop `destructive` sẵn → giờ 2 platform cùng API.

### 4. Aura orb accent → xoá (4 chỗ: `settings_screen` x2, `legal_screen` x2)
Lần thứ **4** trong program (auth, conversation list, và giờ settings + legal) tìm thấy orb mà
Layer 2 báo đã dọn hết.

### 5. Gradient còn lại → flat
`user_profile_parts` (cover), `edit_profile_header` (cover), `settings_avatar_section` (avatar ring):
đều là `LinearGradient([accent, accent])` thoái hoá → `color: ponAccent`.

### 6. Màu ngoài palette → token
- **`Color(0xFF00E5FF)` — NEON CYAN của brand cũ** trong `token_usage_chart` (series "input"). Lại
  một literal cục bộ mà L1/L2 bỏ sót, giống `#4FE3FF` mà batch 2b tìm được. Đổi thành **2 sắc của
  cùng 1 accent**: input = `ponAccent@45%`, output = `ponAccent` (đúng rule 1, vẫn phân biệt được
  2 series).
- **`Color(0xFF1A1A2E)` (3 chỗ) — di sản của hướng "dark indigo SaaS" đã bị owner từ chối** (§1
  decision log) → `colorScheme.surface`.
- `Color(0xFF96435B)` → `AppTheme.ponAccent`.
- Giữ `#F59E0B`/`#FFB74D` (amber = warning "chưa đặt password", semantic).

### 7. Bug contrast thật — 5 chỗ chữ/icon ĐEN trên nút burgundy (~2:1)
`edit_profile_screen` (1 nút + spinner), `phone_verification_bottom_sheet` (2 nút + 2 spinner), và
`token_usage_screen` DatePicker `onPrimary: Colors.black`. Tất cả → trắng.
Cùng loại bug với FAB `kb_screen` mà batch 2b tìm được → **đây là pattern lặp lại, batch sau nên
grep `foregroundColor: Colors.black` và `onPrimary: Colors.black` ngay từ đầu.**

### 8. Param no-op của Layer 2 → bỏ hết ở call site (34 chỗ)
`glowColor` (19), `glowStrength` (7), `focusColor` (6), `gradientColors` (1), `borderOpacity` (1).
⚠️ Trong lúc làm đã **xóa nhầm** `glowColor` của `SettingsCard` (là param *thật, required*, không
phải no-op của `PonCard`) → `flutter analyze` bắt được ngay bằng 11 lỗi
`missing_required_argument`. Đó là lý do dẫn tới refactor ở mục 3, nhưng bài học là: **regex theo
tên param có thể trúng widget nội bộ trùng tên — luôn kiểm `required this.<name>` trước khi quét.**

### 9. Radius → thang §2 rule 4 (9 chỗ)
Dialog bỏ hẳn override `shape` (để `dialogTheme` lo), bottom sheet 20 → `radiusSheet`,
card 20 → `radiusCard`.

### 10. Dialog background override → xoá (5 chỗ)
`backgroundColor: isDark ? darkSurface : Colors.white` → `dialogTheme` đã lo từ batch 2a.
**Đã kiểm màu chữ trong cùng commit** (bài học của 2b) — không tái diễn lỗi trắng-trên-trắng.

---

## Đã làm — Web

### `SettingsCard` (`app/(main)/settings/page.tsx`)
Có prop `iconBg: string` cho phép mỗi card truyền rgba tự do — và **4 card đang truyền violet
`rgba(180,127,255,…)`**, tức accent thứ hai, đúng bệnh của `glowColor` bên Flutter. Đã bỏ `iconBg`,
tint icon derive từ `destructive` (`bg-primary/10` / `bg-destructive/10`). Xoá luôn lớp
`radial-gradient` hover trang trí → hover phẳng (`hover:bg-accent`).

### `StatCard` (`app/(main)/token-usage/page.tsx`)
Prop `glowColor` với các giá trị gồm **neon cyan `rgba(0,229,255,…)`** và violet → 2 accent phụ, vẽ
bằng radial gradient. Bỏ prop, icon chip dùng `bg-primary/10`, hover phẳng.

### Token hygiene
`bg-primary text-white` → `text-primary-foreground` (4 avatar + 1 nút submit + 1 camera badge).
Giữ `text-white` trên scrim `bg-black/40–70%` phủ ảnh cover — đúng.

---

## Verification

| Gate | Kết quả |
|---|---|
| `cd apps/client && flutter analyze` | **No issues found!** |
| `cd apps/client && flutter test` | **60/60 passed** |
| `pnpm --filter @platform/web build` | **PASS** — exit 0 |
| Gradient trong settings/profile (Flutter) | **0** |
| Radius quá cỡ | **0** |
| `isDark ? Colors.*` ternary | **0** |
| Hex off-palette (cyan/indigo/violet) 2 platform | **0** |
| Param no-op còn truyền | **0** |
| Literal `Colors.white/black` còn lại | **20** — đều trên accent (nút, badge, spinner) hoặc scrim ảnh cover |

Diff: 24 file, **+136 / −324** (xoá nhiều hơn thêm — phần lớn là code trang trí bị bỏ).
Không chạy `dart format` (12/21 file trong scope chưa format-clean).

---

## Cố ý KHÔNG làm

- `components/admin/usage-dashboard.tsx` còn `glowColor="rgba(180,127,255,…)"` → **batch 5 (admin)**.
- `app/(main)/ai-hub/page.tsx` còn `iconBg="rgba(180,127,255,…)"` (2 chỗ) → **batch 4 (AI)**.
- `assistant_sheen_avatar.dart` + `AssistantEntry.tsx` + `AssistantPreviewAvatar.tsx` vẫn còn
  gradient violet→teal → **batch 4**, sửa cùng nhau cho khớp 2 platform.
- Amber `#F59E0B`/`#FFB74D` giữ nguyên: warning semantic, cùng carve-out với destructive/success.
- `pon_widgets.dart` vẫn khai báo param no-op — xoá declaration là pass cuối sau cả 6 batch.
