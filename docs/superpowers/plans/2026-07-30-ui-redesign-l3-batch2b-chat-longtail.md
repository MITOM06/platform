# Plan: UI Redesign — Layer 3, Batch 2b: Chat core (long tail)

> **Ngày:** 2026-07-30 | **Trạng thái:** ✅ Done | 59 file
> **Scope:** `apps/client/lib/features/chat/` + `apps/web/components/chat/`.
> Tiếp nối `2026-07-30-ui-redesign-l3-batch2a-chat-structural.md`. Đọc
> `docs/superpowers/UI-REDESIGN-DIRECTION.md` §2 trước.

---

## Bối cảnh

2a xử lý nguyên nhân hệ thống (thiếu `bottomSheetTheme`/`dialogTheme`, hex accent nhân bản, accent
thứ hai, gradient). 2b làm phần **đuôi dài**: ~270 literal `Colors.white/black` hardcode trong ~53
widget chrome + 28 radius quá cỡ.

**Nguyên tắc phân loại (quan trọng nhất của batch này):** không phải mọi `Colors.white` đều sai.
- **Trắng ĐÚNG** khi nằm trên nền accent burgundy (nút gửi, badge unread, avatar bot, bubble của
  mình) hoặc trên media/nền đen (viewer, call, scrim). Quét bừa sẽ **làm hỏng** những chỗ này.
- **Trắng SAI** khi nằm trên `surface`/`scaffoldBackground` — vô hình ở light mode.

Cách tách an toàn đã dùng: **các biến thể có shade/alpha** (`white70`, `white24`,
`withValues(alpha:…)`, `black87`, `black54`…) *không bao giờ* là "trên accent" — chữ trên accent luôn
là `Colors.white` trơn. Nên map wholesale nhóm shade/alpha trước, rồi xử lý `Colors.white` trơn từng
chỗ một.

---

## Đã làm

### 1. Ternary `isDark ? X : Y` → token (37 chỗ)
Codebase có sẵn 37 ternary *đã* theme-aware nhưng dùng màu **off-palette** (§2: "warm ink, never pure
#000/#FFF"):

| Trước | Sau |
|---|---|
| `isDark ? Colors.white : Colors.black87` (16) | `colorScheme.onSurface` |
| `isDark ? Colors.white70 : Colors.black87` (7) | `colorScheme.onSurface` |
| `isDark ? white70/60/54/38 : black54/45/38` (12) | `AppTheme.mutedText(context)` |
| `isDark ? Colors.white12 : Colors.black@8%` | `AppTheme.hairline(context)` |
| `isDark ? Colors.redAccent : Colors.redAccent.shade400` | `colorScheme.error` |

Sau đó 3 biến `isDark` thành unused → xoá; 2 chỗ ternary vốn chỉ là "surface" ở cả 2 nhánh → thu về
1 token.

### 2. Nhóm shade/alpha còn lại → token (37 file)
`white70/60/54/38` → `mutedText`; `white24/12/10` → `hairline`; `white@30–70%` → `mutedText`;
`white@5–25%` → `hairline`; `black87` → `onSurface`; `black54/45/38/26` → `mutedText`;
`black@4–10%` → `hairline`.

### 3. `isDark ? AppTheme.darkSurface : Colors.white` → `colorScheme.surface` (9 file)
Rồi 7 file còn hardcode `AppTheme.darkSurface` **vô điều kiện** (composer bar, reply/edit bar,
blocked notice, stranger banner, mention list, system pill, avatar placeholder) → cũng về `surface`.
Chỉ `explore_media_screen` giữ dark (media viewer, cố ý).

### 4. Bug light-mode do chính 2a tạo ra — đã sửa
2a xoá `backgroundColor: AppTheme.darkSurface` khỏi các dialog để `dialogTheme` lo, **nhưng chữ vẫn
hardcode trắng** → 4 file có dialog trắng-trên-trắng ở light mode: `group_info_screen` (3 dialog),
`new_conversation_screen`, `ai_persona_screen`, `chat_wallpaper_dialog_view`. Sửa bằng cách **xoá**
override `style:` để Material 3 cấp `titleTextStyle`/`contentTextStyle` đúng.
→ *Bài học: khi bỏ override màu nền ở call site, phải kiểm tra màu chữ ở cùng chỗ trong cùng commit.*

### 5. Text trong bubble/AI — sửa legibility thật
- `text_content` + `file_content`: `isSentByMe ? white : white@0.9` → nhánh **incoming** giờ là
  `onSurface` (bubble incoming là `surface`, nên trắng-trên-trắng ở light mode).
- `finalized_ai_bubble` + `streaming_ai_bubble`: chữ trắng trên **accent tint** (light `#F1E4E6`) →
  `onSurface`. Typing dot trắng → accent.
- `meeting_summary_card`, `mention_list`, `pinned_messages_section`, `tool_trace_panel`,
  `message_feedback`, `kb_screen`, `chat_app_bar` (title + icon), `call_tile`,
  `conversation_info_sidebar(_parts)`, `active_call_banner`, `stranger_request_banner`,
  `incoming_group_call_prompt`, `link_preview_card`, `new_conversation_screen` → `onSurface`.

### 6. Màu off-palette còn sót → token
- **`Color(0xFF4FE3FF)` — NEON CYAN của brand cũ vẫn còn sống** trong `_SourceChip` của
  `finalized_ai_bubble` (L1 và L2 đều bỏ sót vì nó là literal cục bộ, không phải symbol) → `ponAccent`.
- `Color(0xFF1A0E3A)` + `Color(0xFF2A2040)` (tím đậm, `tool_trace_panel`) → shade step của theme.
- `Color(0x33B47FFF)` (tím, inline code trong AI bubble) → accent tint.
- `Color(0xFFE5484D)` (9 chỗ) → `AppTheme.darkDanger`; `Color(0xFF3A2A2C)` → `darkAccentTint`;
  `Color(0xFFE8B4BE)` → token mới `AppTheme.darkTintFg` (đồng thời wire vào
  `ColorScheme.onPrimaryContainer`).
- Giữ nguyên: `#FFB74D`/`#FFD54F` (amber = warning quota/sensitive) — semantic, cùng loại
  destructive/success mà §2 để ngoài scope.

### 7. Bug contrast thật (2 chỗ)
Icon **màu đen trên nền burgundy** (~2:1): `kb_screen` FAB upload và `ai_persona_screen` nút camera
→ đổi sang trắng.

### 8. Radius → thang §2 rule 4 (26 chỗ)
Card/tile 16 → `radiusCard` (12); control (composer field, search bar, explore field) 24/20 →
`radiusControl` (10); bottom sheet 24 → `radiusSheet` (18); 2 dialog bỏ hẳn override `shape` để
`dialogTheme` lo.

### 9. Parity web
Media tile Flutter về 12px, nên web `ImageContent` `rounded-lg` (8px) → `rounded-xl` (12px) để 2
platform khớp đúng (`.claude/rules/sync.md`).

---

## Verification

| Gate | Kết quả |
|---|---|
| `cd apps/client && flutter analyze` | **No issues found!** |
| `cd apps/client && flutter test` | **60/60 passed** |
| `pnpm --filter @platform/web build` | **PASS** — exit 0 |
| Radius quá cỡ trong chat | **1** (pill hàng reaction, 32 — pill có chủ đích) |
| `AppTheme.darkSurface` vô điều kiện | **3** (đều trong `explore_media_screen`, media viewer) |
| Hex neon/tím sót (`4FE3FF`/`1A0E3A`/`2A2040`/`B47FFF`/`14B8A6`) | **0** |
| Literal chrome còn lại | **32**, trong đó 11 khớp pattern on-accent/scrim/`isSentByMe`; 21 còn lại đã soi tay từng chỗ và đều nằm trên nền accent (nút gửi, badge, avatar bot, icon camera) |

### Ghi chú kỹ thuật
- **Không chạy `dart format`** (theo cảnh báo của 2a). Diff 59 file = +324/−366, không có file nào
  churn > 90 dòng → không lẫn noise format.
- Vòng sửa `const`: đổi màu literal → token làm vỡ `const`. Quy trình đã dùng: map màu → script
  quét balanced-paren xoá `const` ở constructor chứa biểu thức non-const → `flutter analyze` báo
  `prefer_const_constructors` cho các constructor lồng bên trong vẫn const-able → thêm lại. Cần cả
  2 chiều, đừng chỉ xoá.
- Một cái bẫy đã gặp: map `white@5–25%` → `hairline` là đúng cho border, **sai cho fill**. Đã phải
  sửa lại 4 chỗ (fill của hàng reaction, 2 system pill, `hintColor`/`fillColor` của composer) sang
  `surface`/`scaffoldBackgroundColor`. Batch sau nếu map theo alpha thì phải kiểm lại chỗ nào là fill.

---

## Cố ý KHÔNG làm

- **Surface dark-by-design giữ trắng** (~85 literal): `image_content`, `video_player_dialog`,
  `image_gallery_viewer`, `media_preview_strip`, `call_screen`, `group_call_screen`,
  `explore_media_screen`. Chữ/icon trắng trên media/nền đen là **đúng**.
- **Wallpaper preset** (`chat_wallpaper_*`): nội dung user tự chọn, §2 + Layer 2 đã chốt out-of-scope.
- Pill hàng reaction `circular(32)`: hình viên thuốc có chủ đích, không phải button/bubble.
- `AssistantEntry.tsx` / `AssistantPreviewAvatar.tsx` (web) + `assistant_sheen_avatar.dart` (Flutter)
  vẫn còn gradient violet→teal → **batch 4 (AI features)**, sửa cùng nhau để 2 platform không lệch.
- Presence dot `#00E676` + glow: success green, §2 out-of-scope.
- `pon_widgets.dart` vẫn khai báo param no-op (`glowColor`, `blur`, `focusColor`…): xoá declaration
  cần pass cuối sau khi cả 6 batch xong (~70 call site ngoài chat vẫn truyền).
