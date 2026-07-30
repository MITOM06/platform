# Plan: UI Redesign — Layer 3, Batch 6: Remainder

> **Ngày:** 2026-07-30 | **Trạng thái:** ✅ Done | 15 file
> **Scope:** Flutter `features/friends|reminders|help|integrations|skills|notifications|home`.
> Web phần này đã sạch sẵn từ Layer 2 (verify lại: 0 hit rgba/hex/gradient/shadow/blur/text-white).
> Batch cuối của Layer 3. Đọc `docs/superpowers/UI-REDESIGN-DIRECTION.md` §2 trước.

---

## Bối cảnh

Chạy 7 rule của direction doc §3 làm grep ưu tiên **trước khi sửa gì**. Kết quả sạch bất ngờ:
- rule 3 (`foregroundColor|onPrimary: Colors.black`): **0**
- rule 5 (`required this.<color>`): **0**
- rule 6 (Material palette): chỉ `red`/`redAccent`/`amber` — **đều semantic**, giữ nguyên
- rule 7: cả 42 chỗ `BuildContext` đều tên `context` → script an toàn
- hex ngoài palette: **0**

Nên batch này thuần cơ khí: literal → token, bỏ param no-op, dọn orb, chuẩn hoá radius.

---

## Đã làm

### 1. Param no-op của Layer 2 → bỏ ở call site (18 chỗ, 7 file)
`glowColor` / `glowStrength` / `focusColor`. **Quan trọng: đây là xoá dead code, không đổi hình
ảnh** — `PonCard` đã bỏ qua các param này từ Layer 2, nên phần glow *vốn đã không còn được vẽ*.
Kể cả `connector_card`/`directory_card` truyền `glowColor: connected ? onlineGreen : ponAccent`
(trông có vẻ semantic) cũng không mất thông tin gì, vì màu đó chưa từng hiển thị sau Layer 2.

### 2. `FaqItemTile.glowColor` + mảng `_glowColors` → xoá (rule 4)
`help_screen` giữ `static const _glowColors = [ponAccent, ponAccent, ponAccent]` rồi
`_glowColors[index % length]` — một "bảng màu luân phiên" mà Layer 2 đã collapse thành 3 lần cùng
một màu, tức hoàn toàn vô nghĩa. Xoá cả mảng lẫn prop; `accent = colorScheme.primary`.

### 3. Aura orb accent → xoá (2 chỗ, `help_screen`)
**Lần thứ 5** trong program tìm thấy orb mà Layer 2 báo đã dọn hết (auth → conversation list →
settings+legal → help). Sau khi xoá, `if (isDark) ...[]` thành spread rỗng → dọn luôn.

### 4. 74 literal → token
Ternary `isDark ? X : Y` + nhóm shade/alpha map wholesale; `Colors.white` trơn hầu hết là
`TextStyle(color: Colors.white)` chrome → `onSurface`. `iconTheme: IconThemeData(color: white)` trên
AppBar → xoá (đã có `appBarTheme`).

Hai chỗ cần soi riêng theo rule 2 (fill ≠ border):
- `notification_panel` header row `isDark ? white@3% : black@3%` là **fill** → `scaffoldBackgroundColor`.
- `custom_mcp_sheet` list tool `white@75%` — alpha 0.75 nằm ngoài dải regex nên sót, phải sửa tay.

### 5. 15 `darkSurface`/`darkBackground` → token
`backgroundColor` + `shape` của bottom sheet/dialog xoá hẳn (`bottomSheetTheme`/`dialogTheme` đã lo
từ batch 2a); `dropdownColor`/`color` → `colorScheme.surface`.

### 6. Radius → thang §2 rule 4
Field tìm kiếm help 16 → `radiusControl`; card 16 → `radiusCard`; sheet 20 → `radiusSheet`.
**Giữ pill có chủ đích**: `circular(999)` ở `connector_card` và badge số điện thoại
`circular(20)` ở `friend_search_tab` — pill là hình dạng cố ý, không phải button/bubble.

### 7. `connector_card._initials()` — helper không có `BuildContext`
Chèn `AppTheme.mutedText(context)` vào đây thì compile fail. Đã thêm tham số
`BuildContext context` và truyền từ 2 call site. (Biến thể của rule 7: không chỉ *tên* tham số,
mà có helper **không hề có** context.)

---

## Verification

| Gate | Kết quả |
|---|---|
| `cd apps/client && flutter analyze` | **No issues found!** |
| `cd apps/client && flutter test` | **60/60 passed** |
| `pnpm --filter @platform/web build` | **PASS** — exit 0 |
| Literal / gradient / darkSurface / no-op param trong scope | **2 / 0 / 0 / 0** |
| Radius quá cỡ | 2 — đều là pill cố ý (`999`, badge `20`) |

2 literal còn lại: `foregroundColor: Colors.white` trên nút accent (đúng) và... đã sửa nốt chỗ 0.75.
Diff: 15 file, **+106 / −189**. Không chạy `dart format`.

---

## Layer 3 đã xong — còn lại đúng 1 việc: **final pass**

Batch 6 là batch cuối. Nhưng khi grep toàn app để chuẩn bị xoá declaration param no-op, phát hiện
**17 call site vẫn còn truyền, tất cả nằm trong `features/chat`** — batch 2 bỏ sót vì chúng ở dạng
**nhiều dòng / có điều kiện** (`gradientColors: isDark ? [...] : [...]`), không khớp regex 1 dòng mà
batch 2 dùng. Đây là lý do final pass phải làm sau cùng và phải quét lại toàn app, không tin batch nào.

Final pass gồm:
- (a) dọn nốt 17 call site đó rồi **xoá declaration** `glowColor`/`glowStrength`/`blur`/
  `borderOpacity`/`bgOpacity`/`focusColor`/`gradientColors` trong `pon_widgets.dart`;
- (b) sweep `Colors.redAccent` → `colorScheme.error` toàn app (64 chỗ);
- (c) kiểm default `workspace.primaryColor` phía **backend** (batch 5 mới sửa fallback client).
