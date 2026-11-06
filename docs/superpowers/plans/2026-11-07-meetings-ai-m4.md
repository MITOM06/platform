# Phòng họp AI — M4: File trong chat họp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người trong phòng gửi file trong chat họp. Khi AI ghi chú đang bật, AI đọc file (PDF, DOCX, text, ảnh) và ghi vào bản ghi cuộc họp dạng "File: tên — nội dung". Tóm tắt sau họp và `@AI` dùng được nội dung đó.

**Architecture:** Upload qua `POST /api/uploads` sẵn có. Tin chat họp mang thêm `attachment`. chat-service kiểm file là của người gửi, cấp quyền đọc cho người thuộc cuộc họp (ref `m`), lưu tin. Nếu AI đang bật thì publish Redis `meet:material`. ai-service tải file bằng internal key (có trần dung lượng và timeout), trích chữ (tài liệu) hoặc mô tả ảnh (vision, Anthropic API), rồi publish `meet:material:result`. chat-service ghi `MeetingRecord` kind `FILE`.

**Tech Stack:** Spring Boot 3 · NestJS ai-service · Next.js · Flutter.

**Spec:** `docs/superpowers/specs/2026-11-05-meetings-ai-design.md` §4.2 (dòng "File đính kèm"), §4.6 (`meet:material`). Plan trước: `2026-11-06-meetings-ai-m3.md`.

## Global Constraints

- Nhánh `feat/meetings-ai`. Commit chỉ `git add <file>`; trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Không chạy formatter cả thư mục.
- `MeetingChatCommand` / `MeetingMessage` / `MeetingMessageDto` thêm **`attachment`** `{url, name, size, contentType}` (nullable). `url` phải khớp `/api/uploads/{uuid|24hex}`. `name` ≤ **200** ký tự. `size` và `contentType` lấy từ GridFS, **không** tin client. File phải do chính người gửi upload (`metadata.uploadedBy`). Có attachment thì `content` được rỗng.
- Quyền đọc file: ref mới **`{t:"m", id: meetingId}`** trong `metadata.refs`. Đọc được khi `MeetingAccess.canReadRecords`.
- Kênh Redis: **`meet:material`** `{meetingId, messageId, uploadId, fileName, mimeType, userId}` (S→ai). **`meet:material:result`** `{meetingId, messageId, fileName, status: "ok"|"unsupported"|"failed", text?}` (ai→S). Dedupe theo `messageId` ở cả hai phía.
- Chỉ publish khi `settings.aiNotes == true` lúc gửi. Trần **20** file mỗi cuộc họp (cấu hình `meetings.ai.fileCap`). Hết trần thì ghi một dòng record "Đã đạt giới hạn file AI đọc", chỉ một lần.
- `MeetingRecord` thêm `ref` (uploadId) và `fileName`. Kind `FILE`. `text`:
  - Khi `ok`: nội dung trích, tối đa **6000** ký tự.
  - Khi `unsupported` / `failed`: `"Không đọc được file này."`.
  - `displayName` = tên người gửi.
- ai-service tải file: `resolveUploadUrl` + `internalUploadHeaders`, `redirect: 'error'`, trần **20 MB**, timeout **20 s**.
- Loại file:
  - Đọc chữ: PDF, DOCX, `text/*`.
  - Ảnh jpeg/png/gif/webp ≤ 5 MB đi vision. **Vision chỉ qua Anthropic API.**
  - Loại khác ⇒ `unsupported`.
- UI web + Flutter: nút đính kèm trong ô chat họp. Card file gồm icon, tên, dung lượng, mở hoặc tải qua `absoluteMediaUrl`/`downloadMediaUrl`, không hiện URL thô. i18n 7 locale. File UI ≤ 400 dòng.

## Rulings (quyết định của Claude — owner xem lại)

1. **Trần 20 file/cuộc họp** (spec chỉ đặt trần cho ảnh màn hình). Lý do: ảnh đính kèm cũng đi vision trả tiền. Nếu sai: cuộc họp gửi > 20 file thì phần sau AI không đọc.
2. **Không gọi model để tóm lược tài liệu chữ.** Lưu thẳng 6000 ký tự đầu. Tóm tắt cuối buổi tự rút ý. Nếu sai: tài liệu dài chỉ được đọc phần đầu.
3. File gửi khi AI đang tắt **không** được đọc về sau, kể cả khi AI bật lại (spec: chỉ ghi khi cờ đang bật). Nếu sai: phải gửi lại file sau khi bật AI.
4. Người vào phòng tải được file qua ref `m`. Bản thân chat họp không đổi quyền.

## Review Focus

1. **Gửi `attachment` trỏ tới file của người khác** (đoán UUID) ⇒ từ chối, không cấp ref. Test Task 2.
2. **Người ngoài cuộc họp mở URL file khi `UPLOADS_REQUIRE_AUTH=true`** ⇒ 403. Người thuộc cuộc họp ⇒ đọc được. Test Task 1.
3. **Hai instance cùng nhận `meet:material:result`** ⇒ một dòng record. Test Task 2.
4. **File 50 MB hoặc server trả chậm** ⇒ ai-service bỏ (`failed`) trong ≤ 20 s, không treo, không hết RAM. Test Task 3.
5. **Nội dung file chứa lệnh injection** ⇒ vào bản ghi như dữ liệu. Prompt tóm tắt và `@AI` đã rào bằng `wrapUntrusted`. Test Task 3: text giữ nguyên, không bị thực thi.

---

### Task 1: chat-service — quyền đọc file theo cuộc họp

**Files:** `service/upload/UploadRefs.java` (+`attachToMeeting(String uploadId, String meetingId, String actorId)`), `service/upload/UploadAccessPolicy.java` (nhánh ref `m`), tests.

- [ ] Test:
  - Uploader gắn ref ⇒ invitee, attendee, thành viên phòng ban đọc được.
  - Người ngoài và người bị đá ⇒ không đọc được.
  - Người không phải uploader gọi `attachToMeeting` ⇒ không gắn.
  - Ref `c` / `d` cũ không đổi.
- [ ] Cài: phòng ban của người đọc lấy qua `MeetingPeople#departmentIdsOf`. `admitted` qua `MeetingLobby`.
- [ ] `mvn -q test` → commit `feat(meetings): meeting-scoped read access for chat uploads`.

### Task 2: chat-service — tin chat họp có file + `meet:material`

**Files:** `dto/meeting/MeetingChatCommand.java`, `model/MeetingMessage.java`, `dto/meeting/MeetingMessageDto.java`, `service/meeting/MeetingChatService.java`, `model/MeetingRecord.java` (+`ref`, `fileName`), `model/Meeting.java` (+`aiFileCount` hoặc đếm qua store), `service/meeting/MeetingStore.java` (claim trần nguyên tử), mới `service/meeting/MeetingMaterialTrigger.java`, `service/meeting/MeetingMaterialResultListener.java`, `config/RedisListenerConfig.java`; `docs/api-spec.md`, `apps/server/chat-service/CLAUDE.md`; tests.

- [ ] Test gửi:
  - Có attachment hợp lệ ⇒ tin có attachment (size/contentType từ GridFS), ref `m` được gắn, `meet.chat` mang attachment.
  - File của người khác / URL sai dạng / file không tồn tại ⇒ `MEETING_INVALID`.
  - Content rỗng + attachment ⇒ OK. Content rỗng không attachment ⇒ lỗi như cũ.
  - Replay cùng `clientId` ⇒ không publish lần hai.
- [ ] Test trigger:
  - AI bật ⇒ publish `meet:material` đúng payload.
  - AI tắt ⇒ không publish.
  - File thứ 21 ⇒ không publish, ghi đúng 1 dòng "đạt giới hạn".
- [ ] Test listener:
  - `ok` ⇒ 1 `MeetingRecord` FILE với text cắt 6000.
  - `unsupported` / `failed` ⇒ text "Không đọc được file này.".
  - Nhận 2 lần ⇒ 1 dòng (claim `meet:material:done:{messageId}`).
  - Cuộc họp không còn ⇒ bỏ.
- [ ] Cài; history (`GET /messages`) trả attachment.
- [ ] `mvn -q test` → commit `feat(meetings): file attachments in the meeting chat feed the AI record`.

### Task 3: ai-service — đọc file cuộc họp

**Files:** mới `meeting/meeting-material.service.ts` (+ spec); sửa `meeting/meeting.constants.ts`, `meeting/meeting-subscriber.service.ts` (subscribe thêm kênh, rẽ nhánh theo channel), `meeting/meeting.module.ts`, `kb/kb.module.ts` (export `DocumentExtractorService`, `VisionDescribeService`), helper tải file có trần (dùng chung hoặc mới trong `common/`); root `CLAUDE.md` (bảng Redis); `.claude/rules/ai-service.md`.

- [ ] Test:
  - Claim `meet:material:claim:{messageId}` (NX, EX 3600). Thua claim ⇒ không tải.
  - PDF/DOCX/text ⇒ `ok`, text ≤ 6000.
  - Ảnh hỗ trợ ⇒ gọi `describeImage` ⇒ `ok`.
  - Ảnh > 5 MB hoặc loại khác ⇒ `unsupported`.
  - Fetch ≥ 20 MB (Content-Length hoặc stream vượt) ⇒ `failed` mà không đọc hết.
  - Timeout 20 s ⇒ `failed`.
  - Extractor ném ⇒ `failed`.
  - URL ngoài internal base ⇒ không fetch, `failed`.
  - Header `X-Internal-Key` chỉ gửi tới internal base.
  - Prompt tóm tắt M2 render dòng FILE dạng `[FILE] tên: …`, nằm trong rào. Thêm test nếu chưa có.
- [ ] `pnpm --filter ai-service test` + `tsc` → commit `feat(ai): read meeting chat files into the meeting record`.

### Task 4: Web — đính kèm file trong chat họp

**Files:**
- `components/meeting/room/MeetingChatComposer.tsx`: nút kẹp giấy, chọn file, upload, rồi gửi.
- `lib/meetings/meeting-room-chat.ts`: `send` nhận `attachment?`; pending line giữ attachment; retry gửi lại.
- `lib/meetings/meeting-events.ts` và `lib/api/meeting-types.ts`: parse `attachment`.
- `components/meeting/room/MeetingChatLines.tsx`: card file. Dùng lại `FileContent`, hoặc tách bản nhận props.
- `messages/*.json` (7 file).
- tests.

- [ ] Test:
  - Chọn file ⇒ `chatApi.uploadFile`, rồi publish `/app/meet.chat` với `{url, name, size, contentType}`. Upload lỗi (`FILE_TOO_LARGE`, mạng) ⇒ toast đã dịch, không publish.
  - Đang upload ⇒ nút gửi khoá.
  - Tin có attachment ⇒ card (tên, dung lượng, link tải qua `downloadMediaUrl`), không hiện URL. Tin chỉ có file ⇒ không có bubble chữ rỗng.
  - Parse attachment sai dạng ⇒ bỏ attachment, giữ tin.
- [ ] `pnpm --filter web test`, `tsc`, `lint` → commit `feat(web): attach files in the meeting chat`.

### Task 5: Flutter — mirror Task 4

**Files:** `ui/room/chat_composer.dart`, `state/meeting_room_chat.dart`, `domain/meeting_room_models.dart`, `domain/meeting_events.dart`, `data/meetings_repository.dart` (history), `ui/room/chat_lines.dart` (card file từ helper `formatBytes`/`fileIcon`/`downloadMedia`), upload qua `uploadDocument`, `l10n/app_*.arb` (7); tests.

- [ ] Test như Task 4 → `flutter test`, `flutter analyze` → commit `feat(client): attach files in the meeting chat`.

### Task 6: Thử tay (cần owner đồng ý merge `dev`)

- [ ] Họp có AI:
  - Gửi PDF, DOCX và ảnh slide ⇒ `meeting_records` có 3 dòng FILE.
  - Kết thúc họp ⇒ tóm tắt có mục "Từ tài liệu".
  - Gửi `.pptx` ⇒ "Không đọc được file này.".
  - Người ngoài mở link file ⇒ 403. Bật `UPLOADS_REQUIRE_AUTH=true` để kiểm.
