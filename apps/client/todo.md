# TODO — Flutter Mobile UX fixes (Sprint từ feedback người dùng)

> Nguồn: phản hồi người dùng 2026-06-12. Tập trung `apps/client` (Flutter).
> Đã đọc: CLAUDE.md, .claude/rules/{flutter,clean-code,i18n,web}.md, client/CLAUDE.md.
> Luật áp dụng: i18n (không hardcode chuỗi UI — dùng `context.l10n`), file < 400 dòng,
> Riverpod, go_router, `withValues(alpha:)`, mỗi key thêm vào cả 7 file ARB.

## Phân tích từng vấn đề

| # | Phản hồi | Trạng thái code hiện tại | Hành động |
|---|----------|--------------------------|-----------|
| 1 | Ảnh đã chia sẻ bị lỗi 404 (`6a2baa0…`) | URL upload trả về `data['url']` → ghép `chatBaseUrl`. 404 = chat-service serve file sai path → **backend** | Điều tra, báo cáo (ngoài phạm vi UI thuần) |
| 2 | Settings đổi giao diện/ngôn ngữ "không có option, tự nhảy" | `showThemeSelectionDialog` / `showLanguageSelectionDialog` ĐÃ có dialog đầy đủ option | Code đã đúng → nhiều khả năng build cũ. Verify `flutter analyze` |
| 3+6 | Background chat: thiếu up ảnh, căn chỉnh, nút xác nhận, thông báo giữa màn hình | Dialog đã có preset + upload + gửi system message. **Thiếu**: preview, nút xác nhận, chỉnh fit ảnh | **LÀM**: redesign dialog (preview + fit + Confirm/Cancel) |
| 4+7 | 2 nút "thêm cuộc trò chuyện" kế nhau / cạnh thanh tìm kiếm | AppBar có `person_add`(→/new-conversation) + FAB(→/new-conversation) = trùng | **LÀM**: bỏ nút trùng ở AppBar, giữ FAB |
| 5 | Click avatar người trong nhóm → không xem được trang cá nhân | `GroupSenderHeader` ĐÃ tappable → `showUserProfileDialog`; `showSenderName: isGroup` | Code đã đúng → verify; nếu lỗi là do fetch profile (backend) |

## Công việc đã làm

- [x] **T1 — Background chat (3+6)**: viết lại dialog → tách `chat_wallpaper_dialog.dart`
  - [x] Preset hiển thị dạng nút CHỌN (không apply ngay) + tick chọn
  - [x] Khu vực preview wallpaper đang chọn (gradient / ảnh)
  - [x] Chọn kiểu hiển thị ảnh upload: Phủ kín / Vừa khung / Kéo giãn (fit)
  - [x] Hàng nút Hủy / Xác nhận đổi — chỉ apply + gửi system message khi Xác nhận
  - [x] Mã hoá fit trong giá trị wallpaper (`#fit=...`), render đúng ở `chat_screen`
  - [x] Thông báo giữa màn hình "X đã thay đổi chủ đề" → đã có sẵn (`SystemMessage`)
  - (i18n: theo pattern `isVi` có sẵn trong file customisation, không đụng 7 ARB)
- [x] **T2 — Bỏ nút trùng (4+7)**: xoá IconButton `person_add` trong AppBar `conversation_list_screen`, giữ FAB
- [x] **T3 — Verify**: `flutter analyze` sạch + `flutter test` pass; file < 400 dòng

## Mục cần phía người dùng / backend
- **#2 (settings option)** & **#5 (xem profile thành viên nhóm)**: code hiện tại đã đúng
  (dialog chọn theme/ngôn ngữ + avatar nhóm tappable) → rebuild bản mới để thấy.
- **#1 (404 ảnh)**: GET `/api/uploads/**` đã `permitAll`. 404 = object GridFS không tồn
  tại trong DB production (dữ liệu cũ/khác môi trường). Cần kiểm tra dữ liệu, không phải lỗi UI.

## Ghi chú
- Mục 2 & 5: code hiện tại đã triển khai đúng → ưu tiên người dùng rebuild bản mới.
- Mục 1 (404 ảnh): cần kiểm tra endpoint serve file của chat-service (Spring Boot).

---

# Sprint 2 — Debug gọi điện / thông báo (feedback 2026-06-12)

## Đã sửa (code, high-confidence)
- [x] **Gọi điện/video trên APP không hoạt động** — NGUYÊN NHÂN: thiếu quyền native.
  - `android/app/src/main/AndroidManifest.xml`: thêm CAMERA, RECORD_AUDIO,
    MODIFY_AUDIO_SETTINGS, BLUETOOTH(_CONNECT), POST_NOTIFICATIONS + uses-feature.
  - `ios/Runner/Info.plist`: thêm NSCameraUsageDescription, NSMicrophoneUsageDescription.
  - Trước đó `getUserMedia` ném lỗi → CallScreen hiện snackbar lỗi rồi pop ⇒ không gọi được.
- [x] **Thông báo trên WEB** — chỉ hiện `Notification` khi tab ẩn; nay thêm **toast trong app**
  khi tab đang mở + bỏ qua cuộc trò chuyện đang xem + click để mở (`app/(main)/layout.tsx`).

## Đúng sẵn trong code (không phải bug)
- Tín hiệu WebRTC (offer/answer/ice/end) app↔chat-service: đúng. Principal = userId, broker
  có `/user` + `/queue`. Banner cuộc gọi đến dùng `rootNavigatorKey` (đã wire vào GoRouter).
- Đăng ký FCM token: client `getToken` → `POST /api/users/device-tokens` → auth-service
  `$addToSet fcmTokens` → chat-service `FcmService` đọc `fcmTokens`. Chuỗi hoàn chỉnh.
- Banner thông báo trong app (foreground) qua STOMP `/user/queue/notifications`: đúng.

## Cần CONFIG phía server (không phải code) — chặn push thật
- [ ] Đặt env `app.firebase.service-account-base64` cho chat-service (Cloud Run). Thiếu →
  `FirebaseConfig` trả null → `FcmService` no-op → KHÔNG có push khi máy nhận offline.
- Lưu ý: `FcmService` chỉ push khi người nhận **offline**; khi cả 2 online dùng banner in-app.

## Tính năng web — gọi điện/video (ĐÃ LÀM)
- [x] **Gọi điện/video trên WEB** (mirror Flutter WebRTC):
  - `apps/web/lib/store/call.store.ts` — Zustand state cuộc gọi.
  - `apps/web/lib/webrtc/call-manager.ts` — RTCPeerConnection + signaling `/app/call.*`.
  - `apps/web/components/call/CallOverlay.tsx` — UI: cuộc gọi đến / đang gọi / đang kết nối,
    video local+remote, nút mic/camera/kết thúc, đếm giờ.
  - `app/(main)/layout.tsx` — subscribe `/user/queue/webrtc`, mount `<CallOverlay/>`.
  - `components/chat/ConversationHeader.tsx` — nút Gọi thoại / Gọi video (chat 1-1).
  - Đã sửa: từ chối cuộc gọi đến vẫn báo `call.end` cho người gọi (fallback store).
  - tsc + eslint sạch.
  - Hạn chế v1: tên người gọi đến hiển thị generic ("Người dùng"); resubscribe sau reconnect
    là hạn chế sẵn có của layout (ngoài phạm vi).

## Cần thông tin người dùng
- [ ] **Nút bị lỗi hiển thị trên app điện thoại**: cần ảnh chụp / tên màn hình cụ thể để sửa.
