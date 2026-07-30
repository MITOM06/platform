# Plan: UI Redesign — Layer 3, Batch 5: Admin console

> **Ngày:** 2026-07-30 | **Trạng thái:** ✅ Done | 17 file
> **Scope:** Flutter `features/admin` (22 file); web `app/(main)/admin`, `components/admin`.
> Kèm 1 miss của batch 3 bắt được ở đây (`app/(main)/token-usage` SVG chart).
> Đọc `docs/superpowers/UI-REDESIGN-DIRECTION.md` §2 trước.

---

## Bối cảnh

Admin console **hardcode dark hoàn toàn**: 121 literal `Colors.white*`, 18 `AppTheme.darkSurface`
vô điều kiện, và **0 ternary `isDark`** — tức là chưa hề theme-aware, sẽ vỡ ở light mode y hệt
tình trạng auth ở batch 1.

Batch này chạy đúng 7 rule mà các batch trước đúc ra (§3 direction doc), grep hết ngay từ đầu thay
vì phát hiện dần.

---

## Đã làm — Flutter

### 1. Grep ưu tiên theo rule 3/5/7 trước khi sửa gì
- rule 3 (`foregroundColor|onPrimary: Colors.black`): **1 chỗ** — `departments_panel:162`, chữ đen
  trên nút burgundy (~2:1) → trắng.
- rule 5 (`required this.<color>`): **1 chỗ** — `UsageStatCard.color`, xem mục 3.
- rule 7 (tên tham số `BuildContext`): cả 45 chỗ đều tên `context` → an toàn để script.

### 2. 121 literal → token
Nhóm shade/alpha map wholesale (an toàn, theo rule 1 của 2b); `Colors.white` trơn thì gần như toàn
bộ là `style: const TextStyle(color: Colors.white)` — chữ chrome trên surface panel → `onSurface`.

Vài chỗ cần soi riêng:
- `bot_integration_panel`: khối token/code nền `Colors.black@0.35` → `scaffoldBackgroundColor`.
- `ai_settings_controls`: `SegmentedButton` có `foregroundColor: Colors.white` trong khi nền
  selected là **accent@18%** (một tint nhạt) → trắng-trên-tint-nhạt không đọc được ở light mode →
  `onSurface`.
- `admin_screen`: bỏ `backgroundColor: darkBackground` + `iconTheme` + title color — `appBarTheme`
  và `scaffoldBackgroundColor` đã lo.

### 3. `UsageStatCard.color` → flag `alert` (đúng rule 4)
Prop `required Color color`: 3/4 call site truyền `ponAccent`, 1 truyền
`thumbsDownRate >= 0.2 ? redAccent : white70`. Thay bằng `bool alert = false`;
`accent = alert ? scheme.error : scheme.primary`. Cùng hình dạng với `SettingsCard.destructive`
(batch 3) và việc xoá `AiHubTile.accent` (batch 4).

### 4. `Color(0xFF1A1A2E)` x3 → `colorScheme.surface`
**Lại là dark-indigo đã bị từ chối** (§1 decision log) — batch 3 đã gặp 3 chỗ, đây là 3 chỗ nữa.

### 5. 18 `AppTheme.darkSurface` / `darkBackground` vô điều kiện → token
`backgroundColor` của AlertDialog + `shape` → xoá hẳn (`dialogTheme` đã lo từ batch 2a);
`dropdownColor` / `tileColor` / `color` → `colorScheme.surface`. Radius 18/16 → `radiusCard`.

---

## Đã làm — Web

### 6. `StatCard.glowColor` → xoá (rule 4)
4 call site: 2 accent, **1 violet `rgba(180,127,255,…)`**, 1 đỏ — vẽ bằng radial gradient. Icon vốn
đã mang màu semantic qua `text-primary` / `text-destructive`, nên bỏ hẳn prop, hover phẳng.

### 7. Chart canvas: sửa **một bug thật**, không chỉ đổi màu
`ctx.fillStyle = 'var(--primary)'` — **canvas không resolve CSS variable**, chuỗi không hợp lệ nên
`fillStyle` giữ giá trị trước đó → **cột "output" đang vẽ màu đen**, không phải màu accent. Đã sửa:
resolve `--primary` và `--muted-foreground` qua `getComputedStyle(document.documentElement)` rồi mới
dùng. Series "input" đổi từ neon cyan sang **cùng accent ở 45% alpha** (`globalAlpha`), khớp với
`token_usage_chart.dart` mà batch 3 đã sửa. Nhãn trục `#9CA3AF` → token.

### 8. Default brand colour của workspace = neon cyan
Cả 2 platform fallback `primaryColor` của workspace về `'#00e5ff'` → **một deployment mới sẽ tự
brand mình bằng neon cyan cũ**. Đổi thành `#96435B` (đặt tên hằng số + comment ở cả 2 bên).
⚠️ Mới chỉ sửa **fallback phía client**; nếu backend cũng có default riêng thì cần kiểm thêm —
ngoài scope batch này.

### 9. Miss của batch 3: `app/(main)/token-usage` SVG line chart
Batch 3 sửa `StatCard` của trang này nhưng **bỏ sót biểu đồ SVG**: 7 chỗ `#00E5FF` (gradient stop,
polyline stroke, dot, legend, icon) + `stroke="#0a0a0a"` + `rgba(255,255,255,0.15)`. Flutter mirror
đã sửa từ batch 3 nên **2 platform đang lệch nhau**. Nay khớp lại: input = accent@45%, viền dot =
`var(--card)`, đường guide = `var(--border)`.

---

## Verification

| Gate | Kết quả |
|---|---|
| `cd apps/client && flutter analyze` | **No issues found!** |
| `cd apps/client && flutter test` | **60/60 passed** |
| `pnpm --filter @platform/web build` | **PASS** — exit 0 |
| Flutter admin: literal / gradient / darkSurface / radius / hex / no-op param | **1 / 0 / 0 / 0 / 0 / 0** (1 = trắng trên nút accent, đúng) |
| Web admin: rgba-hex / gradient / colour prop / text-white | **3 / 0 / 0 / 0** (3 = hằng số default + 2 fallback của CSS var, đều cố ý) |
| **Neon cyan `#00E5FF`/`#4FE3FF` toàn app, 2 platform** | **0** |

Diff: 17 file, **+204 / −213**. Không chạy `dart format`.

---

## Cố ý KHÔNG làm

- Backend default cho `workspace.primaryColor` — mục 8, cần kiểm riêng ở tầng service.
- `Colors.redAccent` → `colorScheme.error` (64 chỗ toàn app): vẫn thuộc **final pass**.
- Xoá declaration param no-op trong `pon_widgets.dart`: **final pass**, sau batch 6.
