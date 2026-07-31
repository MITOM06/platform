# Plan: UI Redesign — L3 batch 7: hardcoded-hairline regression sweep + Messenger-style border polish

> **Ngày:** 2026-07-30 | **Scope:** Web (`apps/web`) + Flutter (`apps/client`) — cả 2 platform,
> theo `.claude/rules/sync.md`. Đọc `docs/superpowers/UI-REDESIGN-DIRECTION.md` trước, đặc biệt §2
> (palette đã LOCKED — không đổi hex `--border`/`darkBorder`/`lightBorder`) và §3 mục 6 ("Layer 3 là
> complete"). Plan này KHÔNG đổi màu — chỉ sửa call site sai quy tắc đã có sẵn + hạ alpha ở vài nơi.

---

## Bối cảnh

Owner báo UI có "đường viền màu đen xấu" phân tách các vùng trên màn hình, muốn giống Messenger
(gần như không thấy đường viền, phân vùng bằng shade nền là chính). `UI-REDESIGN-DIRECTION.md` §3
mục 6 đã tuyên bố Layer 3 hoàn tất, nhưng rà lại bằng grep cho thấy **16 call site Flutter vẫn dùng
`AppTheme.darkBorder` KHÔNG điều kiện** — tức luôn ra màu `#332B27` (gần đen) dù app đang ở light
mode. Đây đúng là loại bug mà mục 3 và mục 5 của §3 (batch Auth, batch Admin) đã từng tìm và sửa —
các file này là **regression** viết sau khi batch liên quan đã "done" (ví dụ `ai_settings_controls`,
`connector_card`, `directory_card`, `directory_admin_sheet`, `skills_screen` thuộc tính năng
Integrations/Skills — có thể được thêm sau batch 5 Admin), hoặc bị batch 2 bỏ sót vì nằm ở dạng
multi-line/field riêng mà regex không bắt được (giống lý do batch 6 tồn tại).

Quy tắc đã có sẵn trong codebase (không phải quy tắc mới): `AppTheme.hairline(context)` — theme-aware
resolver trả về `lightBorder` (`#DDD8D0`) ở light mode / `darkBorder` (`#332B27`) ở dark mode — được
`UI-REDESIGN-DIRECTION.md` dòng 162-164 ghi rõ "**use these in the remaining batches**" để screens
không bao giờ hardcode màu nữa. 16 call site dưới đây vi phạm đúng quy tắc này.

Web **không có bug tương đương** — mọi `border-b`/`border-r`/`border-t` đều để trống class màu, nên
tự động resolve qua rule toàn cục `* { border-color: var(--border) }` trong `globals.css` (đã đúng
theo palette §2). Phần việc bên web trong plan này là **polish** (Task 2), không phải bug fix.

---

## Task 1 — Flutter: xoá 16 call site `AppTheme.darkBorder` không điều kiện

**Quy tắc sửa chung:** thay `AppTheme.darkBorder` (đứng một mình, không có `isDark ? ... : ...`)
bằng `AppTheme.hairline(context)`. Nếu chỗ đó đang gọi `.withValues(alpha: X)` thì giữ nguyên alpha:
`AppTheme.hairline(context).withValues(alpha: X)`. Bảo đảm hàm `build` tại đó có `BuildContext`
tên đúng là `context` (theo lưu ý ở §3 mục 7 của direction doc) trước khi dùng.

Danh sách 16 vị trí (đã grep xác nhận KHÔNG có ternary theo `isDark` bao quanh):

1. `lib/features/chat/ui/widgets/conversation_info_sidebar.dart:64` — border dưới của
   sidebar-info panel trong chat.
2. `lib/features/chat/ui/widgets/chat_app_bar.dart:80` — border dưới của app bar trong màn hình
   chat (khả năng cao đây là "đường đen ở đầu màn hình" owner thấy).
3. `lib/features/chat/ui/widgets/mention_list.dart:36` — border trên của danh sách gợi ý @mention.
4. `lib/features/chat/ui/widgets/group_call_start_sheet.dart:165` — nhánh "không được chọn" của
   avatar chọn người gọi nhóm. **Lưu ý:** ternary ở đây là theo `selected`, không phải `isDark` —
   chỉ đổi riêng nhánh `else` từ `AppTheme.darkBorder.withValues(alpha: 0.6)` thành
   `AppTheme.hairline(context).withValues(alpha: 0.6)`, giữ nguyên nhánh `selected`.
5. `lib/features/admin/ui/admin_screen.dart:167` — màu tab-indicator khi không active. Ternary ở
   đây là theo `active`, không phải theme — chỉ đổi nhánh `else`.
6. `lib/features/admin/ui/bot_integration_panel.dart:346`
7. `lib/features/admin/ui/widgets/audit_panel.dart:98`
8. `lib/features/admin/ui/widgets/usage_dashboard_widgets.dart:216`
9. `lib/features/admin/ui/widgets/roles_panel.dart:119` — `const Divider(color: AppTheme.darkBorder, height: 1)`.
   `hairline()` cần `BuildContext` nên **không thể giữ `const`** — bỏ `const` ở constructor này.
10. `lib/features/admin/ui/widgets/workspace_panel.dart:119`
11. `lib/features/admin/ui/widgets/ai_settings_controls.dart:143` — `const BorderSide(...)`, bỏ `const`.
12. `lib/features/admin/ui/widgets/ai_settings_controls.dart:203` — `const BorderSide(...)`, bỏ `const`.
13. `lib/features/integrations/ui/widgets/directory_card.dart:144`
14. `lib/features/integrations/ui/widgets/connector_card.dart:106`
15. `lib/features/integrations/ui/widgets/directory_admin_sheet.dart:305` — `const BorderSide(...)`, bỏ `const`.
16. `lib/features/skills/ui/skills_screen.dart:179`

**KHÔNG sửa** các file sau — đã đúng quy tắc rồi (đối chiếu để không sửa nhầm lần 2):
`responsive_home_layout.dart`, `conversation_list_screen.dart`, `media_preview_strip.dart`,
`multi_select_bar.dart`, `chat_message_list.dart`, `conversation_request_tile.dart`,
`conversation_bottom_bar.dart`, `conversation_tile.dart`, `archived_chats_screen.dart`,
`blocked_conversations_screen.dart` — tất cả đã có `isDark ? AppTheme.darkBorder... : AppTheme.hairline(context)`
hoặc tương đương.

**Sau khi sửa 16 chỗ trên, chạy lại lệnh grep sau — phải ra 0 kết quả:**
```bash
cd apps/client
grep -rn "AppTheme\.darkBorder" lib --include="*.dart" | grep -v "isDark ?" | grep -v "\.withValues"
# rồi rà thủ công các dòng còn lại có .withValues() để chắc chắn mỗi dòng đều nằm trong
# nhánh isDark hoặc đã đổi sang AppTheme.hairline(context)
```

---

## Task 2 — Web: hạ alpha 3 divider cấu trúc chính cho gần với Messenger hơn

Không đổi token `--border` (đã LOCKED ở §2 — không được sửa hex). Chỉ hạ độ đậm ngay tại 3 call
site cấu trúc lớn nhất (điều khiển toàn bộ cảm giác "đường viền cứng" mà owner thấy), bằng biến thể
opacity Tailwind `/60`:

1. `apps/web/app/(main)/layout.tsx:75` — class `'w-full border-r flex-col ...'` → thêm alpha:
   `'w-full border-r border-border/60 flex-col ...'` (border-r phân cách sidebar/main).
2. `apps/web/app/(main)/layout.tsx:95` — `'h-16 border-b px-2 ...'` → `'h-16 border-b border-border/60 px-2 ...'`
   (header trong sidebar).
3. `apps/web/components/chat/ConversationHeader.tsx:147` — `'h-14 border-b px-4 ...'` →
   `'h-14 border-b border-border/60 px-4 ...'` (header cửa sổ chat — cặp song song với
   `chat_app_bar.dart` đã sửa ở Task 1).

Không đổi `apps/web/components/chat/ConversationList.tsx:226` — border ở đây chỉ xuất hiện trên
mobile (`border-t md:border-t-0`), tách biệt panel cross-fade giữa list/thread trên 1 màn hình nhỏ,
giữ nguyên để không mất điểm neo thị giác khi cuộn.

**Đối xứng bên Flutter cho đúng 2 vị trí tương ứng (`chat_app_bar.dart`, sidebar chat info)** — vì
Task 1 mục 1–2 đã đổi 2 file này sang `AppTheme.hairline(context)` (alpha mặc định = 1.0/full), hạ
xuống cùng mức bằng cách thêm `.withValues(alpha: 0.6)` sau `AppTheme.hairline(context)` ở đúng 2
điểm đó, để 2 platform nhìn giống nhau (theo `.claude/rules/sync.md`).

---

## Verification (bắt buộc trước khi báo done)

```bash
cd apps/client && flutter analyze                 # phải "No issues found!"
cd apps/web && pnpm build                          # phải PASS, 0 error
```
Rồi chạy lại grep ở cuối Task 1 (phải 0 kết quả) và chụp lại 2 màn hình owner đã gửi (sidebar chat
list + chat header) ở **light mode** trên cả web và mobile để so sánh trước/sau.

---

## Ghi log sau khi xong

Thêm 1 dòng vào `docs/superpowers/UI-REDESIGN-DIRECTION.md` §3, theo đúng format các mục 1–6 hiện
có (`~~Tên batch~~ ✅ done — plan/...md. <mô tả ngắn root cause + số call site đã sửa>`), đánh số
mục **7**, để lần sau không ai tưởng nhầm Layer 3 vẫn còn "complete" nguyên trạng như mục 6 đã ghi.
