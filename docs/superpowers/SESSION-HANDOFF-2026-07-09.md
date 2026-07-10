# Session Handoff — 2026-07-09

> Đọc file này khi bắt đầu session mới để tiếp tục đúng 100% context.

---

## 1. QUY TẮC LÀM VIỆC (BẮT BUỘC)

### Cowork (Claude trong chat) = Advisor Only
- **KHÔNG bao giờ sửa code trực tiếp** — chỉ viết plan `.md` vào `docs/superpowers/plans/`
- **Claude Code** = người thực thi. Nó đọc plan và thực hiện thay đổi code.
- `bot-factory` repo (`/Users/phong/projects/personal/bot-factory`) = **READ-ONLY** từ phía PON.
- Tất cả thay đổi đều trong repo `platform` (`/Users/phong/projects/personal/platform`).

### Ngôn ngữ
- Giao tiếp **tiếng Việt**, giữ nguyên thuật ngữ kỹ thuật tiếng Anh.

### Quy tắc tự trị (CLAUDE.md)
- **Autonomous mode**: tự phân tích, lên plan, thực thi — không hỏi giữa chừng.
- **Hard Stop** (bắt buộc hỏi): task mơ hồ 2+ hướng, break backward compat, thiếu secret, xóa data production, chọn giữa 2 kiến trúc trade-off khác nhau.

---

## 2. PROJECT CONTEXT

### PON Platform
- **Auth service**: NestJS :3001
- **Chat service**: Spring Boot 3 :8080 (MongoDB `platform`, port **27018**)
- **AI service**: NestJS :3002
- **Connector service**: NestJS :3003
- **Flutter client**: `apps/client/`
- **Next.js web**: `apps/web/`
- **Infra**: `docker compose -f infra/docker-compose/compose.yml up -d`

### Bot Factory Bridge
- Phase 1 (server-side) ✅ DONE (PR #81 merged)
- Phase 2 = client UI — plan: `docs/superpowers/plans/2026-06-25-personal-assistant-client-ui.md`
- Direction: `docs/superpowers/BOTFACTORY-BRIDGE-DIRECTION.md`

---

## 3. TẤT CẢ PLAN ĐÃ VIẾT + TRẠNG THÁI

> **CẬP NHẬT 2026-07-09 (session sau):** Toàn bộ danh sách "PENDING" bên dưới đã được verify lại
> bằng `git show` + `grep` trực tiếp trên code — **tất cả 8 plan đều đã có code trên branch hiện tại**,
> không còn plan nào thực sự pending. Danh sách gốc dưới đây được giữ nguyên cho lịch sử; xem
> `docs/superpowers/plans/README.md` mục "2026-07-08 / 2026-07-09 batch" để biết plan nào verify ở
> commit nào. **Chưa verify:** build/test thật sự (`pnpm build`, `flutter analyze`, `mvn compile`)
> trong session này, và services đang chạy (dev/prod) đã restart để pick up code mới chưa.

### ✅ WEB DONE (Claude Code đã làm xong web, Flutter còn pending)
| Plan | Nội dung | Trạng thái |
|------|----------|------------|
| `2026-07-09-upload-preview-and-multiselect.md` | Upload preview strip + multi-select messages | Web ✅ / Flutter ✅ (`698cc0bd`) |

### ✅ ĐÃ CÓ CODE (trước đây ghi PENDING — nhầm, xem cập nhật ở trên)
| Plan | Nội dung | Commit |
|------|----------|--------|
| `2026-07-07-auth-archived-mobile-fixes.md` | Auth + archived fixes mobile | `92002b13` |
| `2026-07-07-bot-ux-and-input-fixes.md` | Bot UX + input fixes | `121dd957` |
| `2026-07-07-block-ux-fixes.md` | Block UX fixes | `c1cedc67` |
| `2026-07-08-connector-logos-and-new-skills.md` | **MCP Directory logos** (Asana/GitHub/Notion... dùng CDN logo thật thay monogram) | `b0d8b852` (ConnectorCard) + `228eb28f` (DirectoryCard) |
| `2026-07-08-memory-extraction-fix.md` | Memory extraction threshold + `/memory`/`/ai-memory` slash command fix | trong `ai.service.ts`/`configuration.ts` hiện tại |
| `2026-07-08-ui-polish-5-issues.md` | 5 UI issues (DirectoryCard logos, offline time, own avatar green dot web, Token Usage redesign, mobile app icon) | `228eb28f` |
| `2026-07-09-video-hd-greendhot-fixes.md` | Video inline player + HD global toggle + own avatar green dot | `a6655116` |
| `2026-07-09-settings-mobile-fixes.md` | Legal screen crash + Profile flow + Cover photo preview + Save button + Token date range | `a6655116` |

---

## 4. CHI TIẾT CÁC ISSUE & CODE ĐÃ RESEARCH

### 4.1 MCP Directory Logos (web)
- File: `apps/web/app/(main)/directory/page.tsx` và component `DirectoryCard.tsx`
- Hiện tại: hiển thị monogram letter (A, G, N...)
- Fix: dùng CDN logo URLs. Mapping đã define trong plan `2026-07-08-connector-logos-and-new-skills.md`
- Screenshot user gửi xác nhận vẫn chưa fix

### 4.2 Legal Screen Crash (Flutter)
- File: `apps/client/lib/core/router/app_router.dart`
- **Root cause**: `/legal` trong `_publicRoutes`. Redirect logic: `if (isAuth && onPublic) return '/'` → authenticated user bị redirect về home khi vào `/legal`
- **Fix**: tách `_publicRoutes` → `_guestOnlyRoutes` (login/register/verify-otp/forgot-password/new-password) + `_alwaysPublicRoutes` (/legal). Chỉ redirect từ `_guestOnlyRoutes`, không redirect từ `/legal`.
- Chi tiết: `docs/superpowers/plans/2026-07-09-settings-mobile-fixes.md` Fix 1

### 4.3 Own Avatar Green Dot
**Web** — `apps/web/app/(main)/settings/page.tsx` line 207:
```tsx
<div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-online-green border-2 border-background" />
```
→ Xóa dòng này. (Đã có trong plan `2026-07-08-ui-polish-5-issues.md`)

**Flutter** — Chưa xác định được chính xác source. Hướng investigate:
- `apps/client/lib/features/chat/ui/widgets/active_friends_row.dart` — có thể own user lọt vào friend list với `online: true`
- Tìm `grep -rn "onlineGreen\|online: true" lib/` để xác định

### 4.4 HD Toggle (global thay vì per-image)

**Web:**
- `apps/web/components/chat/MediaPreviewStrip.tsx` — hiện có per-image HD button
- `apps/web/lib/hooks/use-staged-attachments.ts` — expose `toggleHD` per-item
- `apps/web/components/chat/MessageInput.tsx` line 71 — dùng `{ pendingAttachments, stageImages, stageFile, removeAttachment, toggleHD, flushAttachments }`
- Fix: xóa `isHD` khỏi `PendingAttachment` interface, thêm `isAllHD: boolean` state ở `MessageInput`, 1 nút global ở header của `MediaPreviewStrip`

**Flutter:**
- `apps/client/lib/features/chat/ui/widgets/media_preview_strip.dart` — per-tile HD toggle trong `_StagedTile`
- `staged_attachments_provider.dart` — `StagedAttachment.isHD` per-item, `toggleHD(id)` method
- Fix: thêm `isAllHDProvider` (StateProvider.family), xóa per-tile HD button, thêm global toggle ở strip header

### 4.5 Video Inline Playback Bug

**Web** — `apps/web/components/chat/ImageContent.tsx`:
```tsx
// Hiện tại: <a href="..." target="_blank"> → browser download
export function VideoContent({ content }) {
  return <a href={absoluteMediaUrl(content)} target="_blank">...</a>
}
```
Fix: thay bằng `onClick` → Dialog với `<video src={...} controls autoPlay />`

**Flutter** — `apps/client/lib/features/chat/ui/widgets/image_content.dart`:
```dart
// Hiện tại:
onTap: () => openExternally(url),  // opens browser → download
```
Fix: tạo `VideoPlayerDialog` widget, thêm packages `video_player: ^2.9.5` + `chewie: ^1.11.0` vào pubspec.yaml
- Chi tiết đầy đủ: `docs/superpowers/plans/2026-07-09-video-hd-greendhot-fixes.md`

### 4.6 Profile Edit Flow (Flutter)
**Hiện tại:** Settings → "Chỉnh sửa trang cá nhân" → bật thẳng `EditProfileScreen`

**Yêu cầu:**
1. Settings → bật `UserProfileScreen` với data của chính mình (view profile như người khác nhìn)
2. Cuối UserProfileScreen (khi là own profile) → nút "Chỉnh sửa hồ sơ" → navigate `/edit-profile`
3. Cover photo: thêm bottom sheet preview trước khi upload (có Hủy / Đặt làm ảnh bìa)
4. Save button: bỏ nút LƯU gradient ở cuối scroll, thay bằng TextButton "Lưu" trên AppBar (active khi `_hasUnsavedChanges`)

Relevant files:
- `apps/client/lib/features/settings/ui/settings_screen.dart` line 156-161
- `apps/client/lib/features/profile/ui/edit_profile_screen.dart`
- `apps/client/lib/features/profile/ui/widgets/edit_profile_header.dart`

### 4.7 Token Usage Date Range

**Backend** — `apps/server/chat-service/src/main/java/com/platform/chatservice/controller/UsageController.java`:
```java
// Hiện tại: chỉ nhận `days` param (default 30)
@GetMapping("/tokens")
public List<TokenUsageDayResponse> getTokenUsage(@RequestParam(defaultValue = "30") int days)
```
Fix: thêm `startDate` + `endDate` optional params. Repository `findByUserIdAndDateBetweenOrderByDateAsc` đã support range.

**Flutter** — `apps/client/lib/features/settings/ui/token_usage_screen.dart`:
- Hardcoded `static const _days = 30`
- Fix: chuyển thành `ConsumerStatefulWidget`, thêm preset chips (7d/30d/90d) + `showDateRangePicker`
- Validation: end ≤ today, start ≤ end
- Provider cần đổi family type từ `int` → `({int? days, String? startDate, String? endDate})`

---

## 5. KEY CODE LOCATIONS

### Flutter
| Component | File |
|-----------|------|
| Router + redirect logic | `apps/client/lib/core/router/app_router.dart` |
| Legal screen | `apps/client/lib/features/settings/ui/legal_screen.dart` |
| Settings screen | `apps/client/lib/features/settings/ui/settings_screen.dart` |
| Edit profile screen | `apps/client/lib/features/profile/ui/edit_profile_screen.dart` |
| Edit profile header | `apps/client/lib/features/profile/ui/widgets/edit_profile_header.dart` |
| User profile screen | `apps/client/lib/features/profile/ui/user_profile_screen.dart` |
| Token usage screen | `apps/client/lib/features/settings/ui/token_usage_screen.dart` |
| Token usage chart | `apps/client/lib/features/settings/ui/widgets/token_usage_chart.dart` |
| Video content widget | `apps/client/lib/features/chat/ui/widgets/image_content.dart` |
| Media preview strip | `apps/client/lib/features/chat/ui/widgets/media_preview_strip.dart` |
| Staged attachments | `apps/client/lib/features/chat/data/staged_attachments_provider.dart` |
| Conversation avatar | `apps/client/lib/features/chat/ui/widgets/conversation_avatar.dart` |
| Active friends row | `apps/client/lib/features/chat/ui/widgets/active_friends_row.dart` |
| i18n ARB files | `apps/client/lib/l10n/app_*.arb` (7 files: en/vi/zh/ja/ko/fr/es) |
| pubspec.yaml | `apps/client/pubspec.yaml` — CHƯA có video_player / chewie |

### Web (Next.js)
| Component | File |
|-----------|------|
| Settings page | `apps/web/app/(main)/settings/page.tsx` line 207 = hardcoded green dot |
| Image/Video content | `apps/web/components/chat/ImageContent.tsx` |
| Media preview strip | `apps/web/components/chat/MediaPreviewStrip.tsx` |
| Message input | `apps/web/components/chat/MessageInput.tsx` |
| Staged attachments hook | `apps/web/lib/hooks/use-staged-attachments.ts` |
| Message actions | `apps/web/components/chat/MessageActions.tsx` |
| i18n messages | `apps/web/messages/*.json` (7 files) |

### Backend
| Service | Key file |
|---------|----------|
| Token usage API | `apps/server/chat-service/.../controller/UsageController.java` |
| Token usage repo | `apps/server/chat-service/.../repository/TokenUsageRepository.java` |

---

## 6. I18N KEYS CẦN THÊM (chưa implement)

Các key mới cần add vào tất cả 7 ARB/JSON files:

| Key | en | vi |
|-----|----|----|
| `videoViewer` | "Video viewer" | "Xem video" |
| `tokenUsageSelectRange` | "Select date range" | "Chọn khoảng thời gian" |
| `tokenUsageDateRangeError` | "Start date must be before end date" | "Ngày bắt đầu phải trước ngày kết thúc" |
| `coverPhotoPreviewTitle` | "Preview cover photo" | "Xem trước ảnh bìa" |
| `saveCoverPhoto` | "Set as cover" | "Đặt làm ảnh bìa" |
| `editProfileButton` | "Edit profile" | "Chỉnh sửa hồ sơ" |

---

## 7. PACKAGES CẦN THÊM VÀO pubspec.yaml

```yaml
# apps/client/pubspec.yaml — thêm vào dependencies:
video_player: ^2.9.5
chewie: ^1.11.0
```

Sau khi thêm: `cd apps/client && flutter pub get`

---

## 8. ĐIỀU CLAUDE CODE CẦN LÀM KHI TIẾP TỤC

**Priority 1 — Bugs đang gây crash/broken UX:**
1. Fix Legal screen crash → `2026-07-09-settings-mobile-fixes.md` Fix 1
2. Fix Video download thay vì xem → `2026-07-09-video-hd-greendhot-fixes.md` Fix 3

**Priority 2 — UX improvements:**
3. HD global toggle → `2026-07-09-video-hd-greendhot-fixes.md` Fix 2
4. Green dot own avatar → `2026-07-09-video-hd-greendhot-fixes.md` Fix 1
5. Profile flow redesign + cover photo preview → `2026-07-09-settings-mobile-fixes.md` Fix 2,3,4
6. Token date range → `2026-07-09-settings-mobile-fixes.md` Fix 5
7. MCP Directory logos → `2026-07-08-connector-logos-and-new-skills.md`

**Priority 3 — Còn pending từ trước:**
8. Tất cả plans `2026-07-07-*` và `2026-07-08-ui-polish-5-issues.md`
9. Flutter sync cho upload-preview + multiselect (web đã xong)

---

## 9. CROSS-PLATFORM SYNC RULE

Mọi fix UI trên web PHẢI có tương đương trên Flutter và ngược lại. Nếu chỉ fix 1 platform = vẫn còn bug.

---

*Generated: 2026-07-09 | Session: Platform PON*
