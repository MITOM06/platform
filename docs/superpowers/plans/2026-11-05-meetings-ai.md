# Phòng họp AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Hai lớp:** Phần A là bước TDD đầy đủ cho **M1**. Phần B liệt kê task của **M2–M6** (file, interface,
> test chứng minh). Trước khi bắt đầu mỗi giai đoạn của Phần B, chạy `superpowers:writing-plans` để viết
> giai đoạn đó thành bước TDD dựa trên code đã có sau giai đoạn trước.

**Goal:** Người tạo cuộc họp bật "AI ghi chú". AI ghi nhận lời nói, chat, ghi chú, file và màn hình share.
Họp xong AI lập nhóm (người được mời + người đã vào) và đăng tóm tắt vào đó. Mọi người hỏi AI về cuộc họp
trong chat họp, trong nhóm và trong chat riêng 1-1.

**Architecture:** Hướng A: mỗi client tự STT mic của mình và gửi qua STOMP. Chụp màn hình share do máy đang
share làm. chat-service giữ **bản ghi cuộc họp** (`meeting_records`, Mongo) và là nơi **duy nhất** kiểm quyền
(`MeetingAccess.canReadRecords`). ai-service sinh tóm tắt/mô tả qua Redis pub/sub và đọc bản ghi qua endpoint
nội bộ của chat-service.

**Tech Stack:** Spring Boot 3 (Mongo, Redis, STOMP, Testcontainers) · NestJS ai-service · Next.js + Web Speech
API (vitest) · Flutter + `speech_to_text` (flutter_test).

**Spec:** `docs/superpowers/specs/2026-11-05-meetings-ai-design.md`

## Global Constraints

- Nhánh `feat/meetings-ai` cắt từ `origin/main`. Test trên `dev`, PR `feat/meetings-ai → main`. Không bao giờ merge `dev → main`.
- Cờ trên `Meeting.Settings` tên **`aiNotes`**, mặc định `false`. Cờ cấp cuộc họp **`aiNotesEverEnabled`**, mặc định `false`.
- Hành động host mới: **`AI_NOTES_ON`**, **`AI_NOTES_OFF`** (không cần target).
- Đoạn lời nói: trim, bỏ đoạn rỗng, cắt còn **500** ký tự. Chỉ nhận khi người gửi đang trong phòng **và** `settings.aiNotes == true`. Sai điều kiện thì bỏ im lặng (STT gửi liên tục, không trả lỗi).
- Collection **`meeting_records`**: `{id, meetingId, kind, userId, displayName, text, ts, createdAt}`. `kind ∈ {speech, file, screen}`. Index `(meetingId, ts)`.
- Trần ảnh màn hình mỗi cuộc họp: **60** (cấu hình `meetings.ai.screenFrameCap`). Tối đa 1 ảnh mỗi **15 s**.
- Quyền xem cuộc họp = **`MeetingAccess.canReadRecords`**, một bản duy nhất trong Java.
- ai-service **không** đọc `meeting_records` trực tiếp.
- Vision chỉ đi Anthropic API (`claude-cli` không đọc ảnh).
- Không hiện userId, JSON thô, URL nội bộ hay lỗi model ra UI. i18n đủ 7 locale (en, vi, zh, ja, ko, es, fr).
- UI ≤ 400 dòng/file, service ≤ 500 dòng/file. Web ↔ Flutter đồng bộ.
- Commit: chỉ `git add <file>` những file của task. Không `git add -A`/`.`.

## Review Focus

1. **Tắt AI giữa buổi rồi vẫn có đoạn lời nói tới** (client chậm, mạng trễ). Server phải bỏ, không ghi. Test ở Task 3.
2. **Người bị đá / đã rời phòng gửi đoạn lời nói** (STT còn chạy vài giây sau khi rời). Phải bỏ. Test ở Task 3.
3. **Trình duyệt không có Web Speech API (Firefox)** hoặc người dùng từ chối quyền. Người đó vẫn họp bình thường, chỉ báo AI vẫn hiện, không có lỗi bật lên. Test ở Task 5.
4. **Host bật AI giữa buổi.** Người đang trong phòng thấy banner một lần, người vào sau thấy chỉ báo, và `aiNotesEverEnabled` thành `true`. Test ở Task 2 (server), Task 4 và Task 6 (client).
5. **Sửa cuộc họp đã lên lịch** mà không đụng `aiNotes`. PATCH không được âm thầm tắt AI (DTO dạng boxed, `null` = giữ nguyên). Test ở Task 1.

---

# Phần A — M1: Công tắc, minh bạch, thu lời nói

### Task 1: `aiNotes` trong settings + `aiNotesEverEnabled` (chat-service)

**Files:**
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/model/Meeting.java` (`Settings` :91-102, field cấp cuộc họp)
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/meeting/MeetingSettingsDto.java`
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/meeting/MeetingRequests.java` (:98, :112, :143 — apply/merge/diff)
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/meeting/MeetingStore.java` (method mới)
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/meeting/MeetingRtcHandler.java:57` (gọi sau `markLive`)
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/meeting/MeetingResponse.java` (trả `aiNotesEverEnabled`)
- Test: `.../service/meeting/MeetingServiceSettingsPatchTest.java`, `.../service/meeting/MeetingStoreTest.java`, `.../service/meeting/MeetingRtcHandlerTest.java`

**Interfaces:**
- Produces: `Meeting.Settings#isAiNotes()`; `Meeting#isAiNotesEverEnabled()`; `MeetingSettingsDto(…, Boolean aiNotes)` (field thứ 6); `MeetingStore#markAiNotesUsed(String id): boolean`, chỉ ghi khi `status == LIVE && settings.aiNotes == true`, true khi lần này mới bật.

- [ ] **Step 1: Write the failing tests**

```java
// MeetingServiceSettingsPatchTest
@Test void createWithAiNotesStoresIt()            // settings.aiNotes=true ⇒ stored isAiNotes()==true
@Test void patchWithoutAiNotesKeepsIt()           // stored true, patch {waitingRoom:false} ⇒ aiNotes still true
@Test void patchCanTurnAiNotesOff()               // patch {aiNotes:false} ⇒ false
// MeetingStoreTest
@Test void markAiNotesUsedOnlyWhenLiveAndOn()     // SCHEDULED ⇒ false; LIVE+off ⇒ false; LIVE+on ⇒ true, then second call ⇒ false
// MeetingRtcHandlerTest
@Test void firstJoinOfAnAiNotesMeetingMarksItUsed() // verify(store).markAiNotesUsed("m1") after markLive
```

- [ ] **Step 2: Run, expect FAIL**

Run: `cd apps/server/chat-service && mvn -q test -Dtest='MeetingServiceSettingsPatchTest,MeetingStoreTest,MeetingRtcHandlerTest'`
Expected: compile errors (`isAiNotes`, `markAiNotesUsed` not defined).

- [ ] **Step 3: Implement**

`Settings.aiNotes` (mặc định false). `Meeting.aiNotesEverEnabled`. DTO thêm `Boolean aiNotes` cuối danh sách, `of()` điền đủ 6. `MeetingRequests` apply/merge/diff theo đúng cách của `attendeesCanEditNotes`. `markAiNotesUsed` là một `updateFirst` có điều kiện `status=LIVE, settings.aiNotes=true, aiNotesEverEnabled≠true`. `MeetingRtcHandler` gọi nó ngay sau `markLive`. `MeetingResponse` thêm `aiNotesEverEnabled`.

- [ ] **Step 4: Run, expect PASS** (cùng lệnh, cộng `mvn -q spotless:apply`)

- [ ] **Step 5: Commit** `feat(meetings): aiNotes setting and aiNotesEverEnabled`

### Task 2: Lệnh host `AI_NOTES_ON/OFF` (chat-service)

**Files:**
- Modify: `.../service/meeting/MeetingHostAction.java`, `.../service/meeting/MeetingHostService.java` (:60-73 switch, :122 `setting`, :174 `current`)
- Test: `.../service/meeting/MeetingHostActionTest.java`, `.../service/meeting/MeetingHostServiceTest.java`

**Interfaces:**
- Consumes: `MeetingStore#markAiNotesUsed` (Task 1).
- Produces: payload `meet.settings` có `aiNotes`. Host **và** co-host được dùng (giống `ATTENDEE_SCREEN_SHARE_*`).

- [ ] **Step 1: Write the failing tests**

```java
@Test void aiNotesActionsParseAndNeedNoTarget()   // parse("AI_NOTES_ON").get().needsTarget()==false
@Test void aiNotesOnSetsTheFieldBroadcastsAndMarksUsed()
    // store.update(..., set "settings.aiNotes" true); verify(events).settings(updated); verify(store).markAiNotesUsed("m1")
@Test void aiNotesOffDoesNotMarkUsed()             // verify(store, never()).markAiNotesUsed(any())
@Test void aiNotesOnWhenAlreadyOnIsANoOp()         // verifyNoInteractions on update/events
@Test void attendeeCannotToggleAiNotes()           // ApiException FORBIDDEN, như các lệnh setting khác
```

- [ ] **Step 2: Run, expect FAIL** — `mvn -q test -Dtest='MeetingHostActionTest,MeetingHostServiceTest'`
- [ ] **Step 3: Implement.** Thêm 2 hằng enum `(false)`. Trong `setting()` sau `events.settings(updated)`: field `settings.aiNotes` và `value==true` thì `store.markAiNotesUsed(id)`. `current()` thêm nhánh `settings.aiNotes`.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** `feat(meetings): host AI_NOTES_ON/OFF`

### Task 3: Thu lời nói vào `meeting_records` (chat-service)

**Files:**
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/model/MeetingRecord.java`
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/meeting/MeetingRecordService.java`
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/meeting/MeetingTranscriptCommand.java` (`record(String meetingId, String text, Long ts)`)
- Modify: `.../controller/MeetingWsController.java` (thêm `@MessageMapping("/meet.transcript")`)
- Test: `.../service/meeting/MeetingRecordServiceTest.java` (Testcontainers, theo mẫu `MeetingChatServiceTest` :50-92), `.../controller/MeetingWsControllerTest.java`

**Interfaces:**
- Consumes: `MeetingGuard#inRoom(UserPrincipal, String): Meeting` (ném `ApiException` khi không ở trong phòng), `MeetingPeople#profiles(Collection<String>): Map<String, PersonDto>`.
- Produces: `MeetingRecordService#appendSpeech(UserPrincipal caller, String meetingId, String text, Long ts): boolean` (true khi đã ghi); `MeetingRecordService#append(MeetingRecord r)` dùng cho M4/M5; `MeetingRecordService#list(String meetingId): List<MeetingRecord>` theo `ts` tăng dần; `MeetingRecord.Kind {SPEECH, FILE, SCREEN}`.

- [ ] **Step 1: Write the failing tests**

```java
@Test void storesTrimmedSpeechWithSpeakerName()   // "  chào  " ⇒ text "chào", kind SPEECH, displayName "An"
@Test void cutsAt500Chars()                        // 600 'a' ⇒ length 500
@Test void dropsBlank()                            // "   " ⇒ false, count 0
@Test void dropsWhenAiNotesOff()                   // meeting settings.aiNotes=false ⇒ false, count 0
@Test void dropsWhenCallerNotInRoom()              // guard.inRoom throws ⇒ false, no exception escapes, count 0
@Test void clampsClientTimestampToServerNow()      // ts in the future (+1h) ⇒ stored ts ≤ now
@Test void listReturnsInTsOrder()
// MeetingWsControllerTest
@Test void transcriptDelegatesAndNeverRepliesMeetError()  // verify(records).appendSpeech(...); verifyNoInteractions(events)
```

- [ ] **Step 2: Run, expect FAIL** — `mvn -q test -Dtest='MeetingRecordServiceTest,MeetingWsControllerTest'`
- [ ] **Step 3: Implement.** `appendSpeech` bắt `ApiException` của `guard.inRoom` rồi trả false. `ts` = `min(ts ?? now, now)`. `@CompoundIndex(def="{'meetingId':1,'ts':1}")`. Controller gọi thẳng, không qua `reply()`.
- [ ] **Step 4: Run, expect PASS.** Chạy cả suite: `mvn -q test` + `mvn -q spotless:check`.
- [ ] **Step 5: Commit** `feat(meetings): collect speech into meeting_records`

### Task 4: Web — công tắc, chỉ báo, màn chờ, banner, lệnh host

**Files:**
- Modify: `apps/web/lib/api/meeting-types.ts` (`MeetingSettings.aiNotes`, `Meeting.aiNotesEverEnabled?`, `HostAction` thêm 2 giá trị)
- Modify: `apps/web/lib/meetings/meeting-events.ts:80` (`settings()` đòi đủ 6 boolean)
- Modify: `apps/web/lib/meetings/room-host.ts`, `apps/web/lib/meetings/permissions.ts` (toggle `aiNotes` như `screenShare`)
- Modify: `apps/web/components/meeting/MeetingSettingsFields.tsx` (dòng `aiNotes` đầu tiên, có `desc`)
- Modify: `apps/web/components/meeting/room/RoomManageMenu.tsx:87` (thêm `SettingSwitch` aiNotes)
- Create: `apps/web/components/meeting/room/AiNotesIndicator.tsx` (chỉ báo thường trực + banner một lần khi `false → true`)
- Modify: `apps/web/components/meeting/room/MeetingRoom.tsx` (gắn indicator), `apps/web/components/meeting/room/PreJoinLobby.tsx` (dòng báo trước)
- Modify: `apps/web/messages/*.json` (7 file): `meeting.settingAiNotes`, `settingAiNotesDesc`, `aiNotesActive`, `aiNotesStarted`, `aiNotesPrejoin`
- Test: `apps/web/lib/meetings/__tests__/meeting-events.test.ts`, `__tests__/permissions.test.ts`, `apps/web/components/meeting/__tests__/AiNotesIndicator.test.tsx`

**Interfaces:**
- Consumes: payload `meet.settings` có `aiNotes` (Task 2).
- Produces: `MeetingSettings.aiNotes: boolean`; `rc.aiNotes` (cặp `AI_NOTES_ON`/`AI_NOTES_OFF`) trong `room-host.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
it('meet.settings without aiNotes is rejected')            // parse(...) === null
it('meet.settings carries aiNotes')                         // .settings.aiNotes === true
it('host and co-host can toggle aiNotes, attendee cannot')  // permissions
it('indicator shows while aiNotes is on')                   // getByText(t('aiNotesActive'))
it('banner shows once when aiNotes flips on mid-meeting')   // rerender false→true ⇒ banner; rerender true→true ⇒ still one
it('no banner when the room opens with aiNotes already on')
```

- [ ] **Step 2: Run, expect FAIL** — `cd apps/web && pnpm vitest run lib/meetings components/meeting`
- [ ] **Step 3: Implement** theo đúng mẫu của `allowAttendeeScreenShare`. Banner dùng toast sẵn có của room.
- [ ] **Step 4: Run, expect PASS** — cộng `pnpm tsc --noEmit && pnpm lint`
- [ ] **Step 5: Commit** `feat(web/meetings): AI notes switch, indicator and host toggle`

### Task 5: Web — STT trong phòng họp + "Tạm dừng ghi lời của tôi"

**Files:**
- Modify: `apps/web/lib/hooks/use-call-transcriber.ts`: tách lõi thành `useSpeechTranscriber(enabled: boolean, onFinal: (text: string) => void, lang?: string): { supported: boolean }`. `useCallTranscriber` giữ nguyên chữ ký và hành vi, gọi lõi.
- Create: `apps/web/lib/meetings/use-meeting-transcriber.ts`: `useMeetingTranscriber(meetingId: string | null, active: boolean): { supported: boolean; paused: boolean; setPaused(p: boolean): void }`. Publish `/app/meet.transcript {meetingId, text, ts}` khi `active && !paused`.
- Modify: `apps/web/components/meeting/room/MeetingRoom.tsx` (`active` = đang trong phòng && `settings.aiNotes`), `apps/web/components/meeting/room/ControlBarMore.tsx` (mục "Tạm dừng/Tiếp tục ghi lời của tôi", và "Trình duyệt này không hỗ trợ" khi `!supported`)
- Modify: `apps/web/messages/*.json`: `meeting.aiNotesPauseMine`, `aiNotesResumeMine`, `aiNotesUnsupported`
- Test: `apps/web/lib/meetings/__tests__/use-meeting-transcriber.test.ts`, `apps/web/lib/hooks/__tests__/use-call-transcriber.test.ts` (giữ hành vi cũ)

- [ ] **Step 1: Write the failing tests** (giả `window.SpeechRecognition` bằng class fake, mock `stompService.publish`)

```ts
it('publishes final results to /app/meet.transcript while active')
it('ignores interim results')
it('stops publishing when paused and resumes after')
it('stops when active turns false (AI notes switched off)')        // rec.stop called, no publish after
it('reports supported=false and never throws without SpeechRecognition')
it('call transcriber still publishes /app/call.transcript')          // regression
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run lib/meetings lib/hooks`
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run, expect PASS** + `pnpm tsc --noEmit && pnpm lint`
- [ ] **Step 5: Commit** `feat(web/meetings): speech capture in the room with pause`

### Task 6: Flutter — công tắc, chỉ báo, màn chờ, banner, lệnh host

**Files:**
- Modify: `apps/client/lib/features/meetings/domain/meeting_settings.dart` (field thứ 6 `aiNotes`, `fromJson` đòi đủ 6, `toJson`, `copyWith`, diff)
- Modify: `apps/client/lib/features/meetings/domain/meeting_models.dart` (`aiNotesEverEnabled`), `domain/meeting_room_models.dart:224` (`HostAction.aiNotesOn('AI_NOTES_ON')`, `aiNotesOff('AI_NOTES_OFF')`), `domain/room_host.dart`, `domain/permissions.dart`
- Modify: `apps/client/lib/features/meetings/ui/widgets/meeting_settings_fields.dart` (dòng đầu), `ui/room/room_manage_section.dart:144` (switch aiNotes)
- Create: `apps/client/lib/features/meetings/ui/room/ai_notes_indicator.dart`
- Modify: `ui/room/meeting_room_view.dart` (gắn indicator), `ui/room/room_banners.dart` (banner một lần), `ui/room/prejoin_screen.dart` (dòng báo trước)
- Modify: `apps/client/lib/l10n/app_*.arb` (7 file): `meetingSettingAiNotes`, `meetingSettingAiNotesDesc`, `meetingAiNotesActive`, `meetingAiNotesStarted`, `meetingAiNotesPrejoin`, rồi chạy `flutter gen-l10n`
- Test: `apps/client/test/features/meetings/domain/meeting_models_test.dart`, `domain/meeting_events_test.dart`, `domain/permissions_test.dart`, `ui/ai_notes_indicator_test.dart`

Các test là mirror của Task 4 (cùng tên, cùng assertion).

- [ ] **Step 1: Write the failing tests** (mirror Task 4)
- [ ] **Step 2: Run, expect FAIL** — `cd apps/client && flutter test test/features/meetings`
- [ ] **Step 3: Implement** theo mẫu `allowAttendeeScreenShare`
- [ ] **Step 4: Run, expect PASS** + `flutter analyze` 0 issue. Test Cuộc gọi `test/features/chat/calls/*` phải xanh **mà không sửa test**.
- [ ] **Step 5: Commit** `feat(mobile/meetings): AI notes switch, indicator and host toggle`

### Task 7: Flutter — STT trong phòng họp + tạm dừng

**Files:**
- Modify: `apps/client/lib/features/chat/domain/call_stt_service.dart`: tiêm `SpeechToText` qua constructor (mặc định `SpeechToText()`), tách `SpeechCapture` có `start(void Function(String text) onFinal): Future<bool>` / `stop()`. `CallSttService` giữ API cũ, dùng `SpeechCapture`. Không sửa `group_call_controller.dart`.
- Create: `apps/client/lib/features/meetings/state/meeting_transcriber.dart`: `MeetingTranscriber(StompService, SpeechCapture)`, gồm `sync({required String? meetingId, required bool active})`, `paused` (`ValueNotifier<bool>`), `supported` (`ValueNotifier<bool?>`). Publish `/app/meet.transcript`.
- Modify: `apps/client/lib/features/meetings/state/room_session_wiring.dart` (gọi `sync` khi vào/rời phòng và khi `settings.aiNotes` đổi), `ui/room/room_more_sheet.dart` (mục tạm dừng/không hỗ trợ)
- Modify: `app_*.arb`: `meetingAiNotesPauseMine`, `meetingAiNotesResumeMine`, `meetingAiNotesUnsupported`
- Test: `apps/client/test/features/meetings/state/meeting_transcriber_test.dart` (fake `SpeechCapture`, fake `StompService`)

- [ ] **Step 1: Write the failing tests** (mirror Task 5: publish khi active, dừng khi paused, dừng khi aiNotes tắt, unsupported không ném lỗi)
- [ ] **Step 2: Run, expect FAIL** — `flutter test test/features/meetings/state/meeting_transcriber_test.dart`
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run, expect PASS** — `flutter test` (toàn bộ) + `flutter analyze`
- [ ] **Step 5: Commit** `feat(mobile/meetings): speech capture in the room with pause`

### Task 8: Docs M1 + thử tay trên `dev`

**Files:** `docs/api-spec.md` (§ Meetings: `aiNotes`, `aiNotesEverEnabled`, `AI_NOTES_ON/OFF`, `/app/meet.transcript`), `docs/superpowers/plans/README.md` (thêm plan này; đánh dấu `2026-10-05-meetings-p2-ai.md` **SUPERSEDED**).

- [ ] **Step 1:** Cập nhật 2 file docs, commit `docs(meetings): M1 contract`.
- [ ] **Step 2:** Merge `feat/meetings-ai` vào `dev`, chạy stack local. Thử tay: tạo họp có AI trên web, vào bằng web (Chrome) + Android, nói vài câu, rồi kiểm `meeting_records` trong Mongo có đoạn của **cả hai** người, đúng tên. Host tắt AI ⇒ không thêm đoạn mới. Firefox vào ⇒ thấy "không hỗ trợ", họp bình thường.

---

# Phần B — M2–M6 (task, chi tiết hoá trước khi làm)

### M2 — Tóm tắt + nhóm sau họp
- **T2.1 chat-service `MeetingSummaryTrigger`:** `MeetingCloser.close` → nếu `aiNotesEverEnabled` thì claim `summaryState: null→PENDING` (nguyên tử) rồi publish `meet:summarize {meetingId}`. Test: đóng 2 lần chỉ publish 1 lần; cuộc họp chưa từng bật AI thì không publish.
- **T2.2 chat-service endpoint nội bộ** `GET /internal/meetings/{id}/record?userId=`: kiểm `canReadRecords`, trả `{meeting, records[], chat[], sharedNote, attendees[]}`. Xác thực service-to-service theo pattern có sẵn (kiểm trước khi viết). Test: người ngoài nhận 404, không phải 403.
- **T2.3 ai-service `meeting/meeting-summary.service.ts` + `meeting-subscriber.service.ts`:** dựa trên `call/call-summary.service.ts`, sinh `MeetingSummary` (spec §4.4.2) qua provider văn bản, publish `meet:summary:result`. Test: bản ghi rỗng ⇒ `empty`, không gọi model; JSON hỏng ⇒ `failed`.
- **T2.4 chat-service `MeetingSummaryResultListener` + `MeetingGroupService`:** lưu `meeting_summaries`, tính thành viên = host + co-host + `inviteeIds` + attendance − `removedIds` − bot (**không** mở rộng phòng ban). Tạo nhóm bằng đường hệ thống, gắn `Conversation.meetingId` + `Meeting.groupConversationId`. AI đăng `meeting_summary`, phát `meet.summary.ready`, gửi push. Dưới 2 người thì không tạo nhóm. Test: tập thành viên; tạo lại tóm tắt thì không tạo nhóm thứ hai.
- **T2.5 chat-service sweep `PENDING` > 10' → `FAILED`;** REST `GET /{id}/summary`, `POST /{id}/summary/regenerate` (host/co-host).
- **T2.6 Web + T2.7 Flutter:** card `meeting_summary` đọc cả định dạng mới lẫn cũ (`MeetingSummaryCard.tsx:16`); khối "Tóm tắt AI" + "Mở nhóm cuộc họp" + "Tạo lại" trên trang chi tiết.

### M3 — Hỏi AI về cuộc họp
- **T3.1 chat-service:** `@AI` trong `MeetingChatService.send` → `ai.requests` (`conversationId="meeting:{id}"`, thêm `meetingId`). `AiResponseListener` nhận `meeting:` prefix → lưu `MeetingMessage` của bot + phát `meet.chat`.
- **T3.2 ai-service:** payload có `meetingId`, **hoặc** conversation có `meetingId` ⇒ gọi endpoint nội bộ (T2.2) với `userId` người hỏi, rồi thêm khối "Cuộc họp" vào prompt.
- **T3.3 ai-service tools** `list_my_meetings`, `get_meeting_record`: cả hai qua endpoint nội bộ. Không có quyền ⇒ "không tìm thấy". Test: người ngoài cuộc không lấy được.
- **T3.4 Web + T3.5 Flutter:** tin AI trong chat họp render Markdown + trạng thái đang trả lời.

### M4 — File trong chat họp
- **T4.1 chat-service:** `MeetingMessage.attachment`, gửi qua upload sẵn có (tuân cờ `UPLOADS_REQUIRE_AUTH`), publish `meet:material {kind:file}`. **T4.2 ai-service:** trích xuất bằng `document-extractor` + `vision-describe` → `meet:material:result` → chat-service `append(kind FILE)`. Loại không hỗ trợ ⇒ ghi "không đọc được". **T4.3/T4.4** web + Flutter: nút đính kèm + card file trong chat họp.

### M5 — Màn hình share
- **T5.1 chat-service** `POST /{id}/screen-frames` (chỉ người đang share, kiểm trần 60, hết trần ⇒ ghi một dòng "đã đạt giới hạn ảnh"). **T5.2 ai-service** vision qua Anthropic API → `meet:material:result` → `append(kind SCREEN)` → xoá ảnh. **T5.3 web** (canvas từ track share, so sánh ảnh thu nhỏ, ≥ 15 s), **T5.4 Flutter Android** (`captureFrame`). iOS: không làm.

### M6 — QC
- `sync-check` web ↔ Flutter. Ma trận máy thật: Chrome + Firefox + Android + iPhone; bật AI giữa buổi; tắt ai-service lúc kết thúc ⇒ `FAILED` + tạo lại; người vắng hỏi AI riêng; người ngoài hỏi AI ⇒ bị từ chối. Cập nhật `api-spec.md`, `.claude/rules/ai-service.md`, `CLAUDE.md` (bảng kênh Redis mới), `plans/README.md`.
