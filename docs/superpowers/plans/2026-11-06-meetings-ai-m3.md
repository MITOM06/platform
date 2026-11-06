# Phòng họp AI — M3: Hỏi AI về cuộc họp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hỏi AI về cuộc họp ở 3 nơi: `@AI` trong chat họp (lúc đang họp), `@AI` trong nhóm cuộc họp (M2 tạo), và chat riêng 1-1 với AI qua 2 tool `list_my_meetings` / `get_meeting_record`. AI chỉ trả lời nội dung cuộc họp cho người có `canReadRecords`.

**Architecture:** Mọi lần đọc nội dung cuộc họp đi qua endpoint nội bộ của chat-service kèm `userId` người hỏi (chat-service là nơi duy nhất kiểm quyền). `@AI` trong chat họp đi đường `ai.requests` có sẵn với `conversationId = "meeting:{id}"` và trường mới `meetingId`; câu trả lời **không stream ra UI**: chat-service lưu thành `MeetingMessage` của AI bot và phát `meet.chat`, kèm sự kiện `meet.ai` (đang trả lời / lỗi). Nhóm cuộc họp: ai-service thấy `Conversation.meetingId` và tự nạp ngữ cảnh.

**Tech Stack:** Spring Boot 3 · NestJS ai-service · Next.js · Flutter.

**Spec:** `docs/superpowers/specs/2026-11-05-meetings-ai-design.md` §4.3, §4.5. Plan cha: `2026-11-05-meetings-ai.md`. M2: `2026-11-06-meetings-ai-m2.md` (endpoint nội bộ, `MeetingRecordClient`, `wrapUntrusted`).

## Global Constraints

- Nhánh `feat/meetings-ai`. Commit chỉ `git add <file>`; trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Regex `@AI`: **`(?i)@(AI|ponai)\b`** (giống `ChatController.java:40`). Người gửi phải đang trong phòng (đã có `guard.inRoom` trong `MeetingChatService.send`).
- `conversationId` cho `@AI` trong chat họp: **`"meeting:" + meetingId`**. `AiRequestPayload` thêm **`meetingId`** (nullable; Java record + TS type). Lịch sử: **20** tin chat họp gần nhất (AI bot ⇒ role `assistant`).
- Sự kiện mới trên `/topic/meeting/{id}`: **`meet.ai`** `{event:"meet.ai", meetingId, state: "thinking"|"error", requesterId, code?}`. Trả lời xong = một `meet.chat` thường với `sender.userId = "ai-bot-000000000000000000000001"`.
- Endpoint nội bộ (cùng `X-Internal-Key`, 401/404 như M2):
  - `GET /internal/meetings/{id}/record?userId=` thêm trường **`summary`** (MeetingSummary mới nhất hoặc `null`).
  - Mới: **`GET /internal/meetings?userId=&q=&limit=`** → `[{id, title, code, startedAt, endedAt, summaryState}]`, chỉ cuộc họp `ENDED` + `aiNotesEverEnabled` mà `userId` có `canReadRecords`, mới nhất trước, `limit` mặc định **20**, tối đa **50**, `q` lọc tiêu đề (không phân biệt hoa thường, escape regex).
- Tool ai-service: **`list_my_meetings({query?})`**, **`get_meeting_record({meetingId, question?})`** — chỉ trong chat 1-1 với AI. Không có quyền / không tồn tại ⇒ cùng một chuỗi `"Meeting not found."`. Không lộ id người dùng.
- Khối ngữ cảnh cuộc họp trong prompt: `wrapUntrusted("Meeting record", …)`, tối đa **60 000** ký tự (tóm tắt trước, rồi bản ghi; quá dài ⇒ cắt giữa như M2). Câu hỏi có ngữ cảnh cuộc họp ⇒ **tắt response cache**.
- UI: tin AI trong chat họp render Markdown (web `MarkdownContent`, Flutter `MarkdownBody`), tên hiển thị "PON AI" qua i18n; người khác vẫn plain text. Chỉ báo "AI đang trả lời…" từ `meet.ai thinking` tới khi có tin AI, `meet.ai error`, hoặc **60 s**. Lỗi ⇒ dòng thông báo đã dịch, không text thô. 7 locale.

## Rulings (quyết định của Claude — owner xem lại)

1. **Không stream câu trả lời trong chat họp**, chỉ hiện "AI đang trả lời…" rồi cả câu. Lý do: chat họp không có hạ tầng stream; làm stream cần nhân đôi logic `AiStreamBubble` trên 2 nền tảng. Giá nếu sai: người họp chờ 5–20 s mới thấy chữ.
2. Tool cuộc họp **chỉ có trong chat riêng 1-1 với AI** (`ConversationContext.directAi === true`), đúng spec §4.5. Trong nhóm thường, câu trả lời hiện cho cả nhóm nên sẽ lộ nội dung cuộc họp cho người không có quyền. Giá nếu sai: muốn hỏi về cuộc họp khác phải mở chat riêng với AI.
3. `@AI` trong chat họp khi `aiNotes` tắt vẫn dùng endpoint record: lời nói chỉ có khi AI từng bật, nên thực tế chỉ còn chat + ghi chú (đúng spec §4.3).
4. Tin AI trong chat họp **không** vào bản ghi tóm tắt (M2 đã loại tin của bot).

## Review Focus

1. **Người ngoài hỏi qua chat riêng** ("tóm tắt cuộc họp X") ⇒ `"Meeting not found."`, không có tên/tiêu đề cuộc họp. Test Task 1 (endpoint) + Task 4 (tool).
2. **Thành viên được thêm vào nhóm cuộc họp sau** (không thuộc `canReadRecords`) `@AI` trong nhóm ⇒ AI không nhận khối cuộc họp, trả lời là không có quyền xem. Test Task 3.
3. **Hai instance nhận cùng `AI_STREAM_DONE`** ⇒ một tin AI trong chat họp. Test Task 2.
4. **ai-service chết khi đang hỏi** ⇒ `meet.ai error` (qua `reportUnavailable`) và client tắt chỉ báo; không có thì 60 s tự tắt. Test Task 2, 5, 6.
5. **Nội dung chat họp chứa lệnh injection** ⇒ nằm trong rào `wrapUntrusted`. Test Task 3.

---

### Task 1: chat-service — record kèm tóm tắt + endpoint danh sách cuộc họp

**Files:** Modify `dto/meeting/MeetingRecordView.java` (+`summary`), `service/meeting/MeetingRecordReader.java`, `controller/InternalMeetingController.java`; Create `service/meeting/MeetingDirectory.java` (danh sách theo quyền); tests tương ứng; `docs/api-spec.md` mục internal.

**Interfaces:** Produces `MeetingDirectory#listReadable(String userId, String q, int limit): List<MeetingListItem>`; `MeetingListItem(String id, String title, String code, Instant startedAt, Instant endedAt, String summaryState)`.

- [ ] Test: `recordIncludesLatestSummaryOrNull`; `listReturnsOnlyReadableEndedAiMeetings` (host, invitee, attendee, department member thấy; người ngoài, người bị đá, cuộc họp chưa kết thúc, cuộc họp không bật AI thì không); `listFiltersByTitleCaseInsensitiveAndEscapesRegex` (`q=".*"` không khớp tất cả); `listCapsLimitAt50AndDefaults20`; `listRequiresKey` (401); `listBlankUserIdReturnsEmpty` (200 `[]`).
- [ ] Cài: lọc ứng viên bằng Mongo (`status ENDED`, `aiNotesEverEnabled`, `$or` host/coHost/invitee/attendance.userId/departmentId ∈ phòng ban người dùng, `removedIds ≠ userId`), sort `endedAt` desc, rồi kiểm lại `MeetingAccess.canReadRecords` trong Java. Phòng ban qua `MeetingPeople#departmentIdsOf`.
- [ ] `mvn -q test` PASS → commit `feat(meetings): internal meeting list and summary in the record view`.

### Task 2: chat-service — `@AI` trong chat họp + nhận câu trả lời

**Files:** Modify `service/meeting/MeetingChatService.java`, `dto/AiRequestPayload.java` (+`meetingId`), `service/AiRedisPublisher.java` (+ method cho cuộc họp), `service/AiResponseListener.java` (rẽ nhánh `meeting:`), `service/meeting/MeetingEvents.java` (+`ai(...)`); Create `service/meeting/MeetingAiBridge.java` (gửi yêu cầu + lịch sử 20 tin), `service/meeting/MeetingAiReplyHandler.java` (DONE/ERROR cho cuộc họp); tests.

**Interfaces:** Produces `MeetingAiBridge#ask(UserPrincipal caller, String meetingId, String text)` (async, gọi sau `events.chat`); `MeetingAiReplyHandler#handle(Map<String,Object> event)`; `MeetingEvents#ai(String meetingId, String state, String requesterId, String code)`.

- [ ] Test: tin có `@AI`/`@ponai` ⇒ publish 1 `AiRequestPayload` với `conversationId "meeting:{id}"`, `meetingId`, `content` đã bỏ mention, `history` ≤ 20 tin tăng dần (tin bot ⇒ `assistant`), `departmentIds/role/perms` của người hỏi; phát `meet.ai thinking`. Tin không có mention ⇒ không publish. Publish lỗi ⇒ `meet.ai error` code `AI_UNAVAILABLE`.
- [ ] Test listener: `AI_STREAM_DONE` cho `meeting:{id}` ⇒ insert 1 `MeetingMessage` (sender AI bot) + `meet.chat`, **không** ghi `messages`, không push; nhận 2 lần cùng `replyId` ⇒ 1 tin (claim `ai:done:` như cũ); `AI_STREAM_CHUNK` ⇒ bỏ qua; `AI_STREAM_ERROR` ⇒ `meet.ai error` với `code`; `fullContent` rỗng ⇒ chỉ `meet.ai error` code `AI_EMPTY`. Đường cũ (conversation thường) không đổi — test hồi quy hiện có vẫn xanh.
- [ ] Cài; `mvn -q test` PASS → commit `feat(meetings): ask @AI in the meeting chat`.

### Task 3: ai-service — nạp ngữ cảnh cuộc họp

**Files:** Modify `ai/ai.types.ts` (+`meetingId?`), `conversation/conversation.schema.ts` (+`meetingId`), `conversation/conversation-access.service.ts` (select + trả `meetingId`; `meeting:` ⇒ access `member`, không `unknown`), `ai/ai.service.ts` (gắn khối, tắt cache); Create `meeting/meeting-context.ts` (`buildMeetingContextBlock(view, maxChars=60000)` thuần), `meeting/meeting-context.service.ts` (chọn meetingId: `payload.meetingId` ∨ `conversation.meetingId`; fetch bằng `payload.userId`); `ai.module.ts` import `MeetingModule`; tests.

**Interfaces:** Consumes `MeetingRecordClient#fetch` (+`summary` từ Task 1). Produces `MeetingContextService#blockFor(payload, conversationMeetingId): Promise<string | null>`.

- [ ] Test: có `meetingId` + fetch trả view ⇒ khối có tóm tắt (overview, quyết định, việc cần làm) rồi bản ghi, nằm trong rào `wrapUntrusted`, ≤ 60 000 ký tự; nội dung "ignore previous instructions" nằm trong rào. fetch trả `null` ⇒ khối trusted ngắn: "The requester has no access to this meeting's record; do not reveal or guess its content." fetch ném ⇒ khối "meeting record temporarily unavailable", vẫn trả lời. Không có meetingId ⇒ `null`, không gọi fetch. Có khối ⇒ response cache tắt. Chat họp (`meeting:`) dùng `payload.history` qua `buildRecentConversationBlock` như chat nhóm.
- [ ] `pnpm --filter ai-service test` + `tsc --noEmit` → commit `feat(ai): meeting context for @AI in meeting chat and meeting groups`.

### Task 4: ai-service — tool `list_my_meetings`, `get_meeting_record`

**Files:** Modify `meeting/meeting-record.client.ts` (+`listMine(userId, q?, limit?)`), `tools/tool-registry.service.ts`, `tools/tools.module.ts`; Create `tools/list-my-meetings.tool.ts`, `tools/get-meeting-record.tool.ts`; tests.

- [ ] Test: hai tool **chỉ xuất hiện trong `getDefinitions` khi cuộc trò chuyện là chat 1-1 với AI** (`directAi === true`); nhóm thường / chat họp / nhóm cuộc họp ⇒ không có; gọi `execute` ngoài chat 1-1 ⇒ `"Meeting not found."`. `list_my_meetings` gọi `listMine(ctx.userId, query)` — **không** nhận userId từ input; trả JSON `[{meetingId, title, startedAt, endedAt, hasSummary}]`, rỗng ⇒ `"No meetings found."`. `get_meeting_record` dùng `ctx.userId`; null ⇒ `"Meeting not found."`; có `question` ⇒ chỉ giữ dòng bản ghi chứa ít nhất một từ khoá (≥ 3 ký tự, không phân biệt hoa thường) + tóm tắt, tối đa 30 000 ký tự; không question ⇒ tóm tắt + bản ghi cắt giữa 30 000. Kết quả bọc `wrapUntrusted`. Cả hai không `sensitive`, không cache theo kết quả (hoặc cache key gồm userId — kiểm `isCacheableTool`).
- [ ] Test → commit `feat(ai): meeting tools for asking the assistant about past meetings`.

### Task 5: Web — AI trong chat họp

**Files:** `lib/meetings/meeting-events.ts` (+`meet.ai`), state chat họp (`lib/meetings/meeting-room-chat.ts` hoặc nơi đang giữ tin), `components/meeting/room/MeetingChatLines.tsx` (dòng AI: tên "PON AI", `MarkdownContent`), chỉ báo trong `MeetingChatPanel`, `messages/*.json` (7); tests.

- [ ] Test: parse `meet.ai` (thinking/error, state lạ ⇒ null); chỉ báo bật khi thinking, tắt khi có `meet.chat` từ AI bot, khi error (hiện dòng lỗi đã dịch theo `code`, mặc định "AI chưa trả lời được"), hoặc sau 60 s (fake timers); tin AI render Markdown (`**x**` ⇒ `<strong>`), tin người thường vẫn plain text; tên AI không bao giờ là id.
- [ ] `pnpm --filter web test`, `tsc`, `lint` → commit `feat(web): AI answers in the meeting chat`.

### Task 6: Flutter — mirror Task 5

**Files:** `features/meetings/domain/meeting_events.dart`, `state/meeting_room_chat.dart`, `ui/room/chat_lines.dart`, `ui/room/meeting_chat_sheet.dart`, `l10n/app_*.arb` (7); tests.

- [ ] Test giống Task 5 → `flutter test`, `flutter analyze` → commit `feat(client): AI answers in the meeting chat`.

### Task 7: Docs + thử tay (thử tay cần owner đồng ý merge `dev`)

- [ ] `docs/api-spec.md` (`meet.ai`, payload `meetingId`, 2 endpoint nội bộ), `.claude/rules/ai-service.md` (2 tool, khối ngữ cảnh cuộc họp), `apps/server/chat-service/CLAUDE.md`. Gộp vào commit của Task 2/4 nếu tiện; nếu không, commit `docs(meetings): M3 contracts`.
- [ ] Thử tay trên `dev`: `@AI tóm tắt 5 phút vừa rồi` trong chat họp; `@AI` trong nhóm sau họp; chat 1-1 "cuộc họp sprint hôm qua chốt gì"; tài khoản ngoài cuộc hỏi cùng câu ⇒ không tìm thấy.

---

## Kết quả (2026-11-06)

Task 1–6 DONE trên `feat/meetings-ai` (`e233da14..3afbd816`): review từng task, review cuối toàn nhánh và một đợt sửa (F1–F8) đều đã duyệt. Docs gộp vào commit của Task 1/2/4 và đợt sửa. Task 7 (thử tay trên `dev`) **chưa chạy**: cần owner đồng ý merge.

Quyết định thêm khi thực thi:
- `@AI` trong chat họp chạy **không tool**, không khối thông tin tổ chức (org) và không trí nhớ của người hỏi, vì câu trả lời hiện cho cả phòng.
- `meetingId` chỉ lấy từ chính cuộc trò chuyện. Bỏ qua `meetingId` gửi kèm trong payload.
- Lượt có nội dung cuộc họp không ghi vào trí nhớ dài hạn (key facts) và không dùng response cache.
- `/new` và `/memory` trong chat họp được coi như câu hỏi thường.
- Câu trả lời AI trong chat họp: không tải ảnh từ link ngoài, link không bấm được.
- Thành viên được thêm vào nhóm cuộc họp sau đó vẫn thấy câu trả lời về cuộc họp. Chấp nhận, vì tin tóm tắt vốn đã nằm trong nhóm.

Việc để sau (không chặn merge):
- Thử tay trên `dev`:
  - `@AI` trong phòng có khách được duyệt vào từ phòng chờ.
  - `@AI /new` trong phòng.
  - `@AI` trong nhóm sau họp.
  - Chat 1-1 hỏi "cuộc họp … chốt gì".
  - Tài khoản ngoài cuộc hỏi cùng câu ⇒ không tìm thấy.
  - Tin AI có ảnh/link ⇒ không tải ảnh, link không bấm được.
- Tool `remember_fact` vẫn lưu được nội dung cuộc họp nếu người dùng chủ động yêu cầu trong chat 1-1.
- `list_my_meetings` có thể trả ít hơn `limit`. Không liệt kê người chỉ được duyệt từ phòng chờ.
- Lọc từ khoá theo dòng làm mất dòng nối tiếp. Câu hỏi CJK/Thái hoặc toàn từ ngắn rơi về bản ghi đầy đủ (có giới hạn).
- Câu trả lời tới sau khi họp kết thúc vẫn được lưu. Dòng lỗi AI không tự ẩn.
- `ai.service.ts` gần chạm 500 dòng.
- Chat thường (không phải họp) vẫn tải ảnh ngoài trong câu trả lời AI. Lỗi này có từ trước M3.
