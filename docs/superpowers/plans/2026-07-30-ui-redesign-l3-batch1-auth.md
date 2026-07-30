# Plan: UI Redesign — Layer 3, Batch 1: Auth

> **Ngày:** 2026-07-30 | **Trạng thái:** ✅ Done
> **Scope:** `apps/client/lib/features/auth/` (6 screen + 2 widget) + `apps/web/app/(auth)/` (5 page
> + 3 component). 12 file. Đọc `docs/superpowers/UI-REDESIGN-DIRECTION.md` §2 trước.

---

## Bối cảnh

Batch đầu của Layer 3. Viết trong lúc thực thi làm decision record (theo convention của Layer 2 và
L3-pre). Chrome (shadow/glass/radius) đã do L3-pre xử lý toàn cục, nên batch này chỉ còn phần
per-screen.

**Phát hiện quan trọng khi khảo sát: 2 platform lệch nhau rất xa ở auth.**
- **Web đã sạch** — Layer 2 đã viết lại `AuthShowcasePanel` và các trang `(auth)/*` dùng token
  theme-aware. Chỉ còn 3 chỗ radius control 6px và 1 nút SSO bị "trang trí" bằng accent.
- **Flutter thì chưa** — toàn bộ 6 screen auth vẫn còn nguyên di sản neon: aura orb accent, chữ
  hardcode `Colors.white`, một accent thứ hai (amber), và các param no-op từ shim của Layer 2.

Vì `.claude/rules/sync.md` yêu cầu 2 platform không được lệch, batch này chủ yếu là **Flutter đuổi
theo web**, cộng vài chỉnh nhỏ trên web để 2 bên khớp nhau.

---

## Bug thật tìm được (không chỉ là thẩm mỹ)

**Auth Flutter vỡ hoàn toàn ở light mode.** 6 screen hardcode `color: Colors.white` cho tiêu đề,
label, divider, nút OAuth. `ThemeMode.light` và `.system` đều reachable (`theme_provider.dart`, và
chính `ThemeOnboardingScreen` cho user chọn Light), còn `lightTheme.scaffoldBackgroundColor` là
`#F5F2ED` → **chữ trắng trên nền kem, gần như không đọc được**. Đây là lý do batch này phải đổi màu
chứ không chỉ đổi radius.

---

## Đã làm — Flutter

### 1. Aura orb trang trí → xoá (§2 rule 1 + 2)
5 screen (`login`, `register`, `verify_otp`, `forgot_password`, `new_password`) bọc nội dung trong
`Stack` chỉ để vẽ 2–3 `Positioned` + `RadialGradient` màu accent làm "ambient light". Accent chỉ được
mang nghĩa "primary action", không được trang trí → xoá orb, unwrap luôn `Stack` (body giờ là
`SafeArea` trực tiếp, bớt 1 tầng nesting). Layer 2 tưởng đã dọn hết aura orb nhưng bỏ sót auth.

### 2. Hardcoded màu → token theme-aware (§2 rule 6) — fix bug light mode
Thêm 2 resolver vào `AppTheme` để screen không phải tự viết ternary `isDark`:
```dart
static Color mutedText(BuildContext context)  // darkTextMuted / lightTextMuted
static Color hairline(BuildContext context)   // darkBorder / lightBorder
```
Mapping đã áp dụng:

| Trước | Sau |
|---|---|
| `color: Colors.white` (tiêu đề) | `Theme.of(context).colorScheme.onSurface` (warm ink) |
| `Colors.white.withValues(alpha: .5/.6/.7/.85)` | `AppTheme.mutedText(context)` |
| `Colors.white54` / `Colors.white38` | `AppTheme.mutedText(context)` |
| `Divider(color: Colors.white24)` | `Divider(color: AppTheme.hairline(context))` |
| `Colors.white.withValues(alpha: .15/.4)` (track) | `AppTheme.hairline(context)` |
| `foregroundColor: Colors.white` (OAuth btn) | `colorScheme.onSurface` |
| `side: BorderSide(Colors.white@.3)` | `side: BorderSide(AppTheme.hairline(context))` |

### 3. Accent thứ hai → bỏ (§2 rule 1)
`ThemeOnboardingScreen._ThemeOptionCard` nhận param `activeColor`, và card "Light" truyền
`Colors.amber` → 2 accent trong cùng 1 view. **Xoá hẳn param**, cả 3 card dùng `AppTheme.ponAccent`.
Trạng thái selected giờ = accent tint làm background (đúng vai trò của token "accent tint" trong §2)
+ border accent, không phải amber.

### 4. Nút phụ không được mặc accent (§2 rule 1)
Nút **SSO** (Flutter `login_screen` + web `login/page.tsx`) đang dùng accent cho cả chữ lẫn border,
nhưng nó là *secondary action* — primary action của view là nút Login. Đổi cả 2 platform sang
neutral (`onSurface` + hairline / `border-border` + `hover:bg-muted`).

### 5. Gradient thoái hoá + weight (§2 rule 2 + 6)
`ThemeOnboardingScreen` bọc tiêu đề trong `ShaderMask` + `LinearGradient([ponAccent, ponAccent])` —
vừa là gradient, vừa tô accent lên chữ không phải action. Bỏ `ShaderMask`, tiêu đề dùng `onSurface`
+ `w600`. `FontWeight.w900`/`.bold` ở các heading → `w600` theo thang 400/500/600.

### 6. Param no-op của Layer 2 → ngừng truyền
`PonCard(glowColor:, glowStrength:)`, `PonButton(gradientColors:, glowColor:)`,
`PonTextField(focusColor:)` đều bị Layer 2 vô hiệu hoá và đánh dấu
`TODO(ui-redesign-L3): drop these params`. Batch này bỏ **mọi call site trong auth**. Chưa xoá được
khai báo param trong `pon_widgets.dart` vì ~70 call site ở các batch khác vẫn còn truyền — xoá
declaration là việc của pass cuối, sau khi cả 6 batch xong.

### 7. Radius
`_ThemeOptionCard` `circular(20)` → `AppTheme.radiusCard` (12). Web: 3 nút OAuth/SSO
`rounded-md` (6px) → `rounded-[10px]` (§2 rule 4: control 8–10px), khớp với OTP box đã sửa ở L3-pre.

---

## Verification

| Gate | Kết quả |
|---|---|
| `cd apps/client && flutter analyze` | **No issues found!** |
| `cd apps/client && flutter test` | **60/60 passed** |
| `pnpm --filter @platform/web build` | **PASS** — exit 0 |
| Grep Flutter auth: `Colors.white/black/amber`, `*Gradient`, `glow*`, `focusColor`, `gradientColors`, radius ≥16 | **0 hit** |
| Grep web auth: `shadow-*`, `backdrop-blur`, `gradient` | **0 hit** |

Chưa verify bằng mắt — nợ tồn từ Layer 1 (xem direction doc §3).

### Ghi chú kỹ thuật
- Việc unwrap `Stack` làm giảm indent → `dart format` reflow lại các `if (cond) return x;` trong
  validator thành 2 dòng, kéo theo 19 lint `curly_braces_in_flow_control_structures`. Đã thêm block
  `{}` cho tất cả (đúng style guide, không phải workaround).
- `dart format` trên cả directory có reformat `password_strength_indicator.dart` (file trước đó
  không format-clean). Đã revert phần format thuần, chỉ giữ thay đổi màu.

---

## Cố ý KHÔNG làm

- **Không xoá declaration của param no-op** trong `pon_widgets.dart` — xem mục 6. Phải đợi hết 6 batch.
- `password_strength_indicator.dart` giữ nguyên `Colors.red/orange/yellow/green` cho thanh strength:
  đây là màu **semantic status**, cùng loại với success green mà §2 đã tuyên bố out-of-scope.
- Web `(auth)/layout.tsx` giữ `text-primary` + `font-black` cho wordmark "PON" và logo mark: §2
  rule 2 cho phép brand mark, và Layer 2 đã chốt như vậy.
- `text-primary` trên các link (`forgotPassword`, `register`, `terms`…) giữ nguyên — §2 rule 1 cho
  phép accent trên **links**, không chỉ button.
