# Phòng họp AI — M5: Màn hình share — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi AI ghi chú đang bật và có người share màn hình (web hoặc Android), máy đang share tự chụp khung hình mỗi khi nội dung đổi đáng kể (cách nhau ít nhất 15 s, tối đa 60 ảnh mỗi cuộc họp) rồi upload. ai-service dùng vision mô tả chữ trên slide, số liệu và ý chính. Phần mô tả vào bản ghi cuộc họp (kind `SCREEN`). Ảnh gốc bị xoá.

**Architecture:**
- Client đang share chụp từ track share, so ảnh thu nhỏ để phát hiện thay đổi, rồi `POST /api/meetings/{id}/screen-frames` (multipart).
- chat-service kiểm quyền, giới hạn tốc độ và trần số ảnh. Ảnh lưu GridFS tạm. chat-service ghi "vé" Redis cho frame, rồi publish `meet:material` với `kind:"screen"`.
- ai-service tái dùng đường M4: tải ảnh, sniff, vision với prompt màn hình, rồi publish `meet:material:result`.
- chat-service ghi `MeetingRecord` SCREEN (chỉ khi có vé) và xoá ảnh. Một sweep xoá ảnh mồ côi.

**Tech Stack:** Spring Boot 3 · NestJS ai-service · Next.js (canvas) · Flutter Android (`flutter_webrtc` `captureFrame` + `image`).

**Spec:** `docs/superpowers/specs/2026-11-05-meetings-ai-design.md` §4.2 (dòng "Màn hình share"), §4.6, §2 ("Không được xảy ra": đốt quota vì ảnh không giới hạn). Plan trước: `2026-11-07-meetings-ai-m4.md`.

## Global Constraints

- Nhánh `feat/meetings-ai`. Chỉ `git add <file>`. Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Chỉ format file mình sửa.
- Endpoint **`POST /api/meetings/{id}/screen-frames`**, multipart `frame` (JPEG hoặc PNG, ≤ **2 MB**, kiểm magic bytes) và `ts` (epoch ms, tuỳ chọn). Quyền:
  - người gửi phải đang trong phòng (`guard.inRoom`);
  - được phép share: host/co-host, hoặc `settings.allowAttendeeScreenShare`;
  - `settings.aiNotes == true`.
- Phản hồi:
  - **202** `{accepted:true}` khi nhận.
  - **204** khi bỏ qua vì AI đang tắt, đã hết trần, hoặc chưa đủ 15 s kể từ ảnh trước của người đó. Client im lặng.
  - Vào phòng hỏng: lỗi `MEETING_*` như các endpoint khác.
  - Ảnh sai dạng: 400 `MEETING_INVALID {field:"frame"}`.
- Giới hạn tốc độ phía server: Redis `SET NX EX 15` key `meet:screen:throttle:{meetingId}:{userId}`.
- Trần **60** ảnh mỗi cuộc họp, cấu hình `meetings.ai.screen-cap`. Đếm nguyên tử bằng `aiScreenCount` / `aiScreenCapNoted` trên Meeting. Hết trần thì ghi đúng một dòng SCREEN "Đã đạt giới hạn ảnh màn hình AI đọc.".
- Ảnh lưu GridFS với metadata `{fileId, uploadedBy, screenFrame: true}`, **không** gắn ref nào, nên chỉ người upload và internal key đọc được.
- Vé Redis `meet:screen:frame:{frameId}` = `{meetingId, userId, ts, uploadId}`, TTL 1 h. `frameId` là UUID.
- `meet:material` thêm trường `kind` (`"file"` mặc định, `"screen"`). Với screen thì `messageId = frameId`.
- Listener chỉ ghi SCREEN khi vé tồn tại và `meetingId` khớp. Sau đó xoá vé và xoá ảnh, **với mọi status**.
- Sweep mỗi 10 phút xoá các file `screenFrame` cũ hơn 1 h.
- ai-service với `kind:"screen"`:
  - Bắt buộc sniff ra ảnh, tải tối đa **3 MB**.
  - Prompt màn hình: chữ trên slide, số liệu, ý chính, ngắn gọn. `max_tokens` **800**.
  - Text gửi về tối đa **1500** ký tự. Usage label `meeting-screen`.
  - Vision chỉ qua Anthropic API.
- Text record SCREEN = mô tả. `displayName` = người share. `ts` lấy từ vé. Prompt render dạng `[SCREEN] (shared by X, hh:mm): …` trong rào untrusted.
- Client:
  - Chỉ chạy khi `aiNotes && đang share màn hình của mình`.
  - Kiểm mỗi **5 s**. So ảnh xám **32×18**: trung bình chênh lệch tuyệt đối ≥ **0.06** (thang 0–1) thì coi là đổi.
  - Gửi khi đổi **và** đã ≥ 15 s từ lần gửi trước. Ảnh đầu tiên gửi ngay khi bắt đầu.
  - Ảnh gửi: thu về cạnh dài ≤ **1280 px**, JPEG chất lượng 0.7.
  - 204/429 thì im lặng. Lỗi khác thì bỏ qua lần đó.
  - Người đang share thấy dòng nhỏ "AI đang đọc màn hình bạn chia sẻ" (i18n 7 locale).
- iOS: không làm (P1 chưa có share màn hình trên iOS). Android: `captureFrame()` lỗi thì tắt tính năng cho phiên đó, không báo lỗi.

## Rulings (quyết định của Claude — owner xem lại)

1. **Server không theo dõi ai đang share.** Client chỉ gửi khi chính nó đang share. Server kiểm "được phép share" theo luật share hiện có cộng với giới hạn 15 s và trần 60. Giá nếu sai: một người được phép share có thể gửi ảnh không phải màn hình share. Vẫn bị chặn ở 60 ảnh và 1 ảnh/15 s, ảnh đó chỉ vào bản ghi của cuộc họp họ đang ở.
2. **Vé Redis** để kết quả giả không ghi được SCREEN. M4 coi Redis là ranh giới tin cậy, M5 chặt hơn vì kết quả không gắn với tin chat nào.
3. **Ngưỡng đổi 0.06 trên ảnh 32×18, kiểm mỗi 5 s.** Spec để ngưỡng cho người code. Giá nếu sai: slide đổi ít (chỉ đổi số) có thể bị bỏ, hoặc video chạy liên tục gửi đủ 1 ảnh/15 s cho tới khi hết trần.
4. Ảnh không được ai trong cuộc họp mở xem, chỉ AI đọc rồi xoá (spec: không lưu bền ảnh).

## Review Focus

1. **Gửi ảnh liên tục** (script, 10 ảnh/giây) ⇒ server nhận tối đa 1 ảnh/15 s/người, tổng 60/cuộc họp, vision gọi ≤ 60 lần. Test Task 1.
2. **ai-service chết** ⇒ ảnh không nằm mãi trong GridFS: sweep xoá sau 1 h. Test Task 1.
3. **Kết quả giả hoặc lặp** cho `frameId` không có vé ⇒ không ghi record. Test Task 1.
4. **AI bị tắt giữa lúc đang share** ⇒ client dừng chụp, server trả 204. Test Task 1, 3, 4.
5. **Ảnh không phải ảnh** (đổi đuôi) ⇒ 400 ở server, `unsupported` ở ai-service, không gọi vision. Test Task 1, 2.

---

### Task 1: chat-service — endpoint, giới hạn, vé, kết quả SCREEN, xoá ảnh, sweep

**Files:**
- Sửa: `controller/MeetingController.java`, `model/Meeting.java` (`aiScreenCount`, `aiScreenCapNoted`), `service/meeting/MeetingStore.java` (`claimAiScreenSlot(id, cap)`, trả CLAIMED / CAP_REACHED_FIRST / CAP_REACHED), `service/meeting/MeetingMaterialTrigger.java` (`kind` trong payload), `service/meeting/MeetingMaterialResultListener.java` (nhánh screen), `application.yml` (`meetings.ai.screen-cap: ${MEETINGS_AI_SCREEN_CAP:60}`).
- Mới: `service/meeting/MeetingScreenFrames.java` (nhận frame), `service/meeting/MeetingScreenFrameSweep.java`.
- Docs: `docs/api-spec.md`, `apps/server/chat-service/CLAUDE.md`.
- Tests.

- [ ] Test nhận frame:
  - Đúng điều kiện ⇒ 202, ảnh nằm trong GridFS với `screenFrame:true` và không có ref, có vé, publish `meet:material` `kind:"screen"`.
  - AI tắt / gửi lần 2 trong 15 s / ảnh thứ 61 ⇒ 204, không publish. Ảnh thứ 61 ghi đúng 1 dòng cap.
  - Attendee khi `allowAttendeeScreenShare=false` ⇒ 403 `MEETING_FORBIDDEN`.
  - Người ngoài phòng ⇒ lỗi như `inRoom`.
  - File không phải ảnh (magic bytes) hoặc > 2 MB ⇒ 400 `MEETING_INVALID`.
- [ ] Test listener screen:
  - Có vé ⇒ 1 record SCREEN (userId, displayName, ts từ vé; text cắt 1500), vé bị xoá, ảnh bị xoá.
  - Không vé ⇒ không record, không xoá file nào khác.
  - `failed` / `unsupported` có vé ⇒ không record, ảnh vẫn bị xoá.
  - Nhánh FILE của M4 không đổi.
- [ ] Test sweep: frame 2 h tuổi bị xoá, frame 10 phút tuổi giữ lại, file upload thường không bị đụng.
- [ ] `mvn -q test` → commit `feat(meetings): screen frames endpoint feeding the AI record`.

### Task 2: ai-service — đọc khung hình màn hình

**Files:** `kb/vision-describe.service.ts` (`describeImage` nhận tham số tuỳ chọn `{prompt?, maxTokens?, usageLabel?}`, mặc định giữ nguyên), `meeting/meeting.constants.ts` (`kind`), `meeting/meeting-subscriber.service.ts` (validate `kind`), `meeting/meeting-material.service.ts` (nhánh screen), `meeting/meeting-prompt.ts` (render `[SCREEN] (shared by X, hh:mm): …`); `.claude/rules/ai-service.md`; specs.

- [ ] Test:
  - Screen + JPEG ⇒ `describeImage` được gọi với prompt màn hình và `maxTokens` 800, label `meeting-screen` ⇒ `ok`, text ≤ 1500.
  - Bytes không phải ảnh ⇒ `unsupported`, không gọi vision. > 3 MB ⇒ `failed`.
  - `kind` thiếu ⇒ coi là file (hành vi M4 giữ nguyên).
  - KB vision vẫn dùng prompt cũ.
  - Prompt render dòng SCREEN trong rào.
- [ ] `pnpm --filter ai-service test` + `tsc` → commit `feat(ai): describe shared-screen frames for the meeting record`.

### Task 3: Web — chụp màn hình share

**Files:**
- Mới: `lib/meetings/frame-diff.ts` (thuần: `thumbnailDiff(a: Uint8Array, b: Uint8Array): number`, `shouldSend({changed, lastSentAt, now}): boolean`), `lib/meetings/use-meeting-screen-frames.ts` (`useMeetingScreenFrames(meetingId, active)`).
- Sửa: API client (upload multipart), `components/meeting/room/MeetingRoom.tsx` (gắn hook với `aiNotes && screen`), dòng báo cho người share (component banner/chip hiện có), `messages/*.json` (7 file).
- Tests.

- [ ] Test:
  - `thumbnailDiff` của ảnh giống nhau = 0, ảnh khác hẳn ≈ 1.
  - `shouldSend`: lần đầu luôn gửi; đổi nhưng < 15 s ⇒ không; đổi và ≥ 15 s ⇒ có; không đổi ⇒ không.
  - Hook (fake timers + fake capture):
    - `active` false ⇒ không capture.
    - Bật ⇒ gửi 1 ảnh ngay.
    - Không đổi ⇒ không gửi thêm.
    - Tắt ⇒ dừng timer.
    - 204/429/lỗi mạng ⇒ không toast, không ném.
  - Dòng báo chỉ hiện cho người đang share khi AI bật.
- [ ] `pnpm --filter web test`, `tsc`, `lint` → commit `feat(web): send shared-screen frames to the AI notes`.

### Task 4: Flutter Android — mirror Task 3

**Files:** mới `features/meetings/domain/frame_diff.dart` (giống web), `features/meetings/state/meeting_screen_frames.dart` (`sync({meetingId, active})` theo mẫu `meeting_transcriber.dart`; chụp bằng `captureFrame()` trên track share local; decode, thu nhỏ, diff và encode JPEG qua `image` trong `compute`), `data/meetings_repository.dart` (`uploadScreenFrame`), nối dây trong `ui/room/meeting_session_view.dart`, dòng báo cho người share, `l10n/app_*.arb` (7); tests.

- [ ] Test giống Task 3, với capture giả. Thêm: `captureFrame` ném lỗi ⇒ tắt cho phiên, không báo lỗi. Không phải Android ⇒ không chạy.
- [ ] `flutter test`, `flutter analyze` → commit `feat(client): send shared-screen frames to the AI notes (Android)`.

### Task 5: Thử tay (cần owner đồng ý merge `dev`)

- [ ] Họp có AI, share slide từ Chrome và lật 5 slide ⇒ có khoảng 5 dòng SCREEN. Tóm tắt có ý từ slide.
- [ ] Để màn hình đứng yên 2 phút ⇒ không gửi thêm.
- [ ] Share video ⇒ tối đa 1 ảnh/15 s.
- [ ] Android share ⇒ có dòng SCREEN, hoặc tự tắt nếu `captureFrame` không chạy.
- [ ] GridFS không còn ảnh frame sau khi xử lý.

---

## Kết quả (2026-11-07)

Task 1–4 DONE trên `feat/meetings-ai` (`ed07d016..672c7453`). Đã qua review từng task, review cuối toàn nhánh và một đợt sửa (F1–F4).

F1 là lỗi **nghiêm trọng** giữa hai service: kết quả từ ai-service thiếu `kind`, nên chat-service không ghi được SCREEN. Đã sửa, kèm fixture hợp đồng dùng chung `apps/server/contracts/meet-material-result.screen.json` để hai bên test cùng một định dạng.

Task 5 (thử tay trên `dev`) **chưa chạy**: cần owner đồng ý merge.

Quyết định thêm khi thực thi:
- Dòng SCREEN trong prompt không ghi giờ, vì giờ đang là UTC và lệch giờ Việt Nam.
- Dòng báo hết trần là dòng hệ thống `[SCREEN] {text}`.
- Upload web có timeout 15 s.
- Chip "AI đang đọc màn hình" trên web chỉ hiện khi thật sự đọc được khung hình. Nếu không đọc được sau 20 lần thử thì dừng.

Việc để sau (không chặn merge):
- Thử tay trên `dev` (bắt buộc):
  - Share slide trên Chrome và trên Android ⇒ có dòng `[SCREEN]`.
  - Vài phút sau, số file `screenFrame` trong GridFS về 0.
  - Màn hình đứng yên ⇒ không gửi thêm.
  - Share video ⇒ tối đa 1 ảnh / 15 s.
  - Thử `captureFrame` trên máy Android thật.
  - Thử Safari / Firefox.
- Chip trên Flutter bật ngay khi bắt đầu, chưa đợi khung hình đầu. Nếu `captureFrame` liên tục trả null thì chip không tự tắt. Nên làm giống web.
- Giới hạn multipart chung là 100 MB, nên ảnh quá cỡ vẫn bị ghi tạm ra đĩa rồi mới bị chặn ở 2 MB.
- Sweep quét `fs.files` vì chưa có index `metadata.screenFrame`.
- Lỗi xảy ra sau khi đã giữ suất thì vẫn tốn suất đó.
- Khi `UPLOADS_REQUIRE_AUTH=false`, ảnh frame mở được bằng URL trong ≤ 1 h. UUID không rời server.
