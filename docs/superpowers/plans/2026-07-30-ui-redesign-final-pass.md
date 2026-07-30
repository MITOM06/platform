# Plan: UI Redesign — Final pass (app-wide)

> **Ngày:** 2026-07-30 | **Trạng thái:** ✅ Done | 50 file
> **Scope:** toàn app + `auth-service`. Đây là pass **cuối cùng** của chương trình redesign.
> Đọc `docs/superpowers/UI-REDESIGN-DIRECTION.md` §2 trước.

---

## Bối cảnh

3 việc không thuộc batch nào vì chúng **cross-cutting**, phải làm sau khi cả 6 batch xong:

| | Việc | Vì sao phải đợi |
|---|---|---|
| (a) | Xoá declaration param no-op trong `pon_widgets.dart` | Không xoá được khi còn call site truyền vào |
| (b) | Sweep `Colors.redAccent` → `colorScheme.error` | Trải khắp 45 file, không thuộc feature nào |
| (c) | Kiểm default `workspace.primaryColor` phía backend | Batch 5 mới sửa fallback client |

---

## (a) Nợ kỹ thuật của Layer 2 — trả xong

Layer 2 vô hiệu hoá `blur`/`borderOpacity`/`bgOpacity`/`glowColor`/`glowStrength` của `PonCard`,
`gradientColors`/`glowColor` của `PonButton`, `focusColor` của `PonTextField`, nhưng **giữ lại
declaration** để ~70 call site còn compile, kèm `TODO(ui-redesign-L3)`.

Batch 1→6 đã dọn dần call site, nhưng khi grep lại toàn app vẫn còn **17 chỗ, tất cả trong
`features/chat`** — batch 2 bỏ sót vì chúng ở dạng **nhiều dòng / có điều kiện**:
```dart
gradientColors: isDark
    ? const [AppTheme.ponAccent, AppTheme.ponAccent]
    : [Theme.of(context).colorScheme.primary, ...],
```
Regex 1 dòng của batch 2 không khớp. Đã dọn nốt bằng bộ đếm ngoặc cân bằng, rồi **xoá hẳn 12
declaration**. `PonCard` giờ chỉ còn `child` + `borderRadius`; `PonButton` chỉ còn
`onPressed`/`child`/`isLoading`; `PonTextField` bỏ `focusColor`.

Đồng thời retire `ConversationAvatar.gradientColors` — compat shim mà batch 2a để lại kèm
`TODO(ui-redesign-L3-final)` (chính pass này) — thay bằng `colorScheme.primary` trực tiếp.

⚠️ **Một lỗi tôi tự gây ra trong lúc dọn:** chạy regex 1 dòng *trước* bộ xử lý nhiều dòng, nên nó
cắt `gradientColors: const [AppTheme.ponAccent,` tại dấu phẩy **bên trong list**, để lại rác
` AppTheme.ponAccent],` ở 2 chỗ. `flutter analyze` bắt ngay (6 lỗi syntax). Đã sửa tay + quét lại
toàn app xác nhận không còn mảnh vỡ nào. **Bài học: nếu có cả 2 dạng, chỉ chạy bộ ngoặc-cân-bằng,
đừng chạy regex 1 dòng trước.**

## (b) `Colors.redAccent` → `colorScheme.error` (64 chỗ, 45 file)

`redAccent` là `#FF5252`; destructive light của palette là `#B3261E`. Nên trước pass này mọi nút
xoá/chặn/rời nhóm ở **light mode đều chói hơn bảng màu**. Tất cả 64 chỗ đều đúng nghĩa destructive
/ error (xoá, chặn, rời nhóm, lỗi, offline banner, nút cúp máy) nên `colorScheme.error` là token
đúng — dark vẫn ra `#E5484D` (cùng họ), light về `#B3261E`.

35/64 nằm trong `const` context → phải de-const rồi analyze lại. 0 lỗi sau khi xong.

## (c) Backend — và một thứ ngoài dự kiến

- `workspace.schema.ts`: `primaryColor?: string` **không có default** → DB sạch, fallback client mà
  batch 5 sửa đúng là nguồn duy nhất. ✅
- `workspace.dto.ts`: Swagger `example: '#00e5ff'` → `'#96435B'` (chỉ là doc, nhưng vẫn là brand cũ).
- **Ngoài dự kiến:** `auth.service.ts` phục vụ một **trang HTML thật cho người dùng** — trang
  redirect deeplink sau OAuth — và nó **vẫn nguyên brand neon**: nền `#0f0f0f`, nút `#00e5ff`, chữ
  đen trên cyan, radius 8px. Trang này do auth-service render nên nằm **ngoài theming của cả 2 app**,
  không batch nào chạm tới. Đã đổi sang palette: nền `#1A1614`, chữ `#F3EEE8`, nút `#96435B` chữ
  trắng, muted `#B0A79C`, radius 10px.

---

## Verification

| Gate | Kết quả |
|---|---|
| `cd apps/client && flutter analyze` | **No issues found!** |
| `cd apps/client && flutter test` | **60/60 passed** |
| `pnpm --filter @platform/web build` | **PASS** — exit 0 |
| `pnpm --filter @platform/auth-service build` | **PASS** — webpack compiled successfully |

### Audit toàn chương trình (sau pass này)

| Kiểm | Kết quả |
|---|---|
| Param no-op (call site + declaration) | **0** |
| `Colors.redAccent` | **0** |
| Hex neon cũ (cyan/peach/pink `6AC9FF`/`FBB68B`/`FF85B3`/`00E5FF`/`4FE3FF`) | **0** |
| Dark-indigo bị từ chối `#1A1A2E` | **0** |
| Hex accent viết tay (`0xFF96435B` ngoài `app_theme.dart`) | **0** |
| Màu Material trang trí | **1** — `call_screen` `grey.shade900`, nền video, dark-by-design |
| `00e5ff` trong backend/web/flutter | **0** |

Diff: 50 file, **+107 / −174**. Không chạy `dart format`.

---

## Chương trình redesign đã xong. Còn lại KHÔNG phải việc code

**Chưa có ai xác nhận bằng mắt.** Toàn bộ 11 commit được verify bằng `flutter analyze`,
`flutter test`, web build, auth-service build, và tính contrast bằng số. Những thứ đó bắt được lỗi
compile và lỗi tương phản — **không** bắt được "trông xấu", "layout lệch", "spacing sai".

Owner đã nhận phần E2E test. Nếu QA phát hiện gì, sửa như bug bình thường; §2 vẫn là source of truth
cho mọi quyết định màu/radius/elevation.

### Nếu muốn đi tiếp (không bắt buộc, chưa ai yêu cầu)
- `password_strength_indicator` hiện trộn `colorScheme.error` (weak) với `Colors.orange/yellow/green`
  (medium→strong). Thang này là semantic nên §2 để ngoài scope, nhưng nếu muốn thống nhất thì nên
  định nghĩa hẳn một thang token riêng thay vì màu Material thô.
- Radius pill cố ý giữ: `circular(999)` (`connector_card`), badge số điện thoại `circular(20)`,
  hàng reaction `circular(32)`.
