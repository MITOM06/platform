# Phòng họp AI — M2: Tóm tắt + nhóm sau họp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Họp có AI kết thúc → ai-service tóm tắt bản ghi → chat-service lập nhóm (host + co-host + người được mời + người đã vào) và AI đăng tóm tắt vào nhóm; trang chi tiết họp có khối "Tóm tắt AI", "Mở nhóm cuộc họp", "Tạo lại".

**Architecture:** `MeetingCloser.close` claim `summaryState → PENDING` (nguyên tử, kèm `summaryAttempt` ngẫu nhiên) rồi publish Redis `meet:summarize`. ai-service đọc bản ghi qua endpoint nội bộ `GET /internal/meetings/{id}/record?userId=` (chat-service kiểm `canReadRecords`, khoá `X-Internal-Key`), sinh JSON qua Anthropic API (giống `CallSummaryService`), publish `meet:summary:result`. chat-service chốt kết quả bằng `findAndModify` theo `summaryAttempt` (một instance thắng), lưu `meeting_summaries`, tạo/tái dùng nhóm, đăng tin `meeting_summary`, gửi `meet.summary.ready` + push.

**Tech Stack:** Spring Boot 3 (Mongo, Redis, Testcontainers) · NestJS ai-service (jest) · Next.js (vitest, next-intl) · Flutter (Riverpod, flutter_test, ARB 7 locale).

**Spec:** `docs/superpowers/specs/2026-11-05-meetings-ai-design.md` (§4.4, §4.5, §4.6). Plan cha: `docs/superpowers/plans/2026-11-05-meetings-ai.md` (Global Constraints ở đó vẫn áp dụng).

## Global Constraints

- Nhánh `feat/meetings-ai` (tiếp M1). Commit chỉ `git add <file>` của task; `git diff --staged` trước khi commit.
- Kênh Redis: **`meet:summarize`** `{meetingId, attempt, requesterId}` (S→ai) · **`meet:summary:result`** `{meetingId, attempt, status: "ok"|"empty"|"failed", summary?}` (ai→S).
- `Meeting` thêm: **`summaryState`** (`null | PENDING | DONE | EMPTY | FAILED`), **`summaryAttempt`** (String UUID), **`summaryRequestedAt`** (Instant), **`groupConversationId`** (String). Chỉ đổi qua update nguyên tử trong `MeetingStore`.
- `Conversation` thêm **`meetingId`** (String, null với nhóm thường).
- Collection **`meeting_summaries`**: `{id, meetingId, attempt, status, summary (object), createdAt}`; index `(meetingId, createdAt)`.
- `MeetingSummary` (từ ai-service): `{overview: string, keyPoints: string[], decisions: string[], actionItems: {text, assigneeName: string|null}[], fromMaterials: string[], language: string}`.
- Nội dung tin `meeting_summary` mới = `MeetingSummary` + `{meetingId, title, attendees: string[] (tên), durationSec}`. Card cũ (gọi nhóm) có `actionItems: string[]` — vẫn phải đọc được.
- Thành viên nhóm = host + `coHostIds` + `inviteeIds` + mọi `attendance.userId`, bỏ trùng, bỏ `removedIds`, bỏ `AI_BOT_USER_ID`. **Không** mở rộng `departmentId`. < 2 người ⇒ không tạo nhóm.
- Tên nhóm: `"Họp: " + title` (title rỗng ⇒ `"Họp: " + code`), cắt còn **100** ký tự. Admin = host. Thành viên vào thẳng (`pendingMembers` rỗng).
- `PENDING` quá **10 phút** ⇒ `FAILED` (sweep mỗi 60 s).
- Endpoint nội bộ: thiếu/sai `X-Internal-Key`, hoặc server chưa cấu hình key ⇒ **401**; không có quyền hoặc không có cuộc họp ⇒ **404** (không bao giờ 403).
- Trần dữ liệu endpoint nội bộ: **4000** đoạn bản ghi mới nhất, **1000** tin chat mới nhất. ai-service cắt prompt còn **120 000** ký tự (bỏ phần giữa, chèn `[…]`).
- Lỗi mới: **`MEETING_SUMMARY_UNAVAILABLE`** (409: cuộc họp chưa kết thúc hoặc chưa từng bật AI), **`MEETING_SUMMARY_PENDING`** (409: đang tạo).
- Không hiện userId / JSON thô / lỗi model ra UI. i18n 7 locale (en, vi, zh, ja, ko, es, fr). UI ≤ 400 dòng/file, service ≤ 500.

## Rulings (quyết định của Claude khi chi tiết hoá — owner xem lại)

1. **Tóm tắt đi thẳng Anthropic API**, như `CallSummaryService` (không qua `claude-cli`): `ClaudeCliClient` chỉ có vòng chat stream, không có lệnh một-lần. Giá nếu sai: mỗi cuộc họp tốn một lần gọi API trả tiền (~vài cent).
2. **Job tóm tắt đọc bản ghi bằng quyền host** (`requesterId = hostId`), không mở cửa "đọc hệ thống" không kiểm quyền trên endpoint nội bộ. Giá nếu sai: không có.
3. **`attempt` (UUID) trong mỗi yêu cầu**: chặn kết quả cũ ghi đè lần tạo lại mới, và là khoá claim ở cả hai service.
4. **Thành viên vào nhóm thẳng**, không qua lời mời chờ chấp nhận. Giá nếu sai: nhóm hiện ngay trong danh sách chat của người được mời mà họ không chọn.
5. `meet.summary.ready` gửi qua **`/user/queue/meeting`** tới thành viên nhóm + host/co-host (người đã rời phòng không còn nghe `/topic/meeting/{id}`).

## Review Focus

1. **Hai instance cùng nhận `meet:summary:result`** (pub/sub fan-out) ⇒ chỉ một nhóm, một tin. Test ở Task 4 (gọi listener 2 lần cùng attempt).
2. **Kết quả của lần cũ tới sau khi host bấm "Tạo lại"** ⇒ bị bỏ, không đổi state. Test ở Task 4.
3. **Người ngoài cuộc gọi endpoint nội bộ với `userId` của họ** ⇒ 404 giống hệt cuộc họp không tồn tại. Test ở Task 2.
4. **Cuộc họp chỉ có host vào, không mời ai** ⇒ không tạo nhóm, tóm tắt vẫn có ở trang chi tiết. Test ở Task 4.
5. **Tin `meeting_summary` cũ (gọi nhóm, `actionItems: string[]`) và mới (object)** đều hiện đủ trên cả hai client. Test ở Task 6 và Task 7.

---

### Task 1: Trạng thái tóm tắt + kích hoạt khi kết thúc họp (chat-service)

**Files:**
- Modify: `model/Meeting.java` (4 trường ở Global Constraints), Create: `model/MeetingSummaryState.java` (enum)
- Modify: `service/meeting/MeetingStore.java`, `service/meeting/MeetingCloser.java`, `dto/meeting/MeetingResponse.java`, `service/meeting/MeetingMapper.java`
- Create: `service/meeting/MeetingSummaryTrigger.java`
- Test: `MeetingStoreTest` / `MeetingCloserTest` / `MeetingSummaryTriggerTest` (theo vị trí test meeting hiện có)

(Đường dẫn Java tính từ `apps/server/chat-service/src/main/java/com/platform/chatservice/`.)

**Interfaces:**
- Produces: `MeetingStore#claimSummary(String id, String attempt, Instant now): boolean` — chỉ khi `summaryState == null` **và** `aiNotesEverEnabled`. `MeetingStore#claimRegenerate(String id, String attempt, Instant now): boolean` — chỉ khi `status == ENDED`, `aiNotesEverEnabled`, `summaryState ∈ {DONE, EMPTY, FAILED}`. `MeetingStore#finishSummary(String id, String attempt, MeetingSummaryState state): Optional<Meeting>` — chỉ khi `summaryState == PENDING` và `summaryAttempt == attempt`, trả bản **sau** update. `MeetingStore#setGroupConversation(String id, String convId): boolean` — chỉ khi đang null. `MeetingStore#failStaleSummaries(Instant cutoff): long`.
- Produces: `MeetingSummaryTrigger#requestFirst(Meeting m): boolean` (claim + publish), `#requestAgain(Meeting m): boolean` (claimRegenerate + publish). Hằng `SUMMARIZE_CHANNEL = "meet:summarize"`.
- Produces: `MeetingResponse.summaryState` (String hoặc null) và `MeetingResponse.groupConversationId` — cả hai null với guest (cùng cách M1 ẩn `aiNotesEverEnabled`).

- [ ] **Step 1: Test store** — `claimSummaryOnlyOnce` (gọi 2 lần ⇒ true, false; state PENDING, attempt = lần đầu); `claimSummaryRefusedWhenAiNeverEnabled`; `finishSummaryIgnoresStaleAttempt` (claim "a", claimRegenerate không được vì đang PENDING ⇒ false; finish "b" ⇒ empty; finish "a" ⇒ DONE); `claimRegenerateAfterFailed`; `failStaleSummariesFlipsOnlyOldPending` (PENDING 11' ⇒ FAILED, PENDING 1' giữ nguyên, DONE giữ nguyên).
- [ ] **Step 2: Test trigger + closer** — `closePublishesSummarizeOnceWhenAiWasOn` (close 2 lần ⇒ đúng 1 message trên `meet:summarize`, payload có `meetingId`, `attempt`, `requesterId == hostId`); `closeDoesNotPublishWhenAiNeverOn`. Publish lỗi (Redis ném) ⇒ `close` vẫn trả true, state ở PENDING (sweep sẽ chuyển FAILED).
- [ ] **Step 3:** Chạy test ⇒ FAIL.
- [ ] **Step 4:** Cài đặt. `MeetingCloser.close` gọi `trigger.requestFirst(before)` **sau** `events.ended(...)`, bọc try/catch để lỗi tóm tắt không làm hỏng việc kết thúc họp. Publish bằng `StringRedisTemplate.convertAndSend` + `ObjectMapper` (như `CallService` dòng ~378).
- [ ] **Step 5:** `mvn -q test -Dtest='Meeting*'` ⇒ PASS.
- [ ] **Step 6:** Commit `feat(meetings): claim and request an AI summary when an AI meeting ends`.

### Task 2: Endpoint nội bộ đọc bản ghi cuộc họp (chat-service)

**Files:**
- Create: `controller/InternalMeetingController.java`, `security/InternalKeyGuard.java`, `service/meeting/MeetingRecordReader.java`, `dto/meeting/MeetingRecordView.java`
- Modify: `config/SecurityConfig.java` (permitAll `GET /internal/meetings/**` — xác thực do `InternalKeyGuard` làm)
- Test: `InternalMeetingControllerTest` (MockMvc), `MeetingRecordReaderTest`

**Interfaces:**
- Consumes: `MeetingAccess.canReadRecords(Meeting, userId, departmentIds, admitted)`, `MeetingLobby.isAdmitted`, `MeetingRecordService.list(meetingId)` (M1), `meeting_messages`, `meeting_notes` (scope SHARED).
- Produces: `GET /internal/meetings/{id}/record?userId=` → 200:
  ```
  { meeting: {id, title, code, startedAt, endedAt, hostName},
    attendees: [{displayName}],                       // bỏ trùng theo userId
    records:  [{kind, displayName, text, ts}],         // ≤ 4000 mới nhất, xếp ts tăng dần
    chat:     [{senderName, content, createdAt}],      // ≤ 1000 mới nhất, tăng dần; bỏ tin của AI bot
    sharedNote: string | null }
  ```
  Không trả userId nào. `InternalKeyGuard#check(HttpServletRequest)` so `X-Internal-Key` với `app.connector.internal-key` bằng `MessageDigest.isEqual` (cùng khoá `UploadReaderResolver` đang dùng) — tách hàm so sánh dùng chung thay vì chép.
- Produces: `MeetingRecordReader#read(String meetingId, String userId): Optional<MeetingRecordView>` (Task 3 của M3 dùng lại).

- [ ] **Step 1: Test** — `rejectsMissingKey` (401), `rejectsWrongKey` (401), `rejectsWhenServerKeyBlank` (401 dù header gửi chuỗi rỗng); `outsiderGets404` và `unknownMeetingGets404` trả **cùng** body; `removedUserGets404`; `departmentMemberCanRead` (user không được mời đích danh, `users.departmentIds` chứa `departmentId` của cuộc họp — lưu ObjectId như auth-service); `attendeeReadsRecordsChatAndNote` (đủ 4 phần, không chuỗi nào trong JSON khớp userId của ai); `capsRecordsToNewest4000` (4001 đoạn ⇒ 4000, đoạn cũ nhất bị bỏ).
- [ ] **Step 2:** Chạy ⇒ FAIL.
- [ ] **Step 3:** Cài đặt. Phòng ban của `userId` đọc từ `users.departmentIds` (ObjectId → hex) qua `MongoTemplate` như `MeetingPeople` đang truy vấn `users`. Tên người gửi chat: dùng cách `MeetingRecordService` (M1) đang resolve tên.
- [ ] **Step 4:** `mvn -q test -Dtest='InternalMeeting*,MeetingRecordReader*'` ⇒ PASS.
- [ ] **Step 5:** Commit `feat(meetings): internal record endpoint for ai-service behind the internal key`.

### Task 3: ai-service — sinh tóm tắt cuộc họp

**Files (trong `apps/server/ai-service/src/`):**
- Create: `meeting/meeting.module.ts`, `meeting/meeting.constants.ts`, `meeting/meeting-record.client.ts`, `meeting/meeting-summary.service.ts`, `meeting/meeting-subscriber.service.ts`, `meeting/meeting-prompt.ts`
- Test: `meeting/meeting-summary.service.spec.ts`, `meeting/meeting-record.client.spec.ts`, `meeting/meeting-prompt.spec.ts`
- Modify: `app.module.ts` (import module); `CLAUDE.md` gốc repo — bảng "Redis Pub/Sub" thêm 2 dòng `meet:summarize`, `meet:summary:result`.

**Interfaces:**
- Consumes: Task 2 endpoint; `config.chat.internalUrl`, `config.connector.internalApiKey` (header `X-Internal-Key`).
- Produces: `MeetingRecordClient#fetch(meetingId: string, userId: string): Promise<MeetingRecordView | null>` (404 ⇒ null; lỗi mạng/5xx ⇒ ném; timeout 10 s). M3 dùng lại.
- Produces: `MeetingSummaryService#summarize(msg: {meetingId, attempt, requesterId}): Promise<void>` → publish `meet:summary:result`.
- Produces: `renderMeetingPrompt(view: MeetingRecordView, maxChars = 120_000): string` và `parseMeetingSummary(raw: string): MeetingSummary | null` (thuần, test được).

- [ ] **Step 1: Test** — `summarize` claim Redis `meet:summarize:claim:{meetingId}:{attempt}` (NX, EX 3600); claim thua ⇒ không fetch, không publish. Bản ghi + chat + ghi chú đều rỗng ⇒ publish `status: "empty"`, **không** gọi model. `fetch` trả null hoặc ném ⇒ `failed`. Model trả JSON hỏng ⇒ `failed`. Model trả JSON trong rào ```json ⇒ `ok` với `summary` đã chuẩn hoá (thiếu mảng ⇒ `[]`, `actionItems` dạng string ⇒ `{text, assigneeName: null}`, `assigneeName` rỗng ⇒ null). `renderMeetingPrompt` quá 120 000 ký tự ⇒ giữ đầu + cuối, có `[…]`, độ dài ≤ max. Prompt không chứa userId (view không có).
- [ ] **Step 2:** Chạy `pnpm --filter ai-service test -- meeting` ⇒ FAIL.
- [ ] **Step 3:** Cài đặt theo khuôn `call/call-summary.service.ts` + `call/call-subscriber.service.ts` (connection subscriber riêng, model `config.anthropic.model`, ghi usage lên bot user). Prompt yêu cầu trả **chỉ** JSON đúng `MeetingSummary`, viết bằng ngôn ngữ chiếm đa số trong bản ghi, `fromMaterials` để `[]` khi không có đoạn `FILE`/`SCREEN`. Tách prompt ra `meeting-prompt.ts` để service ≤ 500 dòng.
- [ ] **Step 4:** Test ⇒ PASS; `pnpm --filter ai-service exec tsc --noEmit` sạch.
- [ ] **Step 5:** Commit `feat(ai): summarize finished meetings from the chat-service record`.

### Task 4: Nhận kết quả → lưu → nhóm → đăng tóm tắt (chat-service)

**Files:**
- Create: `service/meeting/MeetingSummaryResultListener.java`, `service/meeting/MeetingGroupService.java`, `service/meeting/MeetingGroupMembers.java` (thuần), `model/MeetingSummaryDoc.java` (`@Document("meeting_summaries")`)
- Modify: `config/RedisListenerConfig.java` (`ChannelTopic("meet:summary:result")`), `model/Conversation.java` (`meetingId`), `service/ConversationService.java` (+`createMeetingGroup`), `service/AiMessageService.java` (+`postMeetingSummary` trả `MessageResponse`), `service/meeting/MeetingEvents.java` (+`summaryReady`), index trong `MongoIndexInitializer`
- Test: `MeetingGroupMembersTest`, `MeetingSummaryResultListenerTest` (Testcontainers)

**Interfaces:**
- Consumes: Task 1 `finishSummary`, `setGroupConversation`.
- Produces: `MeetingGroupMembers.of(Meeting m): List<String>` (thứ tự: host trước). `ConversationService#createMeetingGroup(String hostId, String name, List<String> members, String meetingId): ConversationResponse` (không qua REST, không kiểm phòng ban, `pendingMembers` rỗng). `MeetingGroupService#ensureGroup(Meeting m): Optional<String>` — trả nhóm sẵn có nếu `groupConversationId` còn tồn tại, không thì tạo (≥ 2 thành viên) và `setGroupConversation`. `MeetingEvents#summaryReady(Meeting m, Collection<String> userIds)` → `/user/queue/meeting` `{type:"meet.summary.ready", meetingId, summaryState, groupConversationId}`.
- Produces: `MeetingSummaryStore#latest(meetingId): Optional<MeetingSummaryDoc>` (Task 5 dùng).

- [ ] **Step 1: Test members** — host + co-host + invitee + attendee (2 phiên cùng người ⇒ 1) − removed − AI bot; `departmentId` có giá trị nhưng không ai thuộc phòng ban được thêm.
- [ ] **Step 2: Test listener** — `okCreatesGroupAndPostsSummary` (nhóm `meetingId` đúng, tên `"Họp: Sprint review"`, admin host, tin `meeting_summary` của `AI_BOT_USER_ID` có `meetingId`, `title`, `attendees` là **tên**, `durationSec`); `sameResultTwiceMakesOneGroupOneMessage`; `staleAttemptIgnored`; `hostAloneNoGroup` (state DONE, `groupConversationId` null, doc vẫn lưu); `regenerateReusesGroup` (lần 2 attempt mới ⇒ cùng nhóm, 2 tin); `groupDeletedThenRegenerateCreatesNew`; `emptyAndFailedSetStateWithoutGroup`; tên quá 100 ký tự bị cắt.
- [ ] **Step 3:** Chạy ⇒ FAIL.
- [ ] **Step 4:** Cài đặt. Thứ tự trong listener: `finishSummary` (thua ⇒ return) → lưu doc → nếu `ok`: `ensureGroup` → nếu có nhóm: tin hệ thống `system.group.created` (như `ConversationController.broadcastSystem`) rồi `postMeetingSummary` + `notificationService.notifyNewMessage(AI_BOT_USER_ID, msg)` (push) → `events.summaryReady` tới thành viên + host/co-host. Lỗi ở bước nhóm/đăng tin ⇒ log, state vẫn DONE (tạo lại sẽ thử nhóm lần nữa).
- [ ] **Step 5:** `mvn -q test` ⇒ PASS (toàn bộ, vì đụng `ConversationService`/`AiMessageService`).
- [ ] **Step 6:** Commit `feat(meetings): post the AI summary into a meeting group`.

### Task 5: Sweep + REST tóm tắt + docs API (chat-service)

**Files:**
- Create: `service/meeting/MeetingSummarySweep.java`, `service/meeting/MeetingSummaryService.java`, `dto/meeting/MeetingSummaryResponse.java`
- Modify: `controller/MeetingController.java`, `exception/ErrorCodes.java`, `docs/api-spec.md` (§ Meetings), `apps/server/chat-service/CLAUDE.md` (trường Meeting mới, `meeting_summaries`, kênh Redis)
- Test: `MeetingSummaryServiceTest`, `MeetingSummarySweepTest`, controller test theo khuôn hiện có

**Interfaces:**
- `GET /api/meetings/{id}/summary` (quyền `guard.records`) → `{state, summary?, createdAt?, groupConversationId?, inGroup: boolean}`; `summary` = object `MeetingSummary` của doc mới nhất. `groupConversationId` chỉ trả khi `inGroup`.
- `POST /api/meetings/{id}/summary/regenerate` (host/co-host, 202) → `{state:"PENDING"}`. Chưa kết thúc / chưa từng bật AI ⇒ 409 `MEETING_SUMMARY_UNAVAILABLE`; đang PENDING ⇒ 409 `MEETING_SUMMARY_PENDING`; attendee ⇒ 403 `MEETING_FORBIDDEN`.
- Sweep: `@Scheduled(fixedDelayString = "${app.meeting.sweep-interval-ms:60000}")` → `failStaleSummaries(now - 10')`.

- [ ] **Step 1: Test** — outsider GET ⇒ 403 `MEETING_FORBIDDEN`; người vắng (được mời) GET ⇒ 200 có `summary`, `inGroup` đúng; regenerate 3 lỗi trên + thành công publish 1 message; sweep đổi PENDING cũ ⇒ FAILED.
- [ ] **Step 2:** FAIL → cài đặt → `mvn -q test` PASS.
- [ ] **Step 3:** Cập nhật docs. Commit `feat(meetings): summary REST, regenerate and stale sweep`.

### Task 6: Web — card đọc 2 định dạng + khối "Tóm tắt AI"

**Files (trong `apps/web/`):**
- Create: `lib/meetings/meeting-summary.ts` (+ `__tests__/meeting-summary.test.ts`), `components/meeting/detail/MeetingAiSummary.tsx` (+ test)
- Modify: `components/chat/MeetingSummaryCard.tsx`, `lib/api/types.ts`, `lib/api/meeting-types.ts` (`summaryState`, `groupConversationId`), API client meetings (2 hàm), `lib/realtime/meeting-queue.ts` (`meet.summary.ready` ⇒ invalidate query tóm tắt + chi tiết), `app/(main)/meetings/[id]/page.tsx`, `messages/*.json` (7 file)

**Interfaces:**
- Produces: `normalizeSummary(raw: unknown): NormalizedSummary | null` — `{overview, keyPoints, decisions, actionItems: {text, assigneeName|null}[], fromMaterials, attendees, durationSec, title|null}`; `actionItems` string ⇒ object; phần tử sai kiểu bị bỏ. Card và khối chi tiết dùng chung.
- Mirror Flutter: `domain/meeting_summary.dart` (Task 7).

- [ ] **Step 1: Test** — normalize định dạng cũ (string) và mới (object); card hiện mục "Quyết định" và "Từ tài liệu" chỉ khi có; action item có người phụ trách hiện "— Tên". Khối chi tiết: PENDING ⇒ "AI đang tóm tắt…"; EMPTY ⇒ "Cuộc họp không có nội dung để tóm tắt"; FAILED ⇒ "Chưa tạo được tóm tắt" + nút tạo lại (chỉ host/co-host); DONE ⇒ nội dung + "Mở nhóm cuộc họp" (chỉ khi `inGroup`) + "Tạo lại" (host/co-host); `state == null` (họp không bật AI) ⇒ không render gì; lỗi 409 khi tạo lại ⇒ toast đã dịch, không phải text lỗi.
- [ ] **Step 2:** FAIL → cài đặt → `pnpm --filter web test`, `tsc --noEmit`, `lint` sạch.
- [ ] **Step 3:** Commit `feat(web): meeting AI summary block and new summary card format`.

### Task 7: Flutter — mirror Task 6

**Files (trong `apps/client/lib/`):**
- Create: `features/meetings/domain/meeting_summary.dart` (+ test), `features/meetings/ui/widgets/detail/meeting_ai_summary.dart` (+ widget test)
- Modify: `features/chat/ui/widgets/meeting_summary_card.dart`, `features/meetings/domain/meeting_models.dart`, `features/meetings/data/meetings_repository.dart`, `features/meetings/domain/meeting_events.dart` (+ nơi xử lý queue), `features/meetings/ui/meeting_detail_screen.dart`, `l10n/app_*.arb` (7) + gen-l10n

- [ ] **Step 1: Test** — cùng ca với Task 6 (normalize 2 định dạng, 5 trạng thái khối, quyền nút).
- [ ] **Step 2:** FAIL → cài đặt → `flutter test`, `flutter analyze` sạch.
- [ ] **Step 3:** Commit `feat(client): meeting AI summary block and new summary card format`.

### Task 8: Thử tay trên `dev` (cần owner đồng ý merge vào `dev`)

- [ ] Merge `feat/meetings-ai` vào `dev`, chạy stack. Họp có AI 2 người (web + Android) + 1 người được mời vắng ⇒ kết thúc ⇒ ≤ 1 phút có nhóm 3 người, tin tóm tắt đúng tên, push tới máy vắng. Tắt ai-service rồi kết thúc họp ⇒ 10' sau FAILED ⇒ bật lại, host bấm tạo lại ⇒ tin mới vào nhóm.

---

## Kết quả (2026-11-06)

Task 1–7 DONE trên `feat/meetings-ai` (`60f16528..ebf3d4ba`), review từng task + review cuối toàn nhánh + một đợt sửa (3 Important, 7 Minor) đã duyệt. Task 8 (thử tay trên `dev`) **chưa chạy**: cần owner đồng ý merge vào `dev`.

Quyết định thêm khi thực thi: `meet.summary.ready` dùng khoá `event` như mọi sự kiện họp; `meeting_summaries` chỉ lưu bản thành công; PENDING/FAILED vẫn hiện bản tóm tắt cũ bên dưới dòng trạng thái; "Mở nhóm cuộc họp" hiện ở mọi trạng thái khi người xem thuộc nhóm; cuộc họp có AI mà `summaryState` null ⇒ GET báo FAILED và cho tạo lại; sweep báo `meet.summary.ready` cho host/co-host; gọi Anthropic timeout 180 s, 1 lần retry.

Việc còn để sau (không chặn merge):
- Thử tay trên `dev`: curl chặn `/api/chat/internal/...` (cả `%69nternal`, `//internal`, `/Internal`) qua Caddy; push tới máy người được mời mà vắng; tắt ai-service ⇒ sau 10' FAILED ⇒ tạo lại.
- Tên người tham dự trong tin tóm tắt gồm cả người bị đá (họ đã vào họp) — owner quyết.
- Whitelist 6 khoá khi chép `summary` từ ai-service; nhóm còn < 2 người vẫn bị coi là sống.
- Regenerate chưa có cooldown (chi phí bị chặn vì chỉ một lần chạy cùng lúc).
- Thiếu test: lost link race, `inGroup=false` khi nhóm mất, nhánh `departmentIds` lưu dạng string.
- `call-summary.service.ts` (gọi nhóm, có từ trước) chưa rào prompt injection như tóm tắt họp.
- Subscriber Redis lỗi lúc boot chỉ log, không retry (giống subscriber gọi nhóm).
