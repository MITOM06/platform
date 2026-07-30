# Plan: UI Redesign — Layer 3, Batch 4: AI features

> **Ngày:** 2026-07-30 | **Trạng thái:** ✅ Done | 15 file
> **Scope:** Flutter `features/ai_context|ai_hub|assistant`; web
> `app/(main)/ai-context|ai-hub|ai-persona|ai-memory|assistant`, `components/ai`,
> `components/chat/AssistantEntry.tsx`, `components/chat/assistant/`.
> Đọc `docs/superpowers/UI-REDESIGN-DIRECTION.md` §2 trước.

---

## Bối cảnh

Batch nhỏ nhất tới giờ (15 file, +58/−69) vì `ai_context` được viết **sau** thời neon nên đã dùng
token sẵn — nó gần như chỉ còn vài chỗ `Colors.grey`.

Batch này dọn 3 món nợ đã được ghi nhận từ batch 2a/3 (violet trong `ai-hub`, gradient violet→teal
của assistant avatar trên cả 2 platform) **và** phát hiện một lỗ hổng trong cách grep của các batch
trước — xem mục "Lỗ hổng grep" cuối file.

---

## Đã làm

### 1. Per-item colour prop → xoá (cả 2 platform, cùng lúc)
Đúng bài học batch 3 (rule 4 trong direction doc): lỗi nằm ở **API**.
- Flutter `AiHubTile` có `required Color accent` — cả 4 call site đều truyền `AppTheme.ponAccent`,
  tức prop hoàn toàn vô dụng → xoá, icon dùng `colorScheme.primary`.
- Web `AiHubCard` có `iconBg: string` — 4 call site, **2 trong đó truyền violet
  `rgba(180,127,255,…)`** = accent thứ hai → xoá prop, icon chip dùng `bg-primary/10`.
- Web `AiHubCard` bỏ luôn lớp hover overlay `bg-accent/60` tuyệt đối → hover phẳng `hover:bg-accent`.

Không có case `destructive` ở đây (khác `SettingsCard` của batch 3), nên xoá thẳng chứ không thay
bằng flag.

### 2. Assistant avatar: gradient violet→teal → flat accent (3 file, 2 platform)
`assistant_sheen_avatar.dart` (Flutter), `AssistantEntry.tsx` + `AssistantPreviewAvatar.tsx` (web)
đều dùng `[#96435B, #14B8A6]` / `from-violet-500 to-teal-400` — vừa gradient (rule 2) vừa accent thứ
hai (rule 1) → `AppTheme.ponAccent` / `bg-primary`, chữ dùng `onPrimary`/`text-primary-foreground`.

**GIỮ LẠI hiệu ứng sheen.** Docstring gọi nó là "the ONE signature ambient sheen sweep — the single
bold motion in the app", và Layer 2 đã chốt "motion tokens kept". Sheen là **hiệu ứng ánh sáng**
(shader trắng quét chéo), không phải gradient thương hiệu — nên carve-out của Layer 2 áp dụng. CSS
`.pon-sheen` bên web cũng dùng `rgba(255,255,255,.45)`, khớp với Flutter. Chỉ nền bên dưới bị làm
phẳng; docstring 2 bên đã sửa cho khỏi nói sai.

### 3. `ai_hub_screen` + `ai_hub_tile`
Gradient `[accent, accent]` thoái hoá → flat; `Colors.white` (tiêu đề hero) → `onSurface`;
`Colors.white@0.6` → `mutedText`; radius 24/18 → `AppTheme.radiusCard`; bỏ `glowColor`/`glowStrength`.
Giữ icon trắng trên vòng tròn accent — đúng.

### 4. Web `ai-persona`: `bg-primary text-white` → `text-primary-foreground` (4 chỗ)

---

## Lỗ hổng grep của các batch trước — và những gì nó che mất

Suốt batch 1→3 tôi chỉ grep `Colors\.(white|black)`. **Bảng màu Material còn hàng chục màu khác** mà
pattern đó không bắt được. Khi mở `ai_context` ra mới thấy nó dùng `Colors.grey`, và grep lại toàn app
cho ra ~106 chỗ dùng màu Material ngoài white/black.

Đã sửa những chỗ **ngoài palette thật sự** (kể cả chỗ thuộc batch trước — ghi rõ để không giả vờ là
mới phát hiện trong scope):
| Chỗ | Batch lẽ ra thuộc về | Trước → Sau |
|---|---|---|
| `edit_profile_screen` dropdown giới tính | **batch 3 (miss)** | `Colors.blue`/`pink`/`purple` (3 sắc trang trí trong 1 form, phá rule 1) → `mutedText`; glyph icon đã đủ phân biệt |
| `conversation_tile` border | **batch 2 (miss)** | `Colors.grey.shade400/300` → `hairline` |
| `explore_screen` text | **batch 2 (miss)** | `Colors.grey` → `mutedText` |
| `ai_context` x4 | batch 4 | `Colors.grey` → `mutedText`, `Colors.redAccent` → `colorScheme.error` |

**Sau khi sửa: 0 màu Material trang trí ngoài palette.** 89 chỗ còn lại đều **semantic** và cố ý giữ:
`redAccent`/`red` (64+15, destructive), `green` (5, success/online), `amber`/`orange`/`yellow` (9,
warning), `grey.shade900` (1, nền media trong `call_screen`).

---

## Verification

| Gate | Kết quả |
|---|---|
| `cd apps/client && flutter analyze` | **No issues found!** |
| `cd apps/client && flutter test` | **60/60 passed** |
| `pnpm --filter @platform/web build` | **PASS** — exit 0 |
| Violet/teal trong AI (2 platform) | **0** |
| Gradient / radius quá cỡ / no-op param trong scope | **0 / 0 / 0** |
| `Colors.white/black` còn trong scope | 7 — đều là chữ/icon trên accent, cộng shader của sheen |
| Màu Material trang trí ngoài palette, **toàn app** | **0** |

Diff: 15 file, **+58 / −69**. Không chạy `dart format`.

### Ghi chú kỹ thuật
`IdentitySection` có **field tên `context`** (kiểu `AiUserContext`) còn `BuildContext` thì đặt tên
`ctx` → `AppTheme.mutedText(context)` compile fail vì truyền sai kiểu. Đổi thành `mutedText(ctx)`.
Batch sau nếu chèn `mutedText(context)` bằng script thì phải kiểm tên tham số `build(BuildContext …)`
của từng file, đừng giả định luôn là `context`.

---

## Cố ý KHÔNG làm

- **`Colors.redAccent` → `colorScheme.error` (79 chỗ toàn app)**: `redAccent` là `#FF5252`, còn
  `lightDanger` của palette là `#B3261E` — nên về nguyên tắc destructive ở light mode đang hơi chói
  so với palette. Đây là **1 sweep riêng, toàn app**, không thuộc scope batch nào; nên làm ở pass
  cuối cùng cùng lúc với việc xoá declaration param no-op. Đã ghi vào `plans/README.md`.
- `components/admin/usage-dashboard.tsx` còn `glowColor="rgba(180,127,255,…)"` → **batch 5 (admin)**.
- Sheen motion (Flutter + CSS `.pon-sheen`): giữ, xem mục 2.
- Amber/green/red semantic: giữ, cùng carve-out §2.
