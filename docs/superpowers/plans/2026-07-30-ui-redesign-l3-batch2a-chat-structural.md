# Plan: UI Redesign — Layer 3, Batch 2a: Chat core (structural + high-traffic surfaces)

> **Ngày:** 2026-07-30 | **Trạng thái:** ✅ Done | 26 file
> **Scope:** `apps/client/lib/features/chat/` + `apps/web/components/chat/`.
> Đọc `docs/superpowers/UI-REDESIGN-DIRECTION.md` §2 trước.

---

## Vì sao batch 2 bị chia thành 2a / 2b

Direction doc §3 dự tính "Chat core = 13 screen". Thực tế khi khảo sát:
`apps/client/lib/features/chat` có **79 file UI**, **297 `Colors.white` + 91 `Colors.black`**,
36 radius quá cỡ. Làm hết trong một lượt chính là cái bẫy "đọc hết codebase, cháy context" mà
§3 dựng ra để tránh.

Nên batch 2 chia theo **loại vấn đề**, không theo số file:
- **2a (plan này)** — nguyên nhân *hệ thống* + các surface lưu lượng cao: thiếu theme cho
  sheet/dialog, hex accent bị nhân bản, accent thứ hai, gradient, `MessageBubble`,
  `ConversationListScreen`. Sửa một chỗ là hàng chục call site tự khỏi.
- **2b (chưa viết)** — phần đuôi dài: ~180 literal màu còn lại trong ~30 widget chrome, 28 radius.
  Cơ khí, ít rủi ro, nhưng nhiều file.

---

## Đã làm — nguyên nhân hệ thống

### 1. Theme thiếu `bottomSheetTheme` + `dialogTheme` → thêm vào (leverage cao nhất)
**Đây là lý do gốc** khiến ~25 call site tự hardcode `backgroundColor: AppTheme.darkSurface` +
radius 24: theme không hề khai báo màu cho bottom sheet / dialog, nên mỗi call site phải tự lo, và
tất cả đều chọn màu **dark** → sheet/dialog hiện ra tối om giữa light mode.

Đã thêm `bottomSheetTheme` (surface + top radius `radiusSheet` 18) và `dialogTheme`
(surface + `radiusCard` 12 + hairline border) cho **cả** `darkTheme` và `lightTheme`, rồi **xoá**
override ở 9 file. Sửa bằng cách *bớt* code, không thêm.

### 2. Hex của accent bị nhân bản 31 chỗ → dùng token
`Color(0xFF96435B)` (đúng giá trị `AppTheme.ponAccent`) được viết tay ở **31 chỗ** — nợ của Layer 2:
khi collapse 3 màu neon thành 1, một số call site nhận literal thay vì symbol. Đã đổi hết chỗ trong
`features/chat` sang `AppTheme.ponAccent`. Còn `features/settings` (3) và `features/assistant` (1)
thuộc batch 3/4 — cố ý chưa đụng để giữ ranh giới batch.

### 3. Accent thứ hai (teal `#14B8A6`) → xoá, cả 2 platform
Avatar của external bot (Bot Factory) dùng gradient **violet→teal**:
- Flutter `ai_message_parts.dart` `_ExternalBotAvatar` → flat `ponAccent`.
- Web `ExternalBotBubble.tsx` `bg-gradient-to-br from-violet-500 to-teal-400` → `bg-primary`.
- Tên bot cũng đang tô teal → `AppTheme.mutedText(context)`.

Vừa là gradient (rule 2) vừa là accent thứ hai (rule 1). Docstring "violet→teal gradient" ở cả 2
file đã sửa theo.

### 4. Gradient chrome còn lại → flat
| Chỗ | Trước | Sau |
|---|---|---|
| `MessageBubble` bubble của mình | `LinearGradient([accent, accent])` | flat `ponAccent` |
| Avatar bot (3 file) | `LinearGradient([#7A2E3A, #3A2A2C])` | flat `ponAccent` |
| `ConversationAvatar` | `LinearGradient(colors)` | flat (mọi caller đều truyền cặp accent-only) |
| Wordmark "PON" | `ShaderMask` + `[accent, accent]` | `Text` màu accent, `w900`→`w600` |

### 5. Aura orb accent trong `ConversationListScreen` → xoá
Lại một orb `RadialGradient` accent nữa mà Layer 2 báo đã dọn (giống hệt tình trạng của batch 1).

### 6. `MessageBubble` — các state AI hardcode dark → token
Bubble có 4 màu nền hardcode dark (`#3D1515` error, `#3D2800` quota, `#3A2A2C` AI,
`darkSurface@0.7` incoming) → derive từ token: `colorScheme.error@14%`, amber@16%,
accent-tint theo brightness, `colorScheme.surface`. Border `darkBorder@0.4` → `hairline(context)`.
Đồng thời gộp `gradient:`+`color:` thành **một** `color:` (hai nhánh vốn bù trừ nhau).

### 7. `ExternalBotBubble` (Flutter) — bubble radius 20 → 14/4
Rule 5 yêu cầu bubble bất đối xứng 14/4. Bubble này vẫn còn 20 — L2/L3-pre bỏ sót.

### 8. Web: `text-white` trên nền accent → `text-primary-foreground`
4 avatar (`ActiveFriendsRow`, `GroupSettingsDrawer`, `group/NicknamesModal`,
`group/SettingsHeader`). Trong dark mode `primary-foreground` là `#F3EEE8` chứ không phải trắng.

---

## Verification

| Gate | Kết quả |
|---|---|
| `cd apps/client && flutter analyze` | **No issues found!** |
| `cd apps/client && flutter test` | **60/60 passed** |
| `pnpm --filter @platform/web build` | **PASS** — exit 0 |
| `Color(0xFF96435B)` trong `features/chat` | **0** |
| Teal `#14B8A6` trong chat (2 platform) | **0** |
| Gradient chrome trong chat | **0** (chỉ còn wallpaper preset — cố ý) |

### Ghi chú kỹ thuật quan trọng
**Không chạy `dart format` lên `lib/features/chat`.** Toàn bộ directory này *chưa* format-clean từ
trước (đã kiểm: 9/9 file thử đều UNCLEAN), nên `dart format` tạo ra hàng trăm dòng noise trộn lẫn
vào diff redesign — lần đầu chạy đã làm bẩn 78 file và phải revert. Batch 2b nên **chỉ sửa semantic,
không format**. (Nếu muốn format cả repo thì làm thành 1 commit riêng, độc lập.)

---

## Cố ý KHÔNG làm (→ batch 2b)

- **~180 literal `Colors.white/black` còn lại trong ~30 widget chrome.** Top file:
  `conversation_tile` (17), `floating_reaction_sheet` (15), `chat_input_bar` (12),
  `chat_app_bar` (11), `archived_chats_screen` (10), `chats_tab` (9), `group_info_screen` (9),
  `chat_screen_helpers` (9).
- **28 radius ≥16** còn lại trong widget per-screen.
- **Surface dark-by-design giữ nguyên màu trắng** (~85 literal): `image_content`,
  `video_player_dialog`, `image_gallery_viewer`, `media_preview_strip`, `call_screen`,
  `group_call_screen`, `explore_media_screen`. Chữ/icon trắng trên media/nền đen là **đúng**, đừng
  đổi sang `onSurface`.
- **Wallpaper preset gradient** (6 chỗ, `chat_wallpaper_*`): nội dung user tự chọn, §2 + Layer 2 đã
  chốt out-of-scope.
- `AssistantEntry.tsx` + `assistant/AssistantPreviewAvatar.tsx` (web) và
  `assistant_sheen_avatar.dart` (Flutter) vẫn còn gradient violet→teal — mirror của nhau và đều
  thuộc **batch 4 (AI features)**; sửa cùng nhau ở đó để 2 platform không lệch.
- Presence dot `#00E676` + glow: success green, §2 out-of-scope.
