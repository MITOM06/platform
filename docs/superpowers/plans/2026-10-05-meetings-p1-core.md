# Phòng họp P1 — Core & Collaboration (kiểu Google Meet / Teams) — Milestone Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Plan mức milestone.** Model, contract REST/STOMP, quy tắc quyền và tên file ở đây là **chốt**.
> Trước mỗi milestone, chạy `superpowers:writing-plans` để viết nó thành các bước TDD có code đầy đủ
> trên code thật lúc đó. Phụ thuộc: `2026-10-05-rtc-foundation-livekit.md` đã merge. **Không**
> phụ thuộc plan Calls — hai plan chạy song song được, chỉ dùng chung `LiveKitSession` (ai làm
> trước thì tạo, người sau dùng lại; xem C2/C3 của plan Calls cho chữ ký).

**Goal:** Tính năng mới **Phòng họp**: tạo họp ngay hoặc lên lịch, vào bằng link `/meet/{code}`, màn chờ chọn thiết bị, phòng chờ do host duyệt, vai trò host/co-host, giơ tay theo thứ tự, reaction, chat trong họp, ghi chú chung + ghi chú riêng, share màn hình, đổi layout, quyền host — trên cả web và Flutter.

**Architecture:** Domain mới `Meeting` trong chat-service (tách khỏi `CallSession`, spec D7), luôn chạy trên LiveKit (room `meet_{id}`). `MeetingService` cài `RtcRoomEventHandler` để ghi điểm danh và trạng thái phòng từ webhook. Giơ tay, chat, ghi chú, lệnh host đi qua chat-service (cần lưu hoặc cần quyền); reaction và "đang nói" đi thẳng qua LiveKit. Client dựng UI riêng theo `docs/design-system.md` trên `LiveKitSession` dùng chung với Cuộc gọi.

**Tech Stack:** Spring Boot 3 · MongoDB · Redis · STOMP · Next.js App Router + TanStack Query + Zustand · Flutter + Riverpod + go_router · `livekit-client` / `livekit_client`.

**Spec:** `docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md` §1, §3 (D7–D11), §4.3.

## Global Constraints

- Nhánh `feat/meetings` cắt từ `origin/main`; test trên `dev` trước khi PR.
- Đồng bộ web ↔ Flutter (`.claude/rules/sync.md`): cùng màn, cùng event, cùng giới hạn.
- i18n 7 locale: web namespace `meeting` trong `messages/*.json`; Flutter prefix `meeting` trong `app_*.arb`.
- Không lộ dữ liệu thô: không hiện userId, tên room `meet_*`, lỗi LiveKit; mã phòng `code` **được** hiện (người dùng cần nó).
- Ngày giờ format theo locale bằng `intl` / `Intl.DateTimeFormat`, không hardcode pattern.
- Giới hạn: tối đa **25** người trong phòng; tiêu đề ≤ 120 ký tự; mô tả ≤ 2000; chat ≤ 2000 ký tự/tin; ghi chú ≤ 50 000 ký tự; tối đa 100 người được mời đích danh.
- Reaction cho phép đúng 6 emoji: `👍 ❤️ 😂 😮 👏 🎉`; client gửi tối đa 1 reaction/giây.
- Phòng họp **ENDED là kết thúc hẳn**; "Họp lại" tạo cuộc họp mới với cùng người mời.
- Java ≤ 500 dòng, UI ≤ 400 dòng; `mvn spotless:apply` sau mỗi lần sửa Java.

## Review Focus

1. **Người không được mời mở link khi host chưa vào** — vào phòng chờ, thấy "Đang chờ người tổ chức cho vào"; host vào thì thấy ngay yêu cầu chờ.
2. **Người bị mời ra mở lại link** — bị từ chối với thông báo rõ, không vào phòng chờ lại được trong cuộc họp đó.
3. **Hai người cùng sửa ghi chú chung** — người lưu sau nhận 409, UI báo "Có bản mới hơn" và cho xem/merge, **không** mất chữ đang gõ.
4. **Host rời phòng mà không bấm Kết thúc** — phòng tiếp tục; nếu còn co-host thì co-host điều khiển; nếu không còn host/co-host, người được mời vẫn họp bình thường; phòng tự ENDED khi trống 5 phút (`empty_timeout`).
5. **Mở link của cuộc họp đã kết thúc** — trang chi tiết (ghi chú, điểm danh), không phải lỗi.

---

## Model (chat-service, Mongo)

```java
@Document("meetings")
Meeting {
  String id;
  @Indexed(unique = true) String code;        // "abc-defg-hjk": 10 chữ thường, bỏ i l o, SecureRandom, retry khi trùng
  String title; String description;
  String hostId; List<String> coHostIds;
  List<String> inviteeIds;                    // ≤ 100
  String departmentId;                        // optional: cả phòng ban coi như được mời
  Instant scheduledStart, scheduledEnd;       // null = họp ngay
  MeetingStatus status;                       // SCHEDULED | LIVE | ENDED
  Settings settings;                          // waitingRoom=true, muteOnEntry=false,
                                              // allowAttendeeScreenShare=true, attendeesCanEditNotes=true,
                                              // locked=false
  List<String> removedIds;                    // bị mời ra — không vào lại được
  List<Attendance> attendance;                // {userId, displayName, role, joinedAt, leftAt} — từ webhook
  boolean reminded;                           // đã nhắc 10 phút trước
  Instant createdAt, startedAt, endedAt;
}
@Document("meeting_notes")    MeetingNote    { id, meetingId, scope: SHARED|PRIVATE, ownerId, content, long version, updatedBy, updatedAt }
                              // unique {meetingId, scope, ownerId}
@Document("meeting_messages") MeetingMessage { id, meetingId, senderId, content, createdAt }   // index {meetingId, createdAt}
```

Index: `{hostId, scheduledStart}`, `{inviteeIds, scheduledStart}`, `{departmentId, scheduledStart}`, `{status, scheduledStart}`.

Redis: `meet:lobby:{id}` (hash userId → displayName), `meet:admitted:{id}` (set), `meet:hands:{id}` (zset userId → epoch ms), `call:user:{userId}` = `meet_{id}` (cùng key với plan Calls ⇒ đang họp = bận). Xoá khi ENDED.

## Quyền (`MeetingAccess`, hàm thuần — test kỹ)

`decide(meeting, userId, departmentIds) → HOST | COHOST | INVITED | MUST_WAIT | DENIED_REMOVED | DENIED_LOCKED | DENIED_ENDED`

1. `status == ENDED` ⇒ `DENIED_ENDED` (client chuyển sang trang chi tiết).
2. `userId ∈ removedIds` ⇒ `DENIED_REMOVED`.
3. host ⇒ `HOST`; ∈ coHostIds ⇒ `COHOST`.
4. ∈ inviteeIds, hoặc `departmentId ∈ departmentIds` của người đó, hoặc ∈ `meet:admitted` ⇒ `INVITED`.
5. `locked` ⇒ `DENIED_LOCKED`.
6. `waitingRoom` ⇒ `MUST_WAIT`, ngược lại `INVITED`.

Tạo cuộc họp cần capability `HOST_MEETING`. Mọi người trong workspace đều mở được link (single-tenant ⇒ cùng công ty).

## Contract

### REST `/api/meetings` (chat-service)

| Method | Path | Ghi chú |
|---|---|---|
| POST | `/api/meetings` | `{title, description?, inviteeIds?, departmentId?, scheduledStart?, scheduledEnd?, settings?}` → Meeting. Cần `HOST_MEETING`. Không có `scheduledStart` = họp ngay |
| GET | `/api/meetings?scope=upcoming\|past` | Cuộc họp tôi host/co-host/được mời/thuộc phòng ban; phân trang cursor như `MessageQueryService` |
| GET | `/api/meetings/{id}` · `/api/meetings/by-code/{code}` | Chi tiết (ẩn `removedIds` với người không phải host) |
| PATCH | `/api/meetings/{id}` | host/co-host; sửa tiêu đề, lịch, người mời, settings |
| DELETE | `/api/meetings/{id}` | host; chỉ khi `SCHEDULED` (huỷ) |
| POST | `/api/meetings/{id}/join` | → `{status:"joined", url, token, role}` \| `{status:"waiting"}` \| 403 `{code}` (`MEETING_REMOVED`, `MEETING_LOCKED`) \| 409 `MEETING_ENDED` \| 503 `MEETINGS_UNAVAILABLE` |
| DELETE | `/api/meetings/{id}/lobby` | tự rời phòng chờ |
| POST | `/api/meetings/{id}/lobby/{userId}/admit` · `/deny` | host/co-host |
| POST | `/api/meetings/{id}/end` | host/co-host; `DeleteRoom` + ENDED |
| GET/PUT | `/api/meetings/{id}/notes/shared` · `/notes/private` | PUT `{content, version}`; sai version ⇒ 409 kèm bản mới nhất |
| GET | `/api/meetings/{id}/messages?before=` | lịch sử chat trong họp |

Token họp: `room=meet_{id}`, grant `participant`; `allowAttendeeScreenShare=false` ⇒ attendee bị giới hạn `canPublishSources=[camera, microphone]`; host/co-host thêm `roomAdmin`.

### STOMP

| Hướng | Destination | Payload |
|---|---|---|
| C→S | `/app/meet.hand` | `{meetingId, raised}` |
| C→S | `/app/meet.chat` | `{meetingId, content}` |
| C→S | `/app/meet.host` | `{meetingId, action, targetId?}` — `action` ∈ `MUTE_MIC`, `MUTE_ALL`, `REMOVE`, `LOWER_HAND`, `LOWER_ALL_HANDS`, `LOCK`, `UNLOCK`, `WAITING_ROOM_ON`, `WAITING_ROOM_OFF`, `ATTENDEE_SCREEN_SHARE_ON`, `ATTENDEE_SCREEN_SHARE_OFF`, `MAKE_COHOST`, `REVOKE_COHOST` |
| S→C | `/topic/meeting/{id}` | `meet.roster` · `meet.hands` (danh sách có thứ tự) · `meet.chat` · `meet.notes.updated {version, updatedBy}` · `meet.settings` · `meet.ended` |
| S→C | `/user/queue/meeting` | `meet.lobby {meetingId, waiting:[{userId, displayName}]}` (host/co-host) · `meet.admitted` / `meet.denied` (người chờ) · `meet.removed` · `meet.invited` · `meet.starting` (nhắc trước 10 phút) |

Subscribe `/topic/meeting/{id}` phải kiểm quyền trong `AuthChannelInterceptor` (chỉ người đang ở trong phòng hoặc host/co-host) — giống cách topic hội thoại đang được kiểm.

Lệnh host dùng `LiveKitRoomClient`: `MUTE_MIC`/`MUTE_ALL` = `listParticipants` + `mutePublishedTrack` cho track `MICROPHONE` (không bật hộ được — đúng như Meet/Teams); `REMOVE` = thêm `removedIds` + `removeParticipant`; quyền share màn hình = **thêm** `updateParticipant(room, identity, canPublishSources)` vào `LiveKitRoomClient` (Twirp `UpdateParticipant`, body `{room, identity, permission:{can_publish:true, can_subscribe:true, can_publish_data:true, can_publish_sources:[...]}}`).

Reaction: LiveKit data channel, `topic: "reaction"`, payload `{"e":"👍"}`, gửi `reliable: false`; server không thấy.

---

## Milestones

### MT1 — Capability `HOST_MEETING`

- `packages/database/src/rbac/capabilities.ts` thêm `HOST_MEETING`; `preset-roles.ts` bật cho Owner/Admin/Manager/Member. **Sau khi sửa `packages/database/src` phải chạy `cd packages/database && npx tsc -p . --outDir src`** (file `.js` đã build nằm trong `src/` và che file `.ts` khi auth-service chạy jest — xem memory dự án).
- Web: union `CAPABILITIES` trong `apps/web/lib/api/admin-types.ts` + nhãn i18n `admin.cap*`. Flutter: enum `Cap` trong `features/admin/data/admin_models.dart` + `cap_label` + ARB.
- Role đã lưu trong DB không có key mới ⇒ coi là tắt. Thêm migration idempotent trong `auth-service` `bootstrap.service.ts`: preset role nào chưa có key `HOST_MEETING` thì bật.
- Verify: `pnpm --filter @platform/database test`, `pnpm --filter @platform/auth-service test`, web build, `flutter analyze`.

### MT2 — chat-service: domain, REST, vào phòng, phòng chờ, webhook, nhắc lịch

Files mới trong `apps/server/chat-service/src/main/java/com/platform/chatservice/`: `model/Meeting.java`, `model/MeetingNote.java`, `model/MeetingMessage.java`, `repository/Meeting*Repository.java`, `service/meeting/MeetingCodeGenerator.java`, `service/meeting/MeetingAccess.java`, `service/meeting/MeetingService.java` (CRUD + list), `service/meeting/MeetingJoinService.java` (join/lobby/admit/deny/end + token), `service/meeting/MeetingRtcHandler.java` (`RtcRoomEventHandler` cho `meet_*`: attendance, `SCHEDULED/… → LIVE` ở người vào đầu tiên, `room_finished → ENDED`, dọn Redis, `call:user:*`), `service/meeting/MeetingReminderSweep.java` (`@Scheduled` 60s, **claim** `reminded` bằng update có điều kiện như `ReminderSweepService`, gửi `meet.starting` + FCM cho host/co-host/người được mời/thành viên phòng ban), `controller/MeetingController.java`, `dto/meeting/*`. Sửa `MongoIndexInitializer` (index ở trên), `AuthChannelInterceptor` (topic `/topic/meeting/*`).

Test bắt buộc: `MeetingAccessTest` (mọi nhánh của bảng quyền), `MeetingCodeGeneratorTest` (định dạng, không có `i l o`, retry khi trùng), `MeetingJoinServiceTest` (joined/waiting/removed/locked/ended/unavailable; admit cho vào lần join sau; deny; host vào thấy lobby đang chờ), `MeetingRtcHandlerTest` (attendance; LIVE; ENDED idempotent; dọn Redis), `MeetingReminderSweepTest` (claim một lần; không nhắc cuộc họp đã huỷ/ENDED), `MeetingControllerTest` (thiếu `HOST_MEETING` ⇒ 403; validate giới hạn độ dài/số người).

FCM: data `{type: "MEETING_INVITED"|"MEETING_STARTING", meetingId, code}`; client tự dịch theo `type` (memory: notification i18n phía client).

### MT3 — chat-service: giơ tay, chat, ghi chú, lệnh host

Files mới: `service/meeting/MeetingHandService.java`, `service/meeting/MeetingChatService.java`, `service/meeting/MeetingNotesService.java`, `service/meeting/MeetingHostService.java`, `controller/MeetingWsController.java` (`@MessageMapping("/meet.hand" | "/meet.chat" | "/meet.host")`). Sửa `service/rtc/LiveKitRoomClient.java` (+ `updateParticipant`) và test của nó.

Hành vi phải có test: giơ tay giữ thứ tự (giơ lại không đổi chỗ); hạ tay khi rời phòng (`onParticipantLeft`); chỉ host/co-host hạ tay người khác; chat rỗng/quá dài bị từ chối; ghi chú: version tăng, 409 trả bản mới nhất, attendee không sửa được khi `attendeesCanEditNotes=false`, ghi chú riêng chỉ chủ đọc/ghi; mỗi `action` host: kiểm quyền (attendee ⇒ bị bỏ qua + log), `REMOVE` không áp lên host, `REVOKE_COHOST` không áp lên host, `MUTE_ALL` bỏ qua người gọi lệnh, `ATTENDEE_SCREEN_SHARE_OFF` gọi `updateParticipant` cho mọi attendee đang trong phòng.

### MT4 — Web: danh sách, tạo, chi tiết

- `apps/web/lib/api/meetings.ts` (`chatApi`), `apps/web/lib/api/types.ts` (type Meeting…), `apps/web/lib/hooks/use-meetings.ts` (TanStack Query; STOMP `/user/queue/meeting` cập nhật cache bằng `setQueryData`, không refetch).
- `app/(main)/meetings/page.tsx` — tab Sắp tới / Đã qua; nút **Họp ngay** (tạo + vào thẳng `/meet/{code}`) và **Lên lịch** (dialog: tiêu đề, thời gian, người mời tìm theo tên, phòng ban, cài đặt). Nút copy link.
- `app/(main)/meetings/[id]/page.tsx` — chi tiết: thông tin, điểm danh (thời lượng mỗi người), ghi chú chung (sửa được nếu có quyền), ghi chú riêng, lịch sử chat, nút **Họp lại**. Ô "Biên bản AI" để trống chờ P2.
- Mục điều hướng "Phòng họp" ở menu chính (`app/(main)/layout.tsx` + `components/layout/MobileTabBar.tsx` nếu còn chỗ, nếu không thì trong menu "Thêm").
- Toast/banner khi nhận `meet.invited` / `meet.starting` (bấm vào ⇒ `/meet/{code}`).
- Test Vitest: hooks (cache update theo event), form tạo (validate giới hạn).

### MT5 — Web: trong phòng họp

`app/(main)/meet/[code]/page.tsx` (toàn màn hình, ẩn sidebar như `/admin` ẩn aside) gồm 3 trạng thái: **PreJoin** → **Waiting** → **Room**; `ENDED` ⇒ chuyển sang `/meetings/{id}`.

Components mới trong `apps/web/components/meeting/`: `PreJoinLobby.tsx` (chọn mic/cam/loa, preview, mức âm lượng, vào khi tắt mic/cam; nhớ lựa chọn thiết bị bằng `localStorage` trong try/catch), `WaitingScreen.tsx`, `MeetingStage.tsx` (layout grid / spotlight / ghim; share màn hình luôn chiếm ô lớn; viền người đang nói), `ControlBar.tsx` (mic, cam, share màn hình, giơ tay, reaction, chat, ghi chú, người tham gia, rời; host thêm menu Quản lý + Kết thúc cho mọi người), `ParticipantsPanel.tsx` (hàng giơ tay theo thứ tự lên đầu; phòng chờ với Cho vào/Từ chối; menu host trên từng người), `MeetingChatPanel.tsx`, `NotesPanel.tsx` (tab Chung / Của tôi, Markdown, lưu tự động sau 2s ngừng gõ, xử lý 409 không mất chữ), `ReactionOverlay.tsx`, `HostMenu.tsx`. Store `apps/web/lib/store/meeting.store.ts`. Dùng `lib/rtc/livekit-session.ts`.

Phím tắt: `Ctrl/⌘+D` mic, `Ctrl/⌘+E` cam, `Ctrl/⌘+Alt+H` giơ tay (giống Meet).

Test Vitest: store reducer theo event (`meet.hands`, `meet.roster`, `meet.settings`), NotesPanel xử lý 409, giới hạn reaction 1/giây.

### MT6 — Flutter: danh sách, tạo, chi tiết

Mirror MT4: `lib/features/meetings/data/meetings_repository.dart` (`chatDio`), `data/meeting_models.dart`, `state/meetings_providers.dart`, `ui/meetings_screen.dart`, `ui/create_meeting_sheet.dart`, `ui/meeting_detail_screen.dart`; route `/meetings`, `/meetings/:id` trong `lib/core/router/app_router.dart`; mục điều hướng cùng vị trí với web; xử lý `meet.invited` / `meet.starting` (banner + thông báo OS) và FCM `MEETING_*` (chạm ⇒ mở đúng cuộc họp). Test widget/provider.

### MT7 — Flutter: trong phòng họp

Mirror MT5: route `/meet/:code`; `ui/room/prejoin_screen.dart`, `waiting_screen.dart`, `meeting_room_screen.dart`, `meeting_stage.dart`, `control_bar.dart`, `participants_sheet.dart`, `meeting_chat_sheet.dart`, `notes_sheet.dart`, `reaction_overlay.dart`, `host_actions_sheet.dart`; state `state/meeting_room_controller.dart` dùng `lib/core/rtc/livekit_session.dart`. Android share màn hình: `MediaProjection` + foreground service (`FOREGROUND_SERVICE_MEDIA_PROJECTION` trong `AndroidManifest.xml`). iOS: ẩn nút share màn hình, ghi release note (owner chốt 2026-08-28). Giữ màn hình sáng khi đang họp. Test controller + widget.

### MT8 — QC

- [ ] Skill `sync-check` cho toàn bộ tính năng họp.
- [ ] Ma trận tay (web + Android + iOS, ít nhất một máy 4G): họp ngay 2 người; lên lịch → nhận nhắc trước 10 phút; người lạ qua link → phòng chờ → host cho vào; từ chối; mời ra rồi mở lại link; khoá phòng; giơ tay 3 người theo thứ tự + hạ tất cả; tắt mic tất cả; tắt quyền share của attendee; share màn hình web + Android; chat; hai người cùng sửa ghi chú; reaction; host rời không kết thúc (co-host điều khiển tiếp); kết thúc cho mọi người ⇒ ai cũng về trang chi tiết; 10 và 25 người; kill app giữa họp (điểm danh có `leftAt`).
- [ ] Cập nhật `docs/api-spec.md`, `docs/superpowers/plans/README.md`, tài liệu tính năng cho báo cáo môn học.
