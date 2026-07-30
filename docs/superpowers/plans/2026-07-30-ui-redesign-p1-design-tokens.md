# Plan: UI Redesign — P1: Design tokens (Warm Grey & Burgundy)

> **Ngày:** 2026-07-30 | **Scope:** Web (`apps/web/app/globals.css`) + Flutter
> (`apps/client/lib/core/theme/app_theme.dart`) ONLY. This is Layer 1 of a multi-plan program —
> read `docs/superpowers/UI-REDESIGN-DIRECTION.md` first for the full context, the locked palette
> decision log, and what Layer 2/3 will cover. Do not touch any screen/component file in this plan.

---

## Bối cảnh

Owner đã chốt hướng màu mới "Warm Grey & Burgundy" sau nhiều vòng review (xem decision log ở
`UI-REDESIGN-DIRECTION.md` §1) — bỏ hẳn theme Neon cũ (`ponCyan #6AC9FF` / `ponPeach #FBB68B` /
`ponPink #FF85B3`). Toàn bộ codebase hiện có **79 file web** và **116 file Flutter** tham chiếu tới
3 màu này trực tiếp — sửa từng file ngay bây giờ là chính xác cái bẫy "đọc hết codebase, cháy
token" đã xảy ra trước đó.

**Chiến lược của plan này:** KHÔNG đổi tên symbol, chỉ đổi giá trị đứng sau symbol, tại đúng 2 file
gốc (token nguồn của mỗi platform). Vì mọi nơi khác chỉ tham chiếu tới symbol (`ponCyan`,
`var(--primary)`, class `.pon-gradient-text`...) chứ không hardcode hex, đổi giá trị tại nguồn làm
toàn bộ 195 file kia tự động đổi màu — không cần mở file nào trong số đó ở layer này.

**Đánh đổi có chủ đích:** sau plan này, symbol `ponCyan`/`ponPeach`/`ponPink` (Flutter) và
`--color-pon-cyan/peach/pink` (web) sẽ mang tên cũ nhưng GIÁ TRỊ mới (không còn là cyan/peach/pink
thật) — tạm thời gây hiểu lầm khi đọc code. Đây là nợ kỹ thuật được ghi nhận có chủ đích để đổi màu
ngay lập tức trên toàn bộ app; Layer 2 (`UI-REDESIGN-DIRECTION.md` §3) sẽ đổi tên symbol đúng nghĩa
+ sửa từng call site theo batch nhỏ. Đánh dấu mọi chỗ đổi giá trị-không-đổi-tên bằng comment
`// TODO(ui-redesign-L2): rename` (Dart) / `/* TODO(ui-redesign-L2): rename */` (CSS) để Layer 2 dễ
tìm.

**3 màu Neon cũ collapse thành 1 màu burgundy duy nhất** (thay vì giữ 3 sắc riêng biệt) — điều này
tự động thỏa mãn nguyên tắc "1 accent duy nhất" của hướng thiết kế mới (`UI-REDESIGN-DIRECTION.md`
§2 rule 1) ở mọi nơi đang dùng cả 3 màu cho gradient/đa sắc (ví dụ `ponGradient`, `.pon-gradient`),
mà không cần sửa các chỗ đó.

---

## Palette áp dụng (nguồn: `UI-REDESIGN-DIRECTION.md` §2)

| Token | Light | Dark |
|---|---|---|
| background | `#F5F2ED` | `#1A1614` |
| card/surface | `#FFFFFF` | `#221D1A` |
| text primary | `#241F1D` | `#F3EEE8` |
| text secondary | `#6B6259` | `#B0A79C` |
| border | `#DDD8D0` | `#332B27` |
| accent (primary action) | `#7A2E3A` | `#A8475A` |
| accent tint (bg nhẹ) | `#F1E4E6` | `#3A2A2C` |
| destructive | `#B3261E` | `#E5484D` |

Vì cả 2 file nguồn hiện tại đều dùng **1 hằng số accent chung** cho cả light lẫn dark context
(kiến trúc có sẵn, không phải lỗi mới) — dùng 1 giá trị burgundy trung gian **`#96435B`** cho những
chỗ không phân biệt được light/dark tại thời điểm khai báo (Flutter `ponCyan/ponPeach/ponPink`,
web `--color-pon-cyan/peach/pink`). Những chỗ CÓ phân biệt light/dark (`ColorScheme.light` vs
`.dark`, `:root` vs `.dark` trong CSS) thì dùng đúng `#7A2E3A`/`#A8475A` theo bảng trên.

---

## Task 1 — Web: `apps/web/app/globals.css`

### 1a. `:root` (light) — thay các dòng sau (giữ nguyên các dòng không liệt kê, vd `--chart-*`)

```css
:root {
  --radius: 0.75rem;
  --background: #F5F2ED;
  --foreground: #241F1D;
  --card: #FFFFFF;
  --card-foreground: #241F1D;
  --popover: #FFFFFF;
  --popover-foreground: #241F1D;
  --primary: #7A2E3A;
  --primary-foreground: #FFFFFF;
  --secondary: #EFEAE3;
  --secondary-foreground: #241F1D;
  --muted: #EFEAE3;
  --muted-foreground: #6B6259;
  --accent: #F1E4E6;
  --accent-foreground: #7A2E3A;
  --destructive: #B3261E;
  --border: #DDD8D0;
  --input: #FFFFFF;
  --ring: #7A2E3A;
  /* --chart-1..5 giữ nguyên, ngoài phạm vi P1 */
  --sidebar: #EFEAE3;
  --sidebar-foreground: #241F1D;
  --sidebar-primary: #7A2E3A;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #F1E4E6;
  --sidebar-accent-foreground: #7A2E3A;
  --sidebar-border: #DDD8D0;
  --sidebar-ring: #7A2E3A;
}
```

### 1b. `.dark` — thay các dòng sau

```css
.dark {
  --background: #1A1614;
  --foreground: #F3EEE8;
  --card: #221D1A;
  --card-foreground: #F3EEE8;
  --popover: #221D1A;
  --popover-foreground: #F3EEE8;
  --primary: #A8475A;
  --primary-foreground: #F3EEE8;
  --secondary: #2C2521;
  --secondary-foreground: #F3EEE8;
  --muted: #2C2521;
  --muted-foreground: #B0A79C;
  --accent: #3A2A2C;
  --accent-foreground: #E8B4BE;
  --destructive: #E5484D;
  --border: #332B27;
  --input: #221D1A;
  --ring: #A8475A;
  /* --chart-1..5 giữ nguyên, ngoài phạm vi P1 */
  --sidebar: #151110;
  --sidebar-foreground: #F3EEE8;
  --sidebar-primary: #A8475A;
  --sidebar-primary-foreground: #F3EEE8;
  --sidebar-accent: #2C2521;
  --sidebar-accent-foreground: #E8B4BE;
  --sidebar-border: #332B27;
  --sidebar-ring: #A8475A;
}
```

### 1c. `@theme inline` block — thay 3 dòng pon-cyan/peach/pink (giữ nguyên pon-blue/pon-green/online-green)

```css
  --color-pon-cyan: #96435B; /* TODO(ui-redesign-L2): rename to --color-pon-accent, was #6AC9FF */
  --color-pon-peach: #96435B; /* TODO(ui-redesign-L2): rename/retire, was #FBB68B */
  --color-pon-pink: #96435B; /* TODO(ui-redesign-L2): rename/retire, was #FF85B3 */
```

### 1d. `.pon-gradient` / `.pon-gradient-text` — bỏ gradient, dùng màu phẳng (đúng rule "không gradient" trừ logo mark)

```css
.pon-gradient {
  /* TODO(ui-redesign-L2): rename class, no longer a gradient by design */
  background: var(--primary);
}

.pon-gradient-text {
  /* TODO(ui-redesign-L2): rename class, no longer a gradient by design */
  background: var(--primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

**Không đụng** phần `@keyframes pon-*` motion (dòng ~164 trở xuống) — animation timing/easing không
thuộc phạm vi đổi màu.

---

## Task 2 — Flutter: `apps/client/lib/core/theme/app_theme.dart`

### 2a. Brand + background constants (đầu file)

```dart
class AppTheme {
  // TODO(ui-redesign-L2): rename ponCyan/ponPeach/ponPink -> ponAccent, collapsed to one
  // burgundy value in P1 so every existing call site repaints without edits.
  static const Color ponCyan = Color(0xFF96435B);
  static const Color ponPeach = Color(0xFF96435B);
  static const Color ponPink = Color(0xFF96435B);
  static const Color onlineGreen = Color(0xFF00E676);
  static const Color offlineGrey = Color(0xFF9E9E9E);

  // Gradients — kept as a LinearGradient (call sites expect this type) but both stops are now
  // the same accent value, so it renders flat per the "no decorative gradients" design rule.
  static const LinearGradient ponGradient = LinearGradient(
    colors: [ponCyan, ponCyan],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Backgrounds - Dark
  static const Color darkBackground = Color(0xFF1A1614);
  static const Color darkSurface = Color(0xFF221D1A);
  static const Color darkBorder = Color(0xFF332B27);

  // Backgrounds - Light
  static const Color lightBackground = Color(0xFFF5F2ED);
  static const Color lightSurface = Colors.white;
  static const Color lightBorder = Color(0xFFDDD8D0);
```

### 2b. `darkTheme` — `colorScheme` + `primaryContainer`

```dart
      colorScheme: const ColorScheme.dark(
        primary: ponCyan,
        secondary: ponPink,
        tertiary: ponPeach,
        surface: darkSurface,
        error: Colors.redAccent,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        primaryContainer: Color(0xFF3A2A2C),
        onPrimaryContainer: ponCyan,
      ),
```

### 2c. `lightTheme` — `colorScheme` + `primaryContainer`

```dart
      colorScheme: const ColorScheme.light(
        primary: ponCyan,
        secondary: ponPink,
        tertiary: ponPeach,
        surface: lightSurface,
        error: Colors.redAccent,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        primaryContainer: Color(0xFFF1E4E6),
        onPrimaryContainer: ponCyan,
      ),
```

### 2d. Radius — trong CẢ `darkTheme` VÀ `lightTheme`

Mỗi theme block có 7 chỗ `BorderRadius.circular(24)`. Đổi theo quy tắc
`UI-REDESIGN-DIRECTION.md` §2 rule 4:
- `cardTheme.shape` → `BorderRadius.circular(12)` (card)
- `inputDecorationTheme` — cả 5 chỗ (`border`, `enabledBorder`, `focusedBorder`, `errorBorder`,
  `focusedErrorBorder`) → `BorderRadius.circular(10)` (control)
- `filledButtonTheme.style.shape` → `BorderRadius.circular(10)` (control)

Không đổi bất kỳ giá trị nào khác trong các block này (padding, elevation, text style giữ nguyên).

---

## Verification

1. Web: `pnpm --filter @platform/web build` — PASS, không lỗi TS/lint.
2. Flutter: `cd apps/client && flutter analyze` — clean.
3. Chạy web dev, mở `/login` (hoặc bất kỳ trang nào) ở cả light và dark mode — xác nhận nền/chữ/
   border đổi sang tông ấm mới, nút CTA màu burgundy, KHÔNG còn gradient cam-hồng-xanh ở logo/nút.
4. Build Flutter (`flutter run` hoặc ít nhất `flutter analyze` + kiểm tra 1 màn hình qua hot reload
   nếu có device/emulator) — cùng kiểm tra như trên.
5. Kiểm tra nhanh contrast: chữ trên nền (`#241F1D` trên `#F5F2ED`, `#F3EEE8` trên `#1A1614`) và
   chữ trắng trên nút accent (`#FFFFFF`/`#F3EEE8` trên `#7A2E3A`/`#A8475A`) đều đọc rõ, không mờ.
   Nếu bất kỳ cặp nào nhìn thiếu tương phản trên máy thật, được phép chỉnh **độ sáng** (không đổi
   hue/tông màu) ±10% để đạt WCAG AA (contrast ratio ≥ 4.5:1 cho text thường, ≥ 3:1 cho text lớn/UI
   control) — ghi lại giá trị cuối cùng nếu có chỉnh vào phần "Ghi chú thực thi" cuối file plan này.
6. Không có file nào khác ngoài `globals.css` và `app_theme.dart` bị sửa trong plan này — nếu phát
   hiện cần sửa thêm để build pass (ví dụ 1 file nào đó extends `AppTheme` theo cách bất thường),
   dừng lại và báo cáo thay vì tự ý mở rộng phạm vi.

## Lưu ý cho Claude Code

- Đây là plan CHỈ đổi giá trị token, không đổi tên symbol, không sửa bất kỳ file screen/component
  nào khác — kể cả khi thấy rõ 1 file đang hardcode `#6AC9FF` hay tương tự. Ghi nhận lại (không bắt
  buộc phải liệt kê hết) để dùng cho Layer 2, không tự ý sửa trong plan này.
- Giữ nguyên toàn bộ comment `// TODO(ui-redesign-L2): ...` đã cho trong code mẫu ở trên — đây là
  điểm neo để Layer 2 tìm và dọn nợ kỹ thuật.
- Sau khi xong, cập nhật `docs/superpowers/plans/README.md` thêm 1 dòng cho plan này vào mục
  "Done" kèm commit hash, và cập nhật `UI-REDESIGN-DIRECTION.md` §3 đổi trạng thái Layer 1 từ
  "ready to execute" → "done, commit `<hash>`".

---

## Ghi chú thực thi (2026-07-30, commit `86ca2212`)

**Đã thực thi đúng plan, không lệch giá trị nào.** Chỉ 2 file được sửa:
`apps/web/app/globals.css` + `apps/client/lib/core/theme/app_theme.dart`.

### Build/test
- `pnpm --filter @platform/web build` → **PASS** (không lỗi TS/lint, toàn bộ ~40 route compile).
- `cd apps/client && flutter analyze` → **No issues found!**

### Contrast — KHÔNG cần chỉnh giá trị nào
Tính contrast ratio theo WCAG 2.1 cho mọi cặp trong plan; tất cả đạt AA:

| Cặp | Ratio | Ngưỡng |
|---|---|---|
| `#241F1D` trên `#F5F2ED` (text/bg light) | 14.0:1 | ≥4.5 ✅ |
| `#F3EEE8` trên `#1A1614` (text/bg dark) | 14.8:1 | ≥4.5 ✅ |
| `#FFFFFF` trên `#7A2E3A` (CTA light) | 9.2:1 | ≥4.5 ✅ |
| `#F3EEE8` trên `#A8475A` (CTA dark) | 4.9:1 | ≥4.5 ✅ |
| `#6B6259` trên `#F5F2ED` (muted light) | 5.4:1 | ≥4.5 ✅ |
| `#B0A79C` trên `#1A1614` (muted dark) | 7.6:1 | ≥4.5 ✅ |
| `#7A2E3A` trên `#F1E4E6` (accent-fg light) | 7.5:1 | ≥4.5 ✅ |
| `#E8B4BE` trên `#3A2A2C` (accent-fg dark) | 7.6:1 | ≥4.5 ✅ |
| `#B3261E` trên `#F5F2ED` (destructive light) | 5.9:1 | ≥4.5 ✅ |
| `#E5484D` trên `#1A1614` (destructive dark) | 4.6:1 | ≥4.5 ✅ |
| `#FFFFFF` trên `#96435B` (Flutter accent chung) | 6.5:1 | ≥4.5 ✅ |

### Ghi nhận cho Layer 2 (không sửa ở P1)
- **`onPrimaryContainer` trong Flutter là dead token.** Cả 2 `ColorScheme` đặt
  `onPrimaryContainer: ponCyan`, nhưng cặp `#96435B` trên `primaryContainer` dark `#3A2A2C` chỉ
  đạt **2.7:1** (< 3:1). Đã kiểm tra: không có call site nào đọc `onPrimaryContainer`
  (`grep -rn "onPrimaryContainer" apps/client/lib` chỉ ra chính `app_theme.dart`;
  `primaryContainer` chỉ được dùng làm *background* ở `chat/ui/widgets/chats_tab.dart:189`).
  → Không phải lỗi hiển thị thực tế nên giữ nguyên theo plan. Layer 2 khi đổi tên symbol nên đặt
  `onPrimaryContainer` dark thành một tint sáng hơn (web dùng `#E8B4BE` cho đúng vai trò này).
- **Chưa verify bằng mắt trên browser/emulator** (verification step 3 & 4). Dev server web chạy OK
  (`localhost:3000/login` trả 200) nhưng Chrome automation trong session này trỏ sang máy khác nên
  owner yêu cầu dừng; không có emulator Flutter. Contrast đã verify bằng tính toán thay vì ảnh
  chụp. Cần owner mở app xác nhận cảm quan trước khi bắt đầu Layer 2.
