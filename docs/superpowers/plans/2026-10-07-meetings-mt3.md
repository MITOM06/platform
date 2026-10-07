# Phòng họp P1 — MT3 (chat-service: giơ tay, chat, ghi chú, lệnh host) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chat-service có đủ phần "trong phòng" của Phòng họp mà client MT5/MT7 cần: **giơ tay** theo thứ tự (Redis, host hạ một/tất cả, tự hạ khi rời phòng), **chat trong họp** (lưu `meeting_messages`, phân trang, phát STOMP, giới hạn độ dài + tốc độ), **ghi chú chung + ghi chú riêng** (`meeting_notes`, khoá lạc quan `version` ⇒ 409 `MEETING_NOTE_CONFLICT` kèm bản mới nhất, `attendeesCanEditNotes`), và **lệnh host/co-host** qua `/app/meet.host` (tắt mic một/tất cả, mời ra, khoá/mở, phòng chờ bật/tắt, quyền share màn hình, phong/thu hồi co-host) — kể cả với subscription STOMP và token LiveKit đã mở từ trước.

**Architecture:** Thêm vào package `service/meeting/` đã có của MT2, mỗi file một trách nhiệm (< 300 dòng): `MeetingGuard` (tìm cuộc họp + kiểm quyền dùng chung, ném `ApiException`), `MeetingHandService` (zset `meet:hands:{id}`), `MeetingChatService`, `MeetingNotesService`, `MeetingRoomPolicy` (đồng bộ quyền publish LiveKit + chặn người bị mời ra khi webhook báo vào), `MeetingHostService` (điều phối 13 `action`). Quyền là hàm thuần trong `MeetingAccess` (mở rộng). Lệnh STOMP vào `MeetingWsController` (mỏng); lỗi của lệnh STOMP trả về người gửi bằng sự kiện `meet.error` trên `/user/queue/meeting`. REST mới (`/messages`, `/notes/*`, `/hands`) thêm vào `MeetingController`. Người bị mời ra bị cắt ở **bốn** lớp: Mongo `removedIds` (không vào lại), LiveKit `RemoveParticipant` (+ đá lại khi token cũ còn hạn nối lại), Redis `meet:removed:{id}` + bộ lọc outbound mới cho `/topic/meeting/*` (subscription đã mở không nhận gì nữa), và sự kiện `meet.removed` cho client.

**Tech Stack:** Spring Boot 3.3 · Java 21 · MongoDB · Redis (`StringRedisTemplate`, sorted set) · STOMP (`@MessageMapping`, `ClusterMessageBroker`) · LiveKit Twirp (`LiveKitRoomClient`) · JUnit 5 + Mockito + AssertJ + Testcontainers (`mongo:7`) · Spotless.

**Spec:** `docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md` §4.3 (lệnh host, ghi chú D11), §4 (giơ tay/chat/ghi chú/lệnh host đi qua chat-service). **Milestone plan (binding):** `docs/superpowers/plans/2026-10-05-meetings-p1-core.md` — Model, Quyền, Contract, MT3. **Baseline:** `docs/superpowers/plans/2026-10-07-meetings-mt1-mt2.md` (Global Constraints, Ruling, Contract MT2, "Ngoài phạm vi") và code thật trên `feat/meetings-p1` @ `1752049` (MT2 + QA follow-ups). Chỗ nào lệch đều ghi ở "Sai khác so với milestone plan".

## Global Constraints

- Nhánh `feat/meetings-p1` (worktree hiện tại). Không commit seed / localhost / key LiveKit dev (`.claude/rules/dev-local-only.md`); test trên `dev` trước khi PR.
- Java ≤ 500 dòng/file (mục tiêu ≤ 300), controller chỉ parse + gọi service (`.claude/rules/clean-code.md`). `MVN spotless:apply` sau **mỗi** lần sửa Java (spotless gắn vào `test-compile`; `mvn compile` xanh nhưng `spotless:check` đỏ là chuyện thường gặp).
- **Không bao giờ `meetingRepository.save(meeting)`** — mọi ghi vào `meetings` đi qua `MeetingStore` (`update(id, Update)` có sẵn, chặn ENDED). Ghi `meeting_notes` / `meeting_messages` bằng `MongoTemplate` (`insert`, `findAndModify` có điều kiện) — không read-modify-write.
- Lỗi REST: `ApiException(status, code)` / `ApiException(status, code, null, params)` — body `{error, code, statusCode, params?}`, không `message`. Riêng 409 ghi chú có thêm `latest` (Task 7). Lỗi lệnh STOMP: sự kiện `meet.error` (Contract) — **không** bao giờ chữ của exception.
- Không lộ dữ liệu thô (`.claude/rules/no-raw-system-data-in-ui.md`): mọi userId trong payload đi kèm `displayName` (dạng `PersonDto {userId, displayName?, avatarUrl?}` hoặc `HandDto`); tên không resolve được ⇒ bỏ trống, **không** thay bằng id. Tên room `meet_*`, track sid, mã lỗi LiveKit **không** bao giờ vào payload. Nội dung chat/ghi chú là chữ người dùng gõ — server không sinh chữ nào.
- Giới hạn (milestone): chat ≤ **2000** ký tự/tin (sau `trim`), ghi chú ≤ **50 000** ký tự, tối đa 25 người. Tốc độ chat dùng lại `RateLimiterService.checkMessageRate` (10 tin / 5 giây / người, chung với chat thường).
- Redis của một cuộc họp sống `MeetingLobby.TTL` (24h) sau lần ghi cuối và bị `MeetingLobby.clear` xoá khi ENDED / huỷ.
- Không biến môi trường mới, không đổi `application.yml`.
- `MVN` = `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home mvn -B -f apps/server/chat-service/pom.xml`. Test Testcontainers cần Docker đang chạy (như mọi `mvn test` hiện tại của repo).

## Review Focus

1. **Hai người cùng sửa ghi chú chung** — người lưu sau nhận 409 `MEETING_NOTE_CONFLICT` kèm `latest` (nội dung + `version` mới nhất), bản của người lưu trước còn nguyên. Test Task 7 (Testcontainers, cả hai lần lưu đầu tiên đua nhau lẫn N luồng cùng `version`).
2. **Host mời một người ra khi người đó đang trong phòng** — `removedIds` có người đó, LiveKit `RemoveParticipant` được gọi, tay (nếu đang giơ) được hạ, người đó nhận `meet.removed`, và **mọi frame sau đó của `/topic/meeting/{id}` không tới phiên STOMP của họ** dù subscription còn mở. Nối lại LiveKit bằng token cũ (≤ 10 phút) ⇒ webhook `participant_joined` ⇒ bị đá lại, không ghi điểm danh. Test Task 9, 10, 11.
3. **Giơ tay giữ thứ tự** — A, B, C giơ; A giơ lại ⇒ vẫn đứng đầu; A rời phòng ⇒ tự hạ, B lên đầu; host "hạ tất cả" ⇒ danh sách rỗng. Test Task 5 + 10.
4. **Attendee gửi lệnh host bằng client giả** — bị bỏ qua + log, không gọi LiveKit, không phát sự kiện, không `meet.error` (milestone). Test Task 9.
5. **Tắt quyền share màn hình khi một attendee đang share** — mọi attendee đang trong phòng bị `UpdateParticipant` về `camera+microphone` và track share đang phát bị mute; host/co-host không bị đụng; người vào sau bằng token cấp trước khi tắt vẫn bị giới hạn khi webhook báo vào. Test Task 8.
6. **Đổi `waitingRoom`/`locked` giữa họp** — người đã vào phòng trước đó (kể cả người vào thẳng lúc phòng chờ tắt) vẫn subscribe lại được khi STOMP nối lại và vẫn `join` lại được. Test Task 8 (`entered ⇒ admitted`).

---

## Ruling khi viết plan

Như plan MT1–MT2: plan ghi **đầy đủ code test** (test là đặc tả) cho lớp có logic; code hiện thực mô tả bằng chữ ký + hành vi chính xác. Lớp chỉ là dữ liệu (DTO record) ghi đủ field. Nếu giao cho người khác thực thi mà không có ngữ cảnh phiên này, viết bổ sung code hiện thực trước.

Đường dẫn viết tắt:
- `M/` = `apps/server/chat-service/src/main/java/com/platform/chatservice/`
- `T/` = `apps/server/chat-service/src/test/java/com/platform/chatservice/`
- `MVN` = như Global Constraints.

---

## Sai khác so với milestone plan (đã đối chiếu code thật @ `1752049`, 2026-10-07)

| # | Milestone plan / spec nói | Code thật / vấn đề | Plan này làm |
|---|---|---|---|
| 1 | Files mới MT3: `MeetingHandService`, `MeetingChatService`, `MeetingNotesService`, `MeetingHostService`, `MeetingWsController` (+ `LiveKitRoomClient.updateParticipant`) | 4 service cùng cần "tìm cuộc họp + kiểm quyền"; lệnh host + đồng bộ quyền LiveKit + chặn khi webhook vào gộp chung sẽ vượt 300 dòng | **Thêm** `MeetingGuard` (kiểm quyền dùng chung), `MeetingRoomPolicy` (quyền publish LiveKit, đá người bị mời ra), `MeetingHostAction` (enum), `MeetingTopicOutboundInterceptor` (security), `MeetingNoteConflictException` (exception) và DTO mới. REST mới gắn vào `MeetingController` có sẵn |
| 2 | `REMOVE` = thêm `removedIds` + `removeParticipant` | QA MT2: quyền `/topic/meeting/{id}` chỉ kiểm lúc SUBSCRIBE ⇒ người bị mời ra vẫn nhận chat/roster qua subscription cũ; token LiveKit còn hạn ≤ 600s ⇒ nối lại được media | `REMOVE` còn: Redis `meet:removed:{id}` + **bộ lọc outbound** cho `/topic/meeting/*` (Task 11, như `ConversationTopicOutboundInterceptor`), webhook `participant_joined` của người trong `removedIds` ⇒ `RemoveParticipant` lần nữa, không ghi điểm danh (Task 10), sự kiện `meet.removed` ➕ cho người bị mời ra, hạ tay, `$pull coHostIds` |
| 3 | Spec §4.3: quyền share màn hình = "cấp lại token với `canPublishSources`" · Milestone: `updateParticipant` cho mọi attendee đang trong phòng | Token đã cấp không thu hồi được; người cầm token cấp **trước** khi tắt vẫn vào được với quyền share | Theo milestone (binding): `UpdateParticipant`. Thêm: mute track `SCREEN_SHARE`/`SCREEN_SHARE_AUDIO` đang phát của attendee khi tắt; webhook `participant_joined` của attendee khi `allowAttendeeScreenShare=false` ⇒ `UpdateParticipant` giới hạn (Task 8, 10). Chiều bật lại: người cầm token giới hạn cấp trước khi bật chỉ được mở khi `join` lại (cửa sổ ≤ 10 phút — chấp nhận) |
| 4 | `meet.notes.updated {version, updatedBy}` | `updatedBy` là userId thô — Global Constraints MT2 bắt mọi id đi kèm tên | `updatedBy` = `PersonDto {userId, displayName?, avatarUrl?}` |
| 5 | Ghi chú: "sai version ⇒ 409 kèm bản mới nhất" | `ApiException` chỉ có `params` (giá trị nội suy, "never user text") — không chở được nội dung ghi chú | `MeetingNoteConflictException extends ApiException` + handler riêng: body `{error, code:"MEETING_NOTE_CONFLICT", statusCode:409, latest:{MeetingNote}}` |
| 6 | Không nói lệnh STOMP báo lỗi thế nào (chat rỗng/quá dài "bị từ chối") | STOMP không có HTTP status; `ChatController` dùng `MESSAGE_REJECTED` trên `/queue/notifications` | ➕ Sự kiện `meet.error {meetingId?, action?, clientId?, errorCode, params?}` trên `/user/queue/meeting`. **Ngoại lệ** theo milestone: attendee gửi lệnh host ⇒ bỏ qua + log, không `meet.error` |
| 7 | MT2 contract: `meet.roster.participants[].role` = vai trò **lúc vào** | `MAKE_COHOST` / `REVOKE_COHOST` giữa họp ⇒ roster báo sai vai trò, client không biết ai đang là co-host | `meet.roster` dùng **vai trò hiện tại** (`MeetingAccess.roleOf`); `attendance[].role` (lịch sử) giữ nguyên "lúc vào". Phát `meet.roster` sau `MAKE_COHOST`/`REVOKE_COHOST` |
| 8 | Quyền subscribe `/topic/meeting/{id}` và `join` theo `MeetingAccess.decide` | Người vào thẳng lúc `waitingRoom=false` (hoặc co-host bị thu hồi mà không có tên trong `inviteeIds`) ⇒ sau `WAITING_ROOM_ON`/`LOCK`, STOMP nối lại bị ERROR `Unauthorized subscription`, `join` lại phải chờ / bị từ chối dù đang ở trong phòng | **Ruling "đã vào ⇒ admitted":** `MeetingJoinService.enter` thêm attendee không được mời đích danh vào `meet:admitted:{id}`; `REVOKE_COHOST` cũng vậy. `LOCK` chỉ chặn người **mới** (đúng Meet). Task 8 |
| 9 | Milestone liệt kê `action` cho settings nhưng không có cho `attendeesCanEditNotes`; "update settings" | `PATCH /api/meetings/{id}` (MT2) đã sửa được cả 5 setting nhưng đổi `allowAttendeeScreenShare` qua PATCH **không** đụng LiveKit | Giữ `attendeesCanEditNotes` qua PATCH (không thêm action). PATCH đổi `allowAttendeeScreenShare` khi LIVE ⇒ gọi `MeetingRoomPolicy.applyScreenShare` (best-effort, lỗi LiveKit chỉ log — settings đã lưu) |
| 10 | Spec §4.3 "phong co-host", không nói ai được làm | — | **Chỉ host** `MAKE_COHOST`/`REVOKE_COHOST`; co-host không mời ra co-host khác, không ai mời ra host (Meet/Teams). Đề xuất mặc định — xem "Quyết định cho owner" |
| 11 | `GET /api/meetings/{id}/messages?before=` | Chưa nói kích thước trang / thứ tự / ai đọc được | `?before={messageId}&size=` (mặc định 50, tối đa 100), mới nhất trước, cursor `(createdAt, _id)` như `MessageQueryService`, `PageResponse`. Đọc được = `MeetingAccess.canReadRecords` (cả sau ENDED, trừ người bị mời ra) |
| 12 | Không có cách lấy trạng thái giơ tay hiện tại | Client vào giữa chừng / STOMP nối lại chỉ thấy `meet.hands` ở lần đổi kế tiếp | ➕ `GET /api/meetings/{id}/hands` → `{hands:[…]}` (client subscribe topic **trước**, rồi GET) |
| 13 | — | Client cần biết ai tắt mic mình, và khớp tin chat lạc quan với tin server | ➕ `meet.muted {actor}` cho người bị tắt mic; ➕ `clientId` tuỳ chọn trong `/app/meet.chat`, dội lại trong `meet.chat` / `meet.error` (không lưu) |
| 14 | Redis milestone: `meet:lobby`, `meet:admitted`, `meet:hands` | Bộ lọc outbound cần tra "bị mời ra" mỗi frame mà không đọc Mongo | ➕ `meet:removed:{id}` (set), xoá cùng `MeetingLobby.clear` ⇒ `clear` xoá **4** key (sửa `MeetingLobbyTest`) |
| 15 | Ghi chú sau khi họp xong | Milestone MT4: trang chi tiết "ghi chú chung (sửa được nếu có quyền)" | Ghi chú đọc/sửa được cả khi ENDED (collection riêng, không qua `MeetingStore.update`). Giơ tay / chat / lệnh host: ENDED ⇒ 409 `MEETING_ENDED` |
| 16 | `MeetingNoteRepository` / `MeetingMessageRepository` (MT2 tạo rỗng) | Ghi có điều kiện cần `findAndModify` / cursor compound | Dùng `MongoTemplate`; hai repository giữ nguyên (không xoá — không đổi file MT2 khi không cần) |

---

## Contract chốt cho MT3 (web/mobile MT5/MT7 dựa vào đây)

➕ = bổ sung so với milestone plan (lý do ở Sai khác). Thời gian là ISO-8601 UTC; field `null` bị bỏ khỏi JSON. Contract MT2 (`docs/api-spec.md` § Meetings) giữ nguyên, trừ `meet.roster.role` (Sai khác #7).

### Quyền (hàm thuần trong `MeetingAccess`, Task 1)

| Hành động | Ai | ENDED | Bị mời ra |
|---|---|---|---|
| Giơ/hạ tay của mình, gửi chat, `GET /hands` | `decide(...).entersRoom()` (host, co-host, được mời/phòng ban/admitted, hoặc ai cũng được khi phòng chờ tắt và không khoá) | 409 `MEETING_ENDED` | 403 `MEETING_REMOVED` |
| Đọc lịch sử chat, đọc ghi chú chung, đọc/sửa ghi chú riêng của mình | `canReadRecords`: host, co-host, được mời/phòng ban, có dòng điểm danh, hoặc admitted | **được** | 403 `MEETING_REMOVED` |
| Sửa ghi chú chung | host/co-host luôn; người khác có `canReadRecords` **và** `settings.attendeesCanEditNotes=true` | **được** | 403 `MEETING_REMOVED` |
| Lệnh host (`/app/meet.host`) | host, co-host — attendee ⇒ **bỏ qua + log** | `meet.error MEETING_ENDED` | (không phải host) |
| `MAKE_COHOST`, `REVOKE_COHOST` | **chỉ host** | | |
| `REMOVE` lên co-host | **chỉ host**; không ai `REMOVE` host hay chính mình | | |

Không đủ quyền (không phải trường hợp bị mời ra) ⇒ 403 `MEETING_FORBIDDEN`. Không có cuộc họp ⇒ 404 `MEETING_NOT_FOUND`.

### REST (chat-service, JWT bắt buộc)

| Method · Path | Ai | Request | 2xx | Lỗi (`code`) |
|---|---|---|---|---|
| `GET /api/meetings/{id}/messages?before=&size=` | `canReadRecords` | `before` = `id` tin cũ nhất đã có (vắng = mới nhất); `size` mặc định 50, tối đa 100 | 200 `PageResponse<MeetingMessage>` — **mới nhất trước** | 403 `MEETING_FORBIDDEN` · 403 `MEETING_REMOVED` · 404 · 400 `MEETING_INVALID {field:"size"}` (không phải số) |
| `GET /api/meetings/{id}/notes/shared` | `canReadRecords` | — | 200 `MeetingNote` | 403 · 404 |
| `PUT /api/meetings/{id}/notes/shared` | xem bảng quyền | `MeetingNoteRequest` | 200 `MeetingNote` | 403 `MEETING_NOTES_READ_ONLY` ➕ · 403 `MEETING_FORBIDDEN` · 403 `MEETING_REMOVED` · 404 · 400 `MEETING_INVALID {field:"content",max:50000}` / `{field:"version"}` · **409 `MEETING_NOTE_CONFLICT` ➕ + `latest`** |
| `GET /api/meetings/{id}/notes/private` | `canReadRecords` (luôn là ghi chú **của người gọi**) | — | 200 `MeetingNote` | 403 · 404 |
| `PUT /api/meetings/{id}/notes/private` | `canReadRecords` | `MeetingNoteRequest` | 200 `MeetingNote` | 403 · 404 · 400 · 409 như trên |
| `GET /api/meetings/{id}/hands` ➕ | `entersRoom` | — | 200 `{ "hands": [Hand…] }` | 403 · 404 · 409 `MEETING_ENDED` |

**Object `MeetingMessage`**

```json
{
  "id": "6710aa01b9e4d21f0c3a9e55",
  "sender": { "userId": "64b0…03", "displayName": "Hoa Le", "avatarUrl": "/api/uploads/…" },
  "content": "Slide 3 có số liệu mới",
  "createdAt": "2026-10-08T02:05:11.120Z"
}
```

Chỉ có chữ (không file, không tin hệ thống). `sender.displayName` vắng ⇒ client hiện nhãn chung.

**Object `MeetingNote`**

```json
{
  "scope": "shared",
  "content": "## Kết luận\n- Chốt ngân sách Q4",
  "version": 7,
  "updatedBy": { "userId": "64b0…01", "displayName": "Lan Nguyen" },
  "updatedAt": "2026-10-08T02:30:00Z"
}
```

- `scope` ∈ `shared | private`. Chưa ai viết ⇒ `{"scope":"shared","content":"","version":0}` (không có `updatedBy`/`updatedAt`).
- `content` là Markdown, lưu nguyên văn (không trim), ≤ 50 000 ký tự; `""` hợp lệ (xoá trắng).

**`MeetingNoteRequest`** — `{ "content": "…", "version": 7 }`. `version` = phiên bản client đang sửa trên đó (lần đầu = `0`). Đúng ⇒ lưu, trả `version + 1`. Sai (hoặc hai người cùng lưu lần đầu) ⇒ 409:

```json
{
  "error": "Conflict",
  "code": "MEETING_NOTE_CONFLICT",
  "statusCode": 409,
  "latest": { "scope": "shared", "content": "…bản của người lưu trước…", "version": 8,
              "updatedBy": { "userId": "64b0…02", "displayName": "Minh Tran" },
              "updatedAt": "2026-10-08T02:31:02Z" }
}
```

Client **không** ghi đè chữ đang gõ: hiện "Có bản mới hơn", cho xem `latest`, người dùng merge rồi PUT lại với `version` của `latest` (Review Focus 3 của milestone — UI ở MT5/MT7).

**Object `Hand`** — `{ "userId": "64b0…03", "displayName": "Hoa Le", "raisedAt": "2026-10-08T02:06:00.250Z" }`; mảng `hands` luôn theo thứ tự giơ (sớm nhất trước).

### STOMP — client gửi (C→S, `SEND /app/...`)

| Destination | Payload | Ghi chú |
|---|---|---|
| `/app/meet.hand` | `{ "meetingId": "m1", "raised": true }` | Chỉ tay **của mình**. Giơ khi đang giơ ⇒ không đổi chỗ, không phát gì. Hạ khi không giơ ⇒ no-op |
| `/app/meet.chat` | `{ "meetingId": "m1", "content": "…", "clientId": "c-7f3a" }` | `clientId` ➕ tuỳ chọn, `[A-Za-z0-9_-]{1,64}` (sai dạng ⇒ bỏ qua âm thầm), dội lại trong `meet.chat`/`meet.error`, **không** lưu |
| `/app/meet.host` | `{ "meetingId": "m1", "action": "MUTE_MIC", "targetId": "64b0…03" }` | `targetId` bắt buộc với `MUTE_MIC`, `REMOVE`, `LOWER_HAND`, `MAKE_COHOST`, `REVOKE_COHOST`; bị bỏ qua với action khác |

### Lệnh host (`action`)

| `action` | Ai | Hiệu ứng (theo thứ tự) | Sự kiện |
|---|---|---|---|
| `MUTE_MIC` | host, co-host | `ListParticipants` ⇒ mỗi track `MICROPHONE` **chưa** mute của `targetId` ⇒ `MutePublishedTrack(muted=true)`. Không có trong phòng / đã mute ⇒ no-op. Không bật hộ được | `meet.muted` ➕ tới target (khi có track bị mute) |
| `MUTE_ALL` | host, co-host | như trên cho **mọi người trừ người gọi lệnh** | `meet.muted` tới từng người bị mute |
| `REMOVE` | host; co-host chỉ lên attendee | target ≠ host, ≠ người gọi ⇒ Mongo `$addToSet removedIds` + `$pull coHostIds` ⇒ Redis `meet:removed` (+ `SREM meet:admitted`) ⇒ hạ tay ⇒ `meet.removed` ⇒ `RemoveParticipant` (404 = đã rời = OK) | `meet.removed` ➕ tới target; `meet.hands` nếu đang giơ; `meet.roster` tới phòng qua webhook `participant_left` |
| `LOWER_HAND` | host, co-host | `ZREM` tay của target | `meet.hands` (khi đổi) |
| `LOWER_ALL_HANDS` | host, co-host | `DEL meet:hands:{id}` | `meet.hands` `[]` (khi có tay) |
| `LOCK` / `UNLOCK` | host, co-host | `$set settings.locked` | `meet.settings` (khi đổi) |
| `WAITING_ROOM_ON` / `_OFF` | host, co-host | `$set settings.waitingRoom` | `meet.settings` (khi đổi) |
| `ATTENDEE_SCREEN_SHARE_ON` / `_OFF` | host, co-host | `$set settings.allowAttendeeScreenShare` ⇒ mọi **attendee** đang trong phòng: `UpdateParticipant` (OFF: `["CAMERA","MICROPHONE"]` + mute track share đang phát; ON: cả 4 nguồn) | `meet.settings` (khi đổi) |
| `MAKE_COHOST` | **host** | target đang trong phòng (dòng điểm danh mở), ≠ host, chưa là co-host ⇒ `$addToSet coHostIds` ⇒ (nếu share attendee đang tắt) `UpdateParticipant` cả 4 nguồn | `meet.roster` (vai trò mới); `meet.lobby` tới co-host mới (danh sách chờ hiện tại) |
| `REVOKE_COHOST` | **host** | target là co-host ⇒ `$pull coHostIds` ⇒ `SADD meet:admitted` (vẫn vào lại được) ⇒ (nếu share attendee đang tắt) `UpdateParticipant` `["CAMERA","MICROPHONE"]` | `meet.roster` |

Lỗi LiveKit (không cấu hình / lỗi mạng / 5xx) ⇒ `meet.error MEETINGS_UNAVAILABLE` cho người gọi lệnh; thay đổi trong Mongo/Redis **đã** áp dụng thì giữ (gửi lại lệnh là idempotent).

### STOMP — server phát (S→C)

Mọi payload là `MeetingEventDto` `{event, meetingId, …}`; field vắng thì bỏ.

| Destination | `event` | Payload | Khi nào |
|---|---|---|---|
| `/topic/meeting/{id}` | `meet.hands` | `{event, meetingId, hands:[Hand…]}` (thứ tự giơ; `[]` = không ai giơ) | giơ / hạ / hạ tất cả / rời phòng / bị mời ra |
| `/topic/meeting/{id}` | `meet.chat` | `{event, meetingId, clientId?, message: MeetingMessage}` | `/app/meet.chat` thành công |
| `/topic/meeting/{id}` | `meet.notes.updated` | `{event, meetingId, version, updatedBy: {userId, displayName?}}` — **không** có `content` (client không đang sửa thì GET lại) | `PUT /notes/shared` thành công (ghi chú riêng không phát) |
| `/topic/meeting/{id}` | `meet.roster` | như MT2, nhưng `role` = vai trò **hiện tại** | thêm: sau `MAKE_COHOST` / `REVOKE_COHOST` |
| `/topic/meeting/{id}` | `meet.settings` | như MT2 | thêm: lệnh `LOCK…ATTENDEE_SCREEN_SHARE_OFF` đổi giá trị |
| `/user/queue/meeting` | `meet.removed` ➕ | `{event, meetingId}` | bạn bị mời ra — client rời LiveKit, về trang thông tin; `join` lại ⇒ 403 `MEETING_REMOVED` |
| `/user/queue/meeting` | `meet.muted` ➕ | `{event, meetingId, actor: {userId, displayName?}}` | host/co-host tắt mic bạn |
| `/user/queue/meeting` | `meet.lobby` | như MT2 | thêm: tới co-host vừa được phong |
| `/user/queue/meeting` | `meet.error` ➕ | `{event, meetingId?, action?, clientId?, errorCode, params?}` | một lệnh `/app/meet.*` của **bạn** bị từ chối |

`meet.error.errorCode` ∈ `MEETING_NOT_FOUND | MEETING_FORBIDDEN | MEETING_REMOVED | MEETING_ENDED | MEETING_INVALID | MEETINGS_UNAVAILABLE | RATE_LIMITED`. `params` như REST (`{field, max?}`; `field` ∈ `content | action | targetId`). `action` = action của lệnh host bị từ chối; `clientId` = của tin chat bị từ chối. (Tên field là `errorCode` vì `code` của `MeetingEventDto` đã là mã phòng `abc-defg-hjk`.)

Ví dụ: `{"event":"meet.error","meetingId":"m1","clientId":"c-7f3a","errorCode":"MEETING_INVALID","params":{"field":"content","max":2000}}`.

### Subscribe

Không đổi so với MT2 (`StompDestinationPolicy` giữ 7 rule). Thêm: frame `MESSAGE` của `/topic/meeting/{id}` **không** được giao tới phiên STOMP của người có trong `meet:removed:{id}` (bộ lọc outbound, Task 11) — subscription vẫn giữ nhưng câm.

### Mã lỗi mới (`ErrorCodes`)

| Code | Status | Khi nào |
|---|---|---|
| `MEETING_NOTE_CONFLICT` | 409 | `PUT /notes/*` với `version` cũ — body có `latest` |
| `MEETING_NOTES_READ_ONLY` | 403 | attendee sửa ghi chú chung khi `attendeesCanEditNotes=false` |
| `RATE_LIMITED` | — (chỉ trong `meet.error`) | quá 10 tin chat / 5 giây |

---

# Tasks

Thứ tự theo phụ thuộc: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13. Mỗi task kết thúc bằng `MVN spotless:apply`, test của task, và commit. Task có controller mới chạy thêm `-Dtest=AssistantMappingUniquenessTest`.

### Task 1: `MeetingAccess` — quyền cho tay, chat, ghi chú, lệnh host

**Files:**
- Modify: `M/service/meeting/MeetingAccess.java`
- Test: `T/service/meeting/MeetingAccessTest.java` (thêm test; `setUp` sẵn có: host `host`, co-host `co`, invitee `inv`, phòng ban `dept-a`)

**Interfaces — Produces** (thêm, `static`, không I/O):
- `boolean isInside(Meeting m, String userId)` — có dòng `attendance` với `leftAt == null`. Dùng chung với `MeetingJoinService.peopleInside` (thay vòng lặp riêng ở đó bằng hàm này nếu tiện — không đổi hành vi).
- `boolean canReadRecords(Meeting m, String userId, Collection<String> departmentIds, boolean admitted)` — `userId ∉ removedIds` **và** (host ∨ co-host ∨ `isInvited` ∨ có dòng điểm danh ∨ `admitted`). Không xét `status` (đọc được cả khi ENDED).
- `boolean canEditSharedNote(Meeting m, String userId, Collection<String> departmentIds, boolean admitted)` — `canReadRecords` **và** (`canManage` ∨ `settings.attendeesCanEditNotes`).
- `boolean outranks(Meeting m, String actorId, String targetId)` — `actorId ≠ targetId` và (actor là host ∨ (actor là co-host ∧ target không phải host/co-host)).

- [ ] **Step 1: Test** — thêm vào `MeetingAccessTest`:

```java
  @Test
  void insideMeansAnOpenAttendanceRow() {
    Instant t = Instant.now();
    m.getAttendance().add(Meeting.Attendance.builder().userId("a").joinedAt(t).build());
    m.getAttendance()
        .add(Meeting.Attendance.builder().userId("b").joinedAt(t).leftAt(t).build());

    assertThat(MeetingAccess.isInside(m, "a")).isTrue();
    assertThat(MeetingAccess.isInside(m, "b")).isFalse();
    assertThat(MeetingAccess.isInside(m, "nobody")).isFalse();
    assertThat(MeetingAccess.isInside(m, null)).isFalse();
  }

  @Test
  void recordsStayReadableForEveryoneWhoBelongedEvenAfterTheEnd() {
    m.setStatus(MeetingStatus.ENDED);
    m.getAttendance()
        .add(Meeting.Attendance.builder().userId("walkin").joinedAt(Instant.now()).build());

    assertThat(MeetingAccess.canReadRecords(m, "host", List.of(), false)).isTrue();
    assertThat(MeetingAccess.canReadRecords(m, "co", List.of(), false)).isTrue();
    assertThat(MeetingAccess.canReadRecords(m, "inv", List.of(), false)).isTrue();
    assertThat(MeetingAccess.canReadRecords(m, "x", List.of("dept-a"), false)).isTrue();
    assertThat(MeetingAccess.canReadRecords(m, "walkin", List.of(), false)).isTrue();
    assertThat(MeetingAccess.canReadRecords(m, "let-in", List.of(), true)).isTrue();
    assertThat(MeetingAccess.canReadRecords(m, "stranger", List.of(), false)).isFalse();
    assertThat(MeetingAccess.canReadRecords(m, "stranger", null, false)).isFalse();
  }

  @Test
  void removedPeopleLoseTheRecordsToo() {
    m.getRemovedIds().add("inv");
    assertThat(MeetingAccess.canReadRecords(m, "inv", List.of("dept-a"), true)).isFalse();
    assertThat(MeetingAccess.canEditSharedNote(m, "inv", List.of("dept-a"), true)).isFalse();
  }

  @Test
  void sharedNotesAreEditableByManagersAlwaysAndByOthersOnlyWhenAllowed() {
    assertThat(MeetingAccess.canEditSharedNote(m, "inv", List.of(), false)).isTrue();

    m.getSettings().setAttendeesCanEditNotes(false);
    assertThat(MeetingAccess.canEditSharedNote(m, "inv", List.of(), false)).isFalse();
    assertThat(MeetingAccess.canEditSharedNote(m, "host", List.of(), false)).isTrue();
    assertThat(MeetingAccess.canEditSharedNote(m, "co", List.of(), false)).isTrue();

    m.getSettings().setAttendeesCanEditNotes(true);
    assertThat(MeetingAccess.canEditSharedNote(m, "stranger", List.of(), false)).isFalse();
  }

  @Test
  void theHostOutranksEveryoneElseAndCoHostsOnlyAttendees() {
    m.getCoHostIds().add("co2");

    assertThat(MeetingAccess.outranks(m, "host", "co")).isTrue();
    assertThat(MeetingAccess.outranks(m, "host", "inv")).isTrue();
    assertThat(MeetingAccess.outranks(m, "co", "inv")).isTrue();
    assertThat(MeetingAccess.outranks(m, "co", "stranger")).isTrue();
    assertThat(MeetingAccess.outranks(m, "co", "co2")).isFalse();
    assertThat(MeetingAccess.outranks(m, "co", "host")).isFalse();
    assertThat(MeetingAccess.outranks(m, "inv", "stranger")).isFalse();
    assertThat(MeetingAccess.outranks(m, "host", "host")).isFalse();
  }
```

- [ ] **Step 2: RED** — `MVN test -Dtest=MeetingAccessTest` ⇒ compile error.
- [ ] **Step 3: Hiện thực** 4 hàm (list `null` coi như rỗng, `Objects.equals`).
- [ ] **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingAccessTest,MeetingJoinServiceTest'`
- [ ] **Step 5: Commit** `feat(meetings): access rules for hands, chat, notes and host commands`

---

### Task 2: `LiveKitRoomClient.updateParticipant`

**Files:**
- Modify: `M/service/rtc/LiveKitRoomClient.java`
- Test: `T/service/rtc/LiveKitRoomClientTest.java` (dùng `sentRequest()` / `bodyOf()` sẵn có)

**Interfaces — Produces:** `public void updateParticipant(String room, String identity, List<String> publishSources)` — Twirp `UpdateParticipant`, body `{"room", "identity", "permission": {"can_publish": true, "can_subscribe": true, "can_publish_data": true, "can_publish_sources": [...]}}`. `publishSources` dùng hằng của `RtcGrant` (`"camera"`, `"microphone"`, `"screen_share"`, `"screen_share_audio"`) và được đổi sang tên enum proto `TrackSource` viết hoa (`toUpperCase(Locale.ROOT)` ⇒ `"CAMERA"`…); `null` hoặc rỗng ⇒ `[]` (LiveKit hiểu là mọi nguồn). Thay **cả** object `permission` (LiveKit không merge) — vì token không cấp gì ngoài 3 quyền trên nên không mất quyền nào.

- [ ] **Step 1: Test**

```java
  @Test
  void updateParticipantReplacesThePublishPermission() throws Exception {
    client.updateParticipant(
        "meet_1", "user-1", List.of(RtcGrant.CAMERA, RtcGrant.MICROPHONE));

    HttpRequest request = sentRequest();
    assertThat(request.uri().getPath())
        .isEqualTo("/twirp/livekit.RoomService/UpdateParticipant");
    assertThat(new ObjectMapper().readValue(bodyOf(request), Map.class))
        .isEqualTo(
            Map.of(
                "room", "meet_1",
                "identity", "user-1",
                "permission",
                    Map.of(
                        "can_publish", true,
                        "can_subscribe", true,
                        "can_publish_data", true,
                        "can_publish_sources", List.of("CAMERA", "MICROPHONE"))));
  }

  @Test
  void updateParticipantWithoutASourceListAllowsEverySource() throws Exception {
    client.updateParticipant("meet_1", "user-1", null);

    Map<?, ?> body = new ObjectMapper().readValue(bodyOf(sentRequest()), Map.class);
    assertThat(((Map<?, ?>) body.get("permission")).get("can_publish_sources"))
        .isEqualTo(List.of());
  }
```

- [ ] **Step 2: RED** · **Step 3: Hiện thực** (`LinkedHashMap` lồng nhau, `call("UpdateParticipant", room, body)`) · **Step 4: GREEN** `MVN spotless:apply && MVN test -Dtest=LiveKitRoomClientTest`
- [ ] **Step 5: Commit** `feat(rtc): UpdateParticipant for publish permissions`

---

### Task 3: Phụ trợ — DTO, mã lỗi, `MeetingHostAction`, `MeetingLobby` (bị mời ra), `MeetingEvents` (sự kiện mới)

**Files:**
- Create `M/dto/meeting/` (record, `@JsonInclude(NON_NULL)`):
  - `HandDto(String userId, String displayName, Instant raisedAt)`
  - `MeetingMessageDto(String id, PersonDto sender, String content, Instant createdAt)`
  - `MeetingNoteDto(String scope, String content, long version, PersonDto updatedBy, Instant updatedAt)` — `scope` ∈ `"shared" | "private"`
  - `MeetingNoteRequest(String content, Long version)` — `Long` để phân biệt "thiếu" với `0`
  - `MeetingHandsResponse(List<HandDto> hands)`
  - `MeetingHandCommand(String meetingId, Boolean raised)`, `MeetingChatCommand(String meetingId, String content, String clientId)`, `MeetingHostCommand(String meetingId, String action, String targetId)` — payload STOMP C→S
- Modify `M/dto/meeting/MeetingEventDto.java` — thêm field: `List<HandDto> hands`, `MeetingMessageDto message`, `Long version`, `PersonDto updatedBy`, `PersonDto actor`, `String action`, `String clientId`, `String errorCode`, `Map<String, Object> params`. Sửa javadoc của `event`.
- Create `M/service/meeting/MeetingHostAction.java` — enum 13 giá trị của Contract, `boolean needsTarget()` (true cho `MUTE_MIC, REMOVE, LOWER_HAND, MAKE_COHOST, REVOKE_COHOST`), `static Optional<MeetingHostAction> parse(String raw)` (khớp **chính xác** tên, `null`/lạ ⇒ rỗng — không `valueOf` để không ném).
- Modify `M/exception/ErrorCodes.java` — `MEETING_NOTE_CONFLICT`, `MEETING_NOTES_READ_ONLY`, `RATE_LIMITED` (chưa có hằng — `ChatController` đang dùng chuỗi literal; không sửa `ChatController`) + javadoc.
- Modify `M/service/meeting/MeetingLobby.java` — key `meet:removed:{id}` (set): `void markRemoved(meetingId, userId)` (SADD + expire `TTL` + `SREM meet:admitted:{id} userId`), `boolean isRemoved(meetingId, userId)`; `static String removedKey(id)`; `clear` xoá **4** key. Sửa javadoc lớp (bỏ chữ "(MT3)").
- Modify `M/service/meeting/MeetingEvents.java`:
  - `roster(Meeting m)` — `role` của mỗi dòng = `MeetingAccess.roleOf(m, userId)` (vai trò **hiện tại**, Sai khác #7)
  - `hands(String meetingId, List<HandDto> hands)` ⇒ topic `meet.hands` (`hands` luôn có mặt, kể cả `[]`)
  - `chat(String meetingId, MeetingMessageDto message, String clientId)` ⇒ topic `meet.chat`
  - `notesUpdated(String meetingId, long version, PersonDto updatedBy)` ⇒ topic `meet.notes.updated`
  - `removed(String meetingId, String userId)` ⇒ user `meet.removed`
  - `muted(String meetingId, String userId, PersonDto actor)` ⇒ user `meet.muted`
  - `error(String userId, String meetingId, String action, String clientId, String errorCode, Map<String, Object> params)` ⇒ user `meet.error`
- Test: `T/service/meeting/MeetingLobbyTest.java`, `T/service/meeting/MeetingEventsTest.java`, `T/service/meeting/MeetingHostActionTest.java` (mới)

`MeetingEvents` phải giữ < 300 dòng (hiện 185).

- [ ] **Step 1: Test** — `MeetingLobbyTest`: đổi `clearDropsEverythingTheMeetingKeptInRedis` thành

```java
  @Test
  void clearDropsEverythingTheMeetingKeptInRedis() {
    lobby.clear("m1");
    verify(redis)
        .delete(
            List.of("meet:lobby:m1", "meet:admitted:m1", "meet:hands:m1", "meet:removed:m1"));
  }

  @Test
  void removedPeopleAreRememberedAndLoseTheirAdmission() {
    lobby.markRemoved("m1", "u1");

    verify(sets).add("meet:removed:m1", "u1");
    verify(sets).remove("meet:admitted:m1", "u1");
    verify(redis).expire("meet:removed:m1", Duration.ofHours(24));

    when(sets.isMember("meet:removed:m1", "u1")).thenReturn(true);
    assertThat(lobby.isRemoved("m1", "u1")).isTrue();
    assertThat(lobby.isRemoved("m1", "u2")).isFalse();
  }
```

`MeetingEventsTest` — thêm (import `com.platform.chatservice.dto.meeting.HandDto`, `MeetingMessageDto`, `PersonDto`, `static org.mockito.ArgumentMatchers.any`, `java.util.Map`):

```java
  @Test
  void rosterReportsEachPersonsCurrentRoleNotTheRoleTheyJoinedWith() {
    Instant t = Instant.parse("2026-10-08T02:00:00Z");
    m.getAttendance().add(row("co", "Co", t, null)); // row() records role "attendee"

    events.roster(m);

    assertThat(toTopic().getParticipants())
        .singleElement()
        .satisfies(p -> assertThat(p.role()).isEqualTo("cohost"));
  }

  @Test
  void handsGoToTheRoomInOrderAndAnEmptyListIsStillSent() {
    Instant t = Instant.parse("2026-10-08T02:06:00Z");
    events.hands("m1", List.of(new HandDto("a", "An", t), new HandDto("b", null, t)));

    MeetingEventDto e = toTopic();
    assertThat(e.getEvent()).isEqualTo("meet.hands");
    assertThat(e.getHands()).extracting(HandDto::userId).containsExactly("a", "b");
  }

  @Test
  void noHandsIsAnEmptyListNotAMissingField() {
    events.hands("m1", List.of());
    assertThat(toTopic().getHands()).isNotNull().isEmpty();
  }

  @Test
  void chatCarriesTheMessageAndEchoesTheClientId() {
    MeetingMessageDto msg =
        new MeetingMessageDto("x1", new PersonDto("a", "An", null), "hi", Instant.EPOCH);

    events.chat("m1", msg, "c-1");

    MeetingEventDto e = toTopic();
    assertThat(e.getEvent()).isEqualTo("meet.chat");
    assertThat(e.getMessage()).isEqualTo(msg);
    assertThat(e.getClientId()).isEqualTo("c-1");
  }

  @Test
  void noteUpdatesCarryTheVersionAndWhoButNeverTheText() {
    events.notesUpdated("m1", 8, new PersonDto("a", "An", null));

    MeetingEventDto e = toTopic();
    assertThat(e.getEvent()).isEqualTo("meet.notes.updated");
    assertThat(e.getVersion()).isEqualTo(8L);
    assertThat(e.getUpdatedBy()).isEqualTo(new PersonDto("a", "An", null));
    assertThat(e.getMessage()).isNull();
  }

  @Test
  void removedMutedAndErrorsArePersonalNeverBroadcast() {
    events.removed("m1", "u1");
    events.muted("m1", "u1", new PersonDto("host", "Lan", null));
    events.error(
        "u1", "m1", "REMOVE", null, "MEETING_INVALID", Map.of("field", "targetId"));

    List<MeetingEventDto> got = toUser("u1");
    assertThat(got)
        .extracting(MeetingEventDto::getEvent)
        .containsExactly("meet.removed", "meet.muted", "meet.error");
    assertThat(got.get(1).getActor().displayName()).isEqualTo("Lan");
    assertThat(got.get(2).getErrorCode()).isEqualTo("MEETING_INVALID");
    assertThat(got.get(2).getAction()).isEqualTo("REMOVE");
    assertThat(got.get(2).getParams()).containsEntry("field", "targetId");
    assertThat(got.get(2).getCode()).isNull(); // `code` is the meeting code, never an error
    verify(broker, never()).convertAndSend(anyString(), any(Object.class));
  }
```

`MeetingHostActionTest`

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class MeetingHostActionTest {

  @Test
  void exactlyTheMilestoneActions() {
    assertThat(Arrays.stream(MeetingHostAction.values()).map(Enum::name))
        .containsExactly(
            "MUTE_MIC", "MUTE_ALL", "REMOVE", "LOWER_HAND", "LOWER_ALL_HANDS", "LOCK", "UNLOCK",
            "WAITING_ROOM_ON", "WAITING_ROOM_OFF", "ATTENDEE_SCREEN_SHARE_ON",
            "ATTENDEE_SCREEN_SHARE_OFF", "MAKE_COHOST", "REVOKE_COHOST");
  }

  @Test
  void onlyPersonActionsNeedATarget() {
    assertThat(Arrays.stream(MeetingHostAction.values()).filter(MeetingHostAction::needsTarget))
        .containsExactlyInAnyOrder(
            MeetingHostAction.MUTE_MIC,
            MeetingHostAction.REMOVE,
            MeetingHostAction.LOWER_HAND,
            MeetingHostAction.MAKE_COHOST,
            MeetingHostAction.REVOKE_COHOST);
  }

  @Test
  void parseIsExactAndNeverThrows() {
    assertThat(MeetingHostAction.parse("LOCK")).contains(MeetingHostAction.LOCK);
    assertThat(MeetingHostAction.parse("lock")).isEmpty();
    assertThat(MeetingHostAction.parse("DROP_TABLE")).isEmpty();
    assertThat(MeetingHostAction.parse(null)).isEmpty();
  }
}
```

- [ ] **Step 2: RED** — `MVN test -Dtest='MeetingLobbyTest,MeetingEventsTest,MeetingHostActionTest'`
- [ ] **Step 3: Hiện thực** như mục Files.
- [ ] **Step 4: GREEN** — cùng lệnh + `MeetingCloserTest,MeetingServiceTest` (dùng `lobby.clear`)
- [ ] **Step 5: Commit** `feat(meetings): MT3 events, DTOs, error codes and the removed set`

---

### Task 4: `MeetingGuard` — tìm cuộc họp + kiểm quyền dùng chung

**Files:**
- Create: `M/service/meeting/MeetingGuard.java`
- Test: `T/service/meeting/MeetingGuardTest.java`

**Interfaces — Produces** (`@Component @RequiredArgsConstructor MeetingGuard(MeetingStore store, MeetingLobby lobby)`):
- `Meeting find(String meetingId)` — `null`/blank ⇒ 404 `MEETING_NOT_FOUND` **không** chạm DB; không có ⇒ 404 (`MeetingService.notFound()`).
- `Meeting inRoom(UserPrincipal caller, String meetingId)` — `find` → `MeetingAccess.decide(m, uid, caller.getDepts(), lobby.isAdmitted(id, uid))`: `DENIED_ENDED` ⇒ 409 `MEETING_ENDED`; `DENIED_REMOVED` ⇒ 403 `MEETING_REMOVED`; không `entersRoom()` (`MUST_WAIT`, `DENIED_LOCKED`) ⇒ 403 `MEETING_FORBIDDEN`; ngược lại trả `m`. Dùng cho giơ tay, chat, `GET /hands`.
- `Meeting records(UserPrincipal caller, String meetingId)` — `find` → bị mời ra ⇒ 403 `MEETING_REMOVED`; không `canReadRecords(m, uid, depts, admitted)` ⇒ 403 `MEETING_FORBIDDEN`. Không xét ENDED. Dùng cho lịch sử chat, ghi chú.
- `boolean admitted(String meetingId, String userId)` — `lobby.isAdmitted` (cho `canEditSharedNote`).

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingGuardTest {

  @Mock private MeetingStore store;
  @Mock private MeetingLobby lobby;
  @InjectMocks private MeetingGuard guard;
  private Meeting m;

  private final UserPrincipal host = new UserPrincipal("host");
  private final UserPrincipal invitee = new UserPrincipal("inv");
  private final UserPrincipal stranger = new UserPrincipal("stranger");

  @BeforeEach
  void setUp() {
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .build();
    when(store.findById("m1")).thenReturn(Optional.of(m));
    when(store.findById("nope")).thenReturn(Optional.empty());
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  @Test
  void unknownAndBlankIdsAreNotFoundAndBlankNeverHitsTheDatabase() {
    assertThat(apiError(() -> guard.find(" ")).code()).isEqualTo("MEETING_NOT_FOUND");
    assertThat(apiError(() -> guard.find(null)).status()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(apiError(() -> guard.find("nope")).code()).isEqualTo("MEETING_NOT_FOUND");
    verify(store, never()).findById(" ");
  }

  @Test
  void inRoomLetsInExactlyThePeopleWhoGetAToken() {
    assertThat(guard.inRoom(host, "m1")).isSameAs(m);
    assertThat(guard.inRoom(invitee, "m1")).isSameAs(m);

    when(lobby.isAdmitted("m1", "stranger")).thenReturn(true);
    assertThat(guard.inRoom(stranger, "m1")).isSameAs(m);
  }

  @Test
  void inRoomRefusalsCarryTheirOwnCodes() {
    ApiException waiting = apiError(() -> guard.inRoom(stranger, "m1")); // waiting room on
    assertThat(waiting.status()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(waiting.code()).isEqualTo("MEETING_FORBIDDEN");

    m.getRemovedIds().add("inv");
    assertThat(apiError(() -> guard.inRoom(invitee, "m1")).code()).isEqualTo("MEETING_REMOVED");

    m.setStatus(MeetingStatus.ENDED);
    ApiException ended = apiError(() -> guard.inRoom(host, "m1"));
    assertThat(ended.status()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(ended.code()).isEqualTo("MEETING_ENDED");
  }

  @Test
  void recordsOutliveTheMeetingButNotARemoval() {
    m.setStatus(MeetingStatus.ENDED);
    assertThat(guard.records(invitee, "m1")).isSameAs(m);
    assertThat(apiError(() -> guard.records(stranger, "m1")).code())
        .isEqualTo("MEETING_FORBIDDEN");

    when(lobby.isAdmitted("m1", "stranger")).thenReturn(true);
    assertThat(guard.records(stranger, "m1")).isSameAs(m);

    m.getRemovedIds().add("inv");
    assertThat(apiError(() -> guard.records(invitee, "m1")).code()).isEqualTo("MEETING_REMOVED");
  }
}
```

- [ ] **Step 2: RED** — `MVN test -Dtest=MeetingGuardTest`
- [ ] **Step 3: Hiện thực.**
- [ ] **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest=MeetingGuardTest`
- [ ] **Step 5: Commit** `feat(meetings): shared meeting access guard`

---

### Task 5: `MeetingHandService` — giơ tay theo thứ tự

**Files:**
- Create: `M/service/meeting/MeetingHandService.java`
- Test: `T/service/meeting/MeetingHandServiceTest.java`

**Interfaces — Produces** (`@Service @RequiredArgsConstructor MeetingHandService(StringRedisTemplate redis, MeetingGuard guard, MeetingPeople people, MeetingEvents events)`); key = `MeetingLobby.handsKey(id)` (`meet:hands:{id}`, zset userId → epoch ms):
- `void setHand(UserPrincipal caller, String meetingId, boolean raised)` — `guard.inRoom` (ném lỗi) → `raised`: `opsForZSet().addIfAbsent(key, uid, nowMillis)` (**ZADD NX** — giơ lại không đổi chỗ); true ⇒ `expire(key, MeetingLobby.TTL)` + `publish`; false ⇒ không làm gì. `!raised`: `lower(meetingId, uid)`.
- `boolean lower(String meetingId, String userId)` — `ZREM`; `== 1` ⇒ `publish`, true. **Không** kiểm quyền (người gọi là host service đã kiểm, hoặc webhook rời phòng).
- `void lowerAll(String meetingId)` — `redis.delete(key)`; true ⇒ `events.hands(id, List.of())`.
- `List<HandDto> hands(String meetingId)` — `rangeWithScores(key, 0, -1)` (Redis đã sắp theo điểm tăng dần — giữ nguyên thứ tự trả về), tên qua **một** `people.profiles(ids)`, `raisedAt = Instant.ofEpochMilli(score)`; `MeetingMapper.person(...)` fallback — không bao giờ dùng id làm tên.
- `MeetingHandsResponse snapshot(UserPrincipal caller, String meetingId)` — `guard.inRoom` → `new MeetingHandsResponse(hands(id))`.
- `private void publish(String meetingId)` ⇒ `events.hands(meetingId, hands(meetingId))`.

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.HandDto;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.DefaultTypedTuple;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.data.redis.core.ZSetOperations.TypedTuple;
import org.springframework.http.HttpStatus;

class MeetingHandServiceTest {

  private static final String KEY = "meet:hands:m1";

  private StringRedisTemplate redis;
  private ZSetOperations<String, String> zset;
  private MeetingGuard guard;
  private MeetingPeople people;
  private MeetingEvents events;
  private MeetingHandService service;
  private final UserPrincipal an = new UserPrincipal("a");

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    redis = mock(StringRedisTemplate.class);
    zset = mock(ZSetOperations.class);
    guard = mock(MeetingGuard.class);
    people = mock(MeetingPeople.class);
    events = mock(MeetingEvents.class);
    when(redis.opsForZSet()).thenReturn(zset);
    when(people.profiles(anyCollection()))
        .thenReturn(Map.of("a", new PersonDto("a", "An", null)));
    service = new MeetingHandService(redis, guard, people, events);
  }

  /** What ZRANGE … WITHSCORES returns: already in score (raise-time) order. */
  private void handsInRedis(Object... idThenMillis) {
    Set<TypedTuple<String>> rows = new LinkedHashSet<>();
    for (int i = 0; i < idThenMillis.length; i += 2) {
      rows.add(
          new DefaultTypedTuple<>(
              (String) idThenMillis[i], ((Long) idThenMillis[i + 1]).doubleValue()));
    }
    when(zset.rangeWithScores(KEY, 0, -1)).thenReturn(rows);
  }

  @Test
  void raisingAgainKeepsYourPlaceAndAnnouncesNothing() {
    when(zset.addIfAbsent(eq(KEY), eq("a"), anyDouble())).thenReturn(true).thenReturn(false);
    handsInRedis("a", 1_000L);

    service.setHand(an, "m1", true);
    service.setHand(an, "m1", true);

    verify(zset, never()).add(anyString(), anyString(), anyDouble()); // a plain ZADD moves you
    verify(redis, times(1)).expire(KEY, MeetingLobby.TTL);
    verify(events, times(1)).hands(eq("m1"), any());
  }

  @Test
  void theListIsInRaiseOrderWithNamesFromOneLookupAndNeverIdsAsNames() {
    handsInRedis("a", 1_000L, "b", 2_000L);

    List<HandDto> hands = service.hands("m1");

    assertThat(hands)
        .containsExactly(
            new HandDto("a", "An", Instant.ofEpochMilli(1_000)),
            new HandDto("b", null, Instant.ofEpochMilli(2_000)));
    verify(people, times(1)).profiles(anyCollection());
  }

  @Test
  void loweringYourOwnHandAnnouncesOnlyARealChange() {
    when(zset.remove(KEY, "a")).thenReturn(1L).thenReturn(0L);
    handsInRedis();

    service.setHand(an, "m1", false);
    service.setHand(an, "m1", false);

    verify(events, times(1)).hands("m1", List.of());
  }

  @Test
  void refusalsComeFromTheGuardAndTouchNothing() {
    when(guard.inRoom(any(), eq("m1")))
        .thenThrow(new ApiException(HttpStatus.CONFLICT, "MEETING_ENDED"));

    assertThatThrownBy(() -> service.setHand(an, "m1", true))
        .isInstanceOf(ApiException.class)
        .extracting(e -> ((ApiException) e).code())
        .isEqualTo("MEETING_ENDED");
    verifyNoInteractions(zset, events);
  }

  @Test
  void lowerAllAnnouncesAnEmptyListOnlyWhenThereWereHands() {
    when(redis.delete(KEY)).thenReturn(true).thenReturn(false);

    service.lowerAll("m1");
    service.lowerAll("m1");

    verify(events, times(1)).hands("m1", List.of());
  }

  @Test
  void lowerSomeoneElseSkipsTheGuardBecauseTheCallerAlreadyChecked() {
    when(zset.remove(KEY, "b")).thenReturn(1L);
    handsInRedis();

    assertThat(service.lower("m1", "b")).isTrue();

    verifyNoInteractions(guard);
    verify(events).hands("m1", List.of());
  }

  @Test
  void theSnapshotNeedsRoomAccess() {
    handsInRedis("a", 1_000L);

    assertThat(service.snapshot(an, "m1").hands()).extracting(HandDto::userId).containsExactly("a");
    verify(guard).inRoom(an, "m1");
  }
}
```

- [ ] **Step 2: RED** — `MVN test -Dtest=MeetingHandServiceTest`
- [ ] **Step 3: Hiện thực** như Interfaces (`Instant.now().toEpochMilli()` làm điểm; tie hiếm khi bằng nhau — Redis sắp tiếp theo member, chấp nhận).
- [ ] **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingHandServiceTest,MeetingLobbyTest'`
- [ ] **Step 5: Commit** `feat(meetings): raised hands in order`

---

### Task 6: `MeetingChatService` — chat trong họp + lịch sử

**Files:**
- Create: `M/service/meeting/MeetingChatService.java`
- Test: `T/service/meeting/MeetingChatServiceTest.java` — `@DataMongoTest @Testcontainers` như `MeetingStoreTest`

**Interfaces — Produces** (`@Service @RequiredArgsConstructor MeetingChatService(MongoTemplate mongo, MeetingGuard guard, MeetingPeople people, MeetingEvents events, RateLimiterService rateLimiter)`); hằng `CONTENT_MAX = 2000`, `DEFAULT_PAGE_SIZE = 50`, `CLIENT_ID = Pattern.compile("[A-Za-z0-9_-]{1,64}")`:
- `MeetingMessageDto send(UserPrincipal caller, String meetingId, String content, String clientId)` — thứ tự: `guard.inRoom` → `text = content.trim()`; `null`/rỗng ⇒ `MeetingRequests.invalid("content")`; > 2000 ⇒ `invalid("content", 2000)` → `rateLimiter.checkMessageRate(uid)` (ném `RateLimitExceededException`; kiểm **sau** validate nên tin hỏng không ăn hạn mức) → `mongo.insert(MeetingMessage{meetingId, senderId: uid, content: text, createdAt: now})` → DTO (`sender` = `MeetingMapper.person(uid, people.profiles(List.of(uid)))`) → `events.chat(meetingId, dto, clientId hợp lệ ? clientId : null)` → trả DTO.
- `PageResponse<MeetingMessageDto> history(UserPrincipal caller, String meetingId, String before, int size)` — `guard.records` → `limit = PageLimits.size(size, 50)` → `before` có mặt: `mongo.findById(before, MeetingMessage.class)`; không có / thuộc cuộc họp khác / `createdAt == null` ⇒ trang rỗng `new PageResponse<>(List.of(), 0, limit, 0)` → query `{meetingId}` + cursor compound `(createdAt, _id) <` (như `MessageQueryService.queryMessagePage`, `_id` so theo `ObjectId` khi hợp lệ) → sort `createdAt desc, _id desc`, `limit + 1` → tên cả trang qua **một** `people.profiles` → `PageResponse(content, 0, limit, hasMore ? limit + 1 : content.size())`.

Index `{meetingId: 1, createdAt: 1}` đã có trên model (MT2) — Mongo dùng được cho sort ngược.

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.meeting.MeetingMessageDto;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.RateLimitExceededException;
import com.platform.chatservice.model.MeetingMessage;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.RateLimiterService;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataMongoTest
@Testcontainers
class MeetingChatServiceTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  private static final String ID1 = "64b000000000000000000001";
  private static final String ID2 = "64b000000000000000000002";
  private static final String ID3 = "64b000000000000000000003";
  private static final String ID4 = "64b000000000000000000004";
  private static final String OTHER = "64b000000000000000000009";

  @Autowired private MongoTemplate template;
  private MeetingGuard guard;
  private MeetingPeople people;
  private MeetingEvents events;
  private RateLimiterService rateLimiter;
  private MeetingChatService chat;
  private final UserPrincipal an = new UserPrincipal("a");

  @BeforeEach
  void setUp() {
    template.dropCollection(MeetingMessage.class);
    guard = mock(MeetingGuard.class);
    people = mock(MeetingPeople.class);
    events = mock(MeetingEvents.class);
    rateLimiter = mock(RateLimiterService.class);
    when(people.profiles(anyCollection()))
        .thenReturn(Map.of("a", new PersonDto("a", "An", null)));
    chat = new MeetingChatService(template, guard, people, events, rateLimiter);
  }

  private void stored(String id, String meetingId, Instant at) {
    template.insert(
        MeetingMessage.builder()
            .id(id)
            .meetingId(meetingId)
            .senderId("a")
            .content("t-" + id)
            .createdAt(at)
            .build());
  }

  private long count() {
    return template.count(new Query(), MeetingMessage.class);
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  @Test
  void sendStoresTrimmedTextAndTellsTheRoomWithTheSendersName() {
    MeetingMessageDto dto = chat.send(an, "m1", "  hello  ", "c-1");

    assertThat(dto.id()).isNotBlank();
    assertThat(dto.content()).isEqualTo("hello");
    assertThat(dto.sender()).isEqualTo(new PersonDto("a", "An", null));
    MeetingMessage saved = template.findById(dto.id(), MeetingMessage.class);
    assertThat(saved.getMeetingId()).isEqualTo("m1");
    assertThat(saved.getSenderId()).isEqualTo("a");
    assertThat(saved.getContent()).isEqualTo("hello");
    verify(guard).inRoom(an, "m1");
    verify(rateLimiter).checkMessageRate("a");
    verify(events).chat("m1", dto, "c-1");
  }

  @Test
  void aMalformedClientIdIsDroppedNotRefused() {
    chat.send(an, "m1", "hi", "has space");
    chat.send(an, "m1", "hi", "x".repeat(65));

    verify(events, times(2)).chat(eq("m1"), any(), isNull());
    assertThat(count()).isEqualTo(2);
  }

  @Test
  void emptyOrTooLongIsRefusedBeforeTheRateLimitAndNothingIsStored() {
    for (String bad : new String[] {null, "", "   "}) {
      ApiException e = apiError(() -> chat.send(an, "m1", bad, null));
      assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST);
      assertThat(e.code()).isEqualTo("MEETING_INVALID");
      assertThat(e.getParams()).isEqualTo(Map.of("field", "content"));
    }
    assertThat(apiError(() -> chat.send(an, "m1", "x".repeat(2001), null)).getParams())
        .isEqualTo(Map.of("field", "content", "max", 2000));
    assertThat(count()).isZero();
    verify(rateLimiter, never()).checkMessageRate(any());

    chat.send(an, "m1", "x".repeat(2000), null); // the limit itself is fine
    assertThat(count()).isEqualTo(1);
  }

  @Test
  void theGuardDecidesWhoMayTalk() {
    when(guard.inRoom(any(), eq("m1")))
        .thenThrow(new ApiException(HttpStatus.FORBIDDEN, "MEETING_REMOVED"));

    assertThat(apiError(() -> chat.send(an, "m1", "hi", null)).code())
        .isEqualTo("MEETING_REMOVED");
    assertThat(count()).isZero();
    verifyNoInteractions(events, rateLimiter);
  }

  @Test
  void aRateLimitedSendIsNotStored() {
    doThrow(new RateLimitExceededException()).when(rateLimiter).checkMessageRate("a");

    assertThatThrownBy(() -> chat.send(an, "m1", "hi", null))
        .isInstanceOf(RateLimitExceededException.class);
    assertThat(count()).isZero();
    verifyNoInteractions(events);
  }

  @Test
  void historyIsNewestFirstAndTheCursorNeverSkipsATimestampTie() {
    Instant t = Instant.parse("2026-10-08T02:00:00Z");
    stored(ID1, "m1", t);
    stored(ID2, "m1", t);
    stored(ID3, "m1", t);
    stored(ID4, "m1", t.plusSeconds(1));
    stored(OTHER, "m2", t.plusSeconds(5));

    PageResponse<MeetingMessageDto> first = chat.history(an, "m1", null, 2);
    assertThat(first.content()).extracting(MeetingMessageDto::id).containsExactly(ID4, ID3);
    assertThat(first.hasNext()).isTrue();
    assertThat(first.content().get(0).sender().displayName()).isEqualTo("An");

    PageResponse<MeetingMessageDto> second = chat.history(an, "m1", ID3, 2);
    assertThat(second.content()).extracting(MeetingMessageDto::id).containsExactly(ID2, ID1);
    assertThat(second.hasNext()).isFalse();
  }

  @Test
  void aCursorFromAnotherMeetingOrUnknownGivesAnEmptyPage() {
    stored(OTHER, "m2", Instant.now());

    assertThat(chat.history(an, "m1", OTHER, 10).content()).isEmpty();
    assertThat(chat.history(an, "m1", "64b0000000000000000000ff", 10).content()).isEmpty();
  }

  @Test
  void historyNeedsRecordAccessAndLooksNamesUpOncePerPage() {
    Instant t = Instant.parse("2026-10-08T02:00:00Z");
    stored(ID1, "m1", t);
    stored(ID2, "m1", t.plusSeconds(1));

    chat.history(an, "m1", null, 10);

    verify(guard).records(an, "m1");
    verify(guard, never()).inRoom(any(), any());
    verify(people, times(1)).profiles(anyCollection());
  }
}
```

- [ ] **Step 2: RED** — `MVN test -Dtest=MeetingChatServiceTest`
- [ ] **Step 3: Hiện thực** như Interfaces.
- [ ] **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingChatServiceTest,MeetingGuardTest'`
- [ ] **Step 5: Commit** `feat(meetings): in-meeting chat with history`

---

### Task 7: `MeetingNotesService` — ghi chú chung + riêng, khoá lạc quan

**Files:**
- Create: `M/service/meeting/MeetingNotesService.java`
- Create: `M/exception/MeetingNoteConflictException.java` — `@Getter class MeetingNoteConflictException extends ApiException` với `private final MeetingNoteDto latest`; constructor `(MeetingNoteDto latest)` ⇒ `super(HttpStatus.CONFLICT, ErrorCodes.MEETING_NOTE_CONFLICT)`.
- Modify: `M/exception/GlobalExceptionHandler.java` — `@ExceptionHandler(MeetingNoteConflictException.class) handleNoteConflict(ex)`: body của `handleApi(ex)` (copy sang `LinkedHashMap`) + `"latest": ex.getLatest()`; status 409. Spring chọn handler gần nhất theo cây kế thừa nên `handleApi` không bắt nó nữa.
- Test: `T/service/meeting/MeetingNotesServiceTest.java` (`@DataMongoTest @Testcontainers`), `T/exception/GlobalExceptionHandlerParamsTest.java` (thêm 1 test)

**Interfaces — Produces** (`@Service @RequiredArgsConstructor MeetingNotesService(MongoTemplate mongo, MeetingGuard guard, MeetingPeople people, MeetingEvents events)`); `public enum Scope { SHARED, PRIVATE }` lồng trong lớp (`wire()` = `"shared" | "private"`; lưu Mongo bằng `name()` — đúng comment của `MeetingNote.scope`); hằng `CONTENT_MAX = 50_000`:
- `MeetingNoteDto get(UserPrincipal caller, String meetingId, Scope scope)` — `guard.records` → tài liệu `{meetingId, scope: name(), ownerId: PRIVATE ? uid : null}`; không có ⇒ `new MeetingNoteDto(wire, "", 0, null, null)`.
- `MeetingNoteDto put(UserPrincipal caller, String meetingId, Scope scope, MeetingNoteRequest req)` — thứ tự:
  1. `Meeting m = guard.records(caller, id)`
  2. `SHARED` và `!MeetingAccess.canEditSharedNote(m, uid, caller.getDepts(), guard.admitted(id, uid))` ⇒ 403 `MEETING_NOTES_READ_ONLY`
  3. `req == null || req.content() == null` ⇒ `invalid("content")`; `length > 50_000` ⇒ `invalid("content", 50_000)`; `req.version() == null || < 0` ⇒ `invalid("version")`. **Không** trim nội dung.
  4. `version == 0` ⇒ `mongo.insert(MeetingNote{…, version: 1, updatedBy: uid, updatedAt: now})`; `DuplicateKeyException` (người khác vừa tạo — unique index `{meetingId, scope, ownerId}`, `ownerId` vắng = null) ⇒ ném `MeetingNoteConflictException(get-hiện-tại)`.
  5. `version > 0` ⇒ `findAndModify({meetingId, scope, ownerId (is null cho SHARED), version: v}, $set content/updatedBy/updatedAt + $inc version 1, returnNew)`; `null` ⇒ `MeetingNoteConflictException(get-hiện-tại)`.
  6. DTO (`updatedBy` = `MeetingMapper.person(uid, people.profiles(List.of(uid)))`); `SHARED` ⇒ `events.notesUpdated(id, version, updatedBy)`. Ghi chú riêng **không** phát gì.
- Không xét `status` — sửa được sau ENDED (Sai khác #15).

- [ ] **Step 1: Test** — `MeetingNotesServiceTest`

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.MeetingNoteDto;
import com.platform.chatservice.dto.meeting.MeetingNoteRequest;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.MeetingNoteConflictException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingNote;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.meeting.MeetingNotesService.Scope;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataMongoTest
@Testcontainers
class MeetingNotesServiceTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired private MongoTemplate template;
  @Autowired private MongoMappingContext mappingContext;
  private MeetingGuard guard;
  private MeetingEvents events;
  private MeetingNotesService notes;
  private Meeting m;

  private final UserPrincipal host = new UserPrincipal("host");
  private final UserPrincipal hoa = new UserPrincipal("inv");

  @BeforeEach
  void setUp() {
    template.dropCollection(MeetingNote.class);
    IndexOperations ops = template.indexOps(MeetingNote.class);
    new MongoPersistentEntityIndexResolver(mappingContext)
        .resolveIndexFor(MeetingNote.class)
        .forEach(ops::ensureIndex);

    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .build();
    guard = mock(MeetingGuard.class);
    when(guard.records(any(), eq("m1"))).thenReturn(m);
    MeetingPeople people = mock(MeetingPeople.class);
    when(people.profiles(anyCollection()))
        .thenReturn(
            Map.of(
                "host", new PersonDto("host", "Lan", null),
                "inv", new PersonDto("inv", "Hoa", null)));
    events = mock(MeetingEvents.class);
    notes = new MeetingNotesService(template, guard, people, events);
  }

  private static MeetingNoteRequest req(String content, Long version) {
    return new MeetingNoteRequest(content, version);
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  private static MeetingNoteConflictException conflict(Runnable r) {
    ApiException e = apiError(r);
    assertThat(e).isInstanceOf(MeetingNoteConflictException.class);
    assertThat(e.status()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(e.code()).isEqualTo("MEETING_NOTE_CONFLICT");
    return (MeetingNoteConflictException) e;
  }

  @Test
  void beforeAnyoneWritesTheNoteIsEmptyAtVersionZero() {
    assertThat(notes.get(host, "m1", Scope.SHARED))
        .isEqualTo(new MeetingNoteDto("shared", "", 0, null, null));
    assertThat(notes.get(host, "m1", Scope.PRIVATE).scope()).isEqualTo("private");
  }

  @Test
  void theFirstSaveCreatesVersionOneAndTellsTheRoom() {
    MeetingNoteDto saved = notes.put(host, "m1", Scope.SHARED, req("# Agenda\n", 0L));

    assertThat(saved.version()).isEqualTo(1);
    assertThat(saved.content()).isEqualTo("# Agenda\n"); // kept verbatim, never trimmed
    assertThat(saved.updatedBy()).isEqualTo(new PersonDto("host", "Lan", null));
    assertThat(saved.updatedAt()).isNotNull();
    verify(events).notesUpdated("m1", 1, new PersonDto("host", "Lan", null));
    assertThat(notes.get(hoa, "m1", Scope.SHARED).content()).isEqualTo("# Agenda\n");
  }

  @Test
  void savingOnTheLatestVersionBumpsIt() {
    notes.put(host, "m1", Scope.SHARED, req("A", 0L));
    MeetingNoteDto second = notes.put(hoa, "m1", Scope.SHARED, req("B", 1L));

    assertThat(second.version()).isEqualTo(2);
    assertThat(second.updatedBy().displayName()).isEqualTo("Hoa");
    assertThat(notes.get(host, "m1", Scope.SHARED).content()).isEqualTo("B");
  }

  @Test
  void aStaleVersionIs409WithTheLatestAndChangesNothing() {
    notes.put(host, "m1", Scope.SHARED, req("A", 0L));
    notes.put(hoa, "m1", Scope.SHARED, req("B", 1L));

    MeetingNoteConflictException e =
        conflict(() -> notes.put(host, "m1", Scope.SHARED, req("C", 1L)));

    assertThat(e.getLatest().content()).isEqualTo("B");
    assertThat(e.getLatest().version()).isEqualTo(2);
    assertThat(e.getLatest().updatedBy().displayName()).isEqualTo("Hoa");
    assertThat(notes.get(host, "m1", Scope.SHARED).content()).isEqualTo("B");
  }

  @Test
  void twoFirstSavesRaceAndTheLoserSeesTheWinnersText() {
    notes.put(host, "m1", Scope.SHARED, req("A", 0L));

    MeetingNoteConflictException e =
        conflict(() -> notes.put(hoa, "m1", Scope.SHARED, req("B", 0L)));

    assertThat(e.getLatest().content()).isEqualTo("A");
    assertThat(e.getLatest().version()).isEqualTo(1);
  }

  @Test
  void concurrentSavesOnTheSameVersionHaveExactlyOneWinner() throws Exception {
    notes.put(host, "m1", Scope.SHARED, req("base", 0L));
    ExecutorService pool = Executors.newFixedThreadPool(8);
    AtomicInteger wins = new AtomicInteger();
    AtomicInteger conflicts = new AtomicInteger();
    List<Future<?>> done = new ArrayList<>();
    for (int i = 0; i < 8; i++) {
      String text = "w" + i;
      Callable<Void> save =
          () -> {
            try {
              notes.put(host, "m1", Scope.SHARED, req(text, 1L));
              wins.incrementAndGet();
            } catch (MeetingNoteConflictException e) {
              conflicts.incrementAndGet();
            }
            return null;
          };
      done.add(pool.submit(save));
    }
    for (Future<?> f : done) {
      f.get();
    }
    pool.shutdown();

    assertThat(wins.get()).isEqualTo(1);
    assertThat(conflicts.get()).isEqualTo(7);
    assertThat(notes.get(host, "m1", Scope.SHARED).version()).isEqualTo(2);
  }

  @Test
  void privateNotesBelongToTheirOwnerAndAreNeverAnnounced() {
    notes.put(host, "m1", Scope.PRIVATE, req("mine", 0L));
    notes.put(hoa, "m1", Scope.PRIVATE, req("theirs", 0L)); // own document, no conflict

    assertThat(notes.get(host, "m1", Scope.PRIVATE).content()).isEqualTo("mine");
    assertThat(notes.get(hoa, "m1", Scope.PRIVATE).content()).isEqualTo("theirs");
    assertThat(notes.get(host, "m1", Scope.SHARED).version()).isZero();
    verify(events, never()).notesUpdated(anyString(), anyLong(), any());
  }

  @Test
  void attendeesCannotEditTheSharedNoteWhenTheHostTurnedItOff() {
    m.getSettings().setAttendeesCanEditNotes(false);

    ApiException e = apiError(() -> notes.put(hoa, "m1", Scope.SHARED, req("x", 0L)));
    assertThat(e.status()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(e.code()).isEqualTo("MEETING_NOTES_READ_ONLY");

    assertThat(notes.put(host, "m1", Scope.SHARED, req("ok", 0L)).version()).isEqualTo(1);
    assertThat(notes.put(hoa, "m1", Scope.PRIVATE, req("own", 0L)).version()).isEqualTo(1);
  }

  @Test
  void contentAndVersionAreValidated() {
    assertThat(apiError(() -> notes.put(host, "m1", Scope.SHARED, req(null, 0L))).getParams())
        .isEqualTo(Map.of("field", "content"));
    assertThat(
            apiError(() -> notes.put(host, "m1", Scope.SHARED, req("x".repeat(50_001), 0L)))
                .getParams())
        .isEqualTo(Map.of("field", "content", "max", 50_000));
    assertThat(apiError(() -> notes.put(host, "m1", Scope.SHARED, req("x", null))).getParams())
        .isEqualTo(Map.of("field", "version"));
    assertThat(apiError(() -> notes.put(host, "m1", Scope.SHARED, req("x", -1L))).getParams())
        .isEqualTo(Map.of("field", "version"));
    assertThat(apiError(() -> notes.put(host, "m1", Scope.SHARED, null)).code())
        .isEqualTo("MEETING_INVALID");

    assertThat(notes.put(host, "m1", Scope.SHARED, req("x".repeat(50_000), 0L)).version())
        .isEqualTo(1);
    assertThat(notes.put(host, "m1", Scope.SHARED, req("", 1L)).content()).isEmpty();
  }

  @Test
  void theNotesOfAnEndedMeetingStayEditable() {
    m.setStatus(MeetingStatus.ENDED);
    assertThat(notes.put(host, "m1", Scope.SHARED, req("minutes", 0L)).version()).isEqualTo(1);
  }

  @Test
  void theGuardDecidesWhoMayReadAndWrite() {
    when(guard.records(any(), eq("m2")))
        .thenThrow(new ApiException(HttpStatus.FORBIDDEN, "MEETING_REMOVED"));

    assertThat(apiError(() -> notes.get(hoa, "m2", Scope.SHARED)).code())
        .isEqualTo("MEETING_REMOVED");
    assertThat(apiError(() -> notes.put(hoa, "m2", Scope.SHARED, req("x", 0L))).code())
        .isEqualTo("MEETING_REMOVED");
    assertThat(template.findAll(MeetingNote.class)).isEmpty();
  }
}
```

`GlobalExceptionHandlerParamsTest` — thêm:

```java
  @Test
  void aNoteConflictCarriesTheLatestNoteNextToTheCode() {
    MeetingNoteDto latest =
        new MeetingNoteDto(
            "shared", "B", 2, new PersonDto("u2", "Hoa", null), Instant.parse("2026-10-08T02:31:02Z"));

    ResponseEntity<Map<String, Object>> r =
        new GlobalExceptionHandler().handleNoteConflict(new MeetingNoteConflictException(latest));

    assertThat(r.getStatusCode().value()).isEqualTo(409);
    assertThat(r.getBody())
        .containsEntry("code", "MEETING_NOTE_CONFLICT")
        .containsEntry("statusCode", 409)
        .containsEntry("latest", latest)
        .doesNotContainKey("message");
  }
```

(import `com.platform.chatservice.dto.meeting.MeetingNoteDto`, `PersonDto`, `java.time.Instant`, `org.springframework.http.ResponseEntity`, `java.util.Map` nếu chưa có.)

- [ ] **Step 2: RED** — `MVN test -Dtest='MeetingNotesServiceTest,GlobalExceptionHandlerParamsTest'`
- [ ] **Step 3: Hiện thực** 3 file như Interfaces.
- [ ] **Step 4: GREEN** — cùng lệnh + `MeetingControllerTest` (handler mới không được làm đổi body các lỗi khác).
- [ ] **Step 5: Commit** `feat(meetings): shared and private notes with optimistic locking`

---

### Task 8: `MeetingRoomPolicy` (quyền publish LiveKit, mute, đá) + "đã vào ⇒ admitted" + PATCH đồng bộ LiveKit

**Files:**
- Create: `M/service/meeting/MeetingRoomPolicy.java`
- Modify: `M/service/meeting/MeetingJoinService.java` — `enter(m, uid)` nhận thêm `caller.getDepts()`; sau khi cấp token: `role == "attendee" && !MeetingAccess.isInvited(m, uid, depts)` ⇒ `lobby.admit(meetingId, uid)` (Sai khác #8). Thay vòng `peopleInside` bằng `MeetingAccess.isInside` nếu gọn hơn (không đổi hành vi `MEETING_FULL`).
- Modify: `M/service/meeting/MeetingService.java` — constructor thêm `MeetingRoomPolicy policy` (cuối danh sách); trong `update`, khi `settingsChanged`: `policy.afterSettingsChange(m, updated)` (một dòng — so sánh + best-effort nằm trong policy để `MeetingService` không vượt 300 dòng).
- Test: `T/service/meeting/MeetingRoomPolicyTest.java` (mới), `T/service/meeting/MeetingJoinServiceTest.java`, `T/service/meeting/MeetingServiceTest.java` (thêm `@Mock MeetingRoomPolicy policy`, truyền vào constructor)

**Interfaces — Produces** (`@Component @RequiredArgsConstructor @Slf4j MeetingRoomPolicy(LiveKitRoomClient rooms)`); hằng `ATTENDEE_SOURCES = List.of(RtcGrant.CAMERA, RtcGrant.MICROPHONE)`, `EVERY_SOURCE = List.of(CAMERA, MICROPHONE, SCREEN_SHARE, SCREEN_SHARE_AUDIO)`; room = `RtcRooms.forMeeting(m.getId())`. "Lỗi LiveKit" = `LiveKitApiException` (trừ status 404 nơi ghi rõ) hoặc `LiveKitUnavailableException`, đổi thành `ApiException(503, MEETINGS_UNAVAILABLE)`:
- `void applyScreenShare(Meeting m)` — `listParticipants(room)`; mỗi người có `roleOf == "attendee"`: `updateParticipant(room, id, allow ? EVERY_SOURCE : ATTENDEE_SOURCES)`; khi `!allow` thêm `mutePublishedTrack(room, id, sid, true)` cho track `SCREEN_SHARE`/`SCREEN_SHARE_AUDIO` **chưa** mute. Host/co-host không đụng. Lỗi LiveKit ⇒ 503.
- `void afterSettingsChange(Meeting before, Meeting after)` — chỉ khi `after.status == LIVE` **và** `allowAttendeeScreenShare` đổi ⇒ `applyScreenShare(after)`; `ApiException` ⇒ log warn, **không** ném (PATCH đã lưu; người vào sau nhận token đúng).
- `void applyPublishPermission(Meeting m, String userId)` — sau đổi vai trò. `allowAttendeeScreenShare == true` ⇒ không làm gì. Ngược lại: `canManage` ⇒ `EVERY_SOURCE`; attendee ⇒ `ATTENDEE_SOURCES` + mute track share đang phát. Không trong phòng (404) ⇒ no-op. Lỗi khác ⇒ 503.
- `boolean admitOnJoin(Meeting m, String identity)` — cho webhook `participant_joined`, **không bao giờ ném**: `identity ∈ removedIds` ⇒ `removeParticipant` (lỗi chỉ log) ⇒ `false`. Attendee khi `!allowAttendeeScreenShare` ⇒ `updateParticipant(ATTENDEE_SOURCES)` (lỗi chỉ log). ⇒ `true`. Share đang bật ⇒ không gọi LiveKit.
- `void kick(String meetingId, String identity)` — `removeParticipant`; 404 (đã rời) ⇒ OK; lỗi khác ⇒ 503.
- `List<String> muteMicrophones(String meetingId, Predicate<String> who)` — `listParticipants`; với mỗi `identity` thoả `who`: mute mọi track `MICROPHONE` chưa mute; trả danh sách identity có ít nhất một track vừa bị mute (thứ tự LiveKit trả). Lỗi ⇒ 503.

- [ ] **Step 1: Test** — `MeetingRoomPolicyTest`

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.service.rtc.LiveKitApiException;
import com.platform.chatservice.service.rtc.LiveKitRoomClient;
import com.platform.chatservice.service.rtc.LiveKitRoomClient.RoomParticipant;
import com.platform.chatservice.service.rtc.LiveKitRoomClient.RoomTrack;
import com.platform.chatservice.service.rtc.LiveKitUnavailableException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingRoomPolicyTest {

  private static final String ROOM = "meet_m1";
  private static final List<String> RESTRICTED = List.of("camera", "microphone");
  private static final List<String> EVERY =
      List.of("camera", "microphone", "screen_share", "screen_share_audio");

  @Mock private LiveKitRoomClient rooms;
  @InjectMocks private MeetingRoomPolicy policy;
  private Meeting m;

  @BeforeEach
  void setUp() {
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .coHostIds(new ArrayList<>(List.of("co")))
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .status(MeetingStatus.LIVE)
            .build();
    when(rooms.listParticipants(ROOM))
        .thenReturn(
            List.of(
                new RoomParticipant(
                    "host", "Lan", List.of(new RoomTrack("TR_hs", "SCREEN_SHARE", false))),
                new RoomParticipant("co", "Minh", List.of()),
                new RoomParticipant(
                    "inv",
                    "Hoa",
                    List.of(
                        new RoomTrack("TR_im", "MICROPHONE", false),
                        new RoomTrack("TR_is", "SCREEN_SHARE", false),
                        new RoomTrack("TR_ia", "SCREEN_SHARE_AUDIO", true))),
                new RoomParticipant(
                    "walkin", null, List.of(new RoomTrack("TR_wm", "MICROPHONE", true)))));
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  @Test
  void sharingOffRestrictsEveryAttendeeStopsTheirLiveShareAndLeavesManagersAlone() {
    m.getSettings().setAllowAttendeeScreenShare(false);

    policy.applyScreenShare(m);

    verify(rooms).updateParticipant(ROOM, "inv", RESTRICTED);
    verify(rooms).updateParticipant(ROOM, "walkin", RESTRICTED);
    verify(rooms, never()).updateParticipant(eq(ROOM), eq("host"), anyList());
    verify(rooms, never()).updateParticipant(eq(ROOM), eq("co"), anyList());
    verify(rooms).mutePublishedTrack(ROOM, "inv", "TR_is", true);
    verify(rooms, never()).mutePublishedTrack(ROOM, "inv", "TR_im", true); // mic untouched
    verify(rooms, never()).mutePublishedTrack(ROOM, "inv", "TR_ia", true); // already muted
    verify(rooms, never()).mutePublishedTrack(ROOM, "host", "TR_hs", true);
  }

  @Test
  void sharingOnGivesEveryAttendeeEverySourceAndMutesNothing() {
    policy.applyScreenShare(m);

    verify(rooms).updateParticipant(ROOM, "inv", EVERY);
    verify(rooms).updateParticipant(ROOM, "walkin", EVERY);
    verify(rooms, never()).mutePublishedTrack(anyString(), anyString(), anyString(), anyBoolean());
  }

  @Test
  void aLiveKitOutageIsMeetingsUnavailable() {
    // doThrow, not when(...): re-stubbing with when() would call the already-throwing stub.
    doThrow(new LiveKitUnavailableException()).when(rooms).listParticipants(ROOM);
    ApiException e = apiError(() -> policy.applyScreenShare(m));
    assertThat(e.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    assertThat(e.code()).isEqualTo("MEETINGS_UNAVAILABLE");

    doThrow(new LiveKitApiException("List", 500, null)).when(rooms).listParticipants(ROOM);
    assertThat(apiError(() -> policy.muteMicrophones("m1", id -> true)).code())
        .isEqualTo("MEETINGS_UNAVAILABLE");
  }

  @Test
  void aPatchThatFlipsSharingInALiveMeetingIsAppliedBestEffort() {
    Meeting before = Meeting.builder().id("m1").status(MeetingStatus.LIVE).build();
    m.getSettings().setAllowAttendeeScreenShare(false);
    doThrow(new LiveKitApiException("UpdateParticipant", 503, null))
        .when(rooms)
        .updateParticipant(anyString(), anyString(), anyList());

    assertThatCode(() -> policy.afterSettingsChange(before, m)).doesNotThrowAnyException();
    verify(rooms).listParticipants(ROOM);
  }

  @Test
  void aPatchThatLeavesSharingAloneOrAMeetingNotLiveCostsNoLiveKitCall() {
    Meeting before = Meeting.builder().id("m1").status(MeetingStatus.LIVE).build();
    policy.afterSettingsChange(before, m); // both allow sharing

    m.setStatus(MeetingStatus.SCHEDULED);
    m.getSettings().setAllowAttendeeScreenShare(false);
    policy.afterSettingsChange(before, m);

    verifyNoInteractions(rooms);
  }

  @Test
  void aRoleChangeFollowsTheNewRoleOnlyWhileSharingIsOff() {
    policy.applyPublishPermission(m, "inv"); // sharing on ⇒ nothing to change
    verifyNoInteractions(rooms);

    m.getSettings().setAllowAttendeeScreenShare(false);
    m.getCoHostIds().add("inv");
    policy.applyPublishPermission(m, "inv");
    verify(rooms).updateParticipant(ROOM, "inv", EVERY);

    m.getCoHostIds().remove("inv");
    policy.applyPublishPermission(m, "inv");
    verify(rooms).updateParticipant(ROOM, "inv", RESTRICTED);
    verify(rooms).mutePublishedTrack(ROOM, "inv", "TR_is", true);
  }

  @Test
  void aRemovedPersonIsKickedOnArrivalEvenIfLiveKitHiccups() {
    m.getRemovedIds().add("inv");
    doThrow(new LiveKitApiException("RemoveParticipant", 503, null))
        .when(rooms)
        .removeParticipant(ROOM, "inv");

    assertThat(policy.admitOnJoin(m, "inv")).isFalse();
    verify(rooms).removeParticipant(ROOM, "inv");
  }

  @Test
  void anAttendeeArrivingWhileSharingIsOffIsRestrictedOnArrival() {
    m.getSettings().setAllowAttendeeScreenShare(false);

    assertThat(policy.admitOnJoin(m, "inv")).isTrue();
    assertThat(policy.admitOnJoin(m, "host")).isTrue();

    verify(rooms).updateParticipant(ROOM, "inv", RESTRICTED);
    verify(rooms, never()).updateParticipant(eq(ROOM), eq("host"), anyList());
  }

  @Test
  void arrivingWhileSharingIsAllowedCostsNoLiveKitCall() {
    assertThat(policy.admitOnJoin(m, "inv")).isTrue();
    verifyNoInteractions(rooms);
  }

  @Test
  void kickingSomeoneAlreadyGoneIsDoneButAnOutageIsReported() {
    doThrow(new LiveKitApiException("RemoveParticipant", 404, null))
        .when(rooms)
        .removeParticipant(ROOM, "gone");
    assertThatCode(() -> policy.kick("m1", "gone")).doesNotThrowAnyException();

    doThrow(new LiveKitApiException("RemoveParticipant", 503, null))
        .when(rooms)
        .removeParticipant(ROOM, "inv");
    assertThat(apiError(() -> policy.kick("m1", "inv")).code()).isEqualTo("MEETINGS_UNAVAILABLE");
  }

  @Test
  void muteMicrophonesMutesOnlyLiveMicsOfTheChosenPeople() {
    List<String> muted = policy.muteMicrophones("m1", id -> !id.equals("host"));

    assertThat(muted).containsExactly("inv"); // walkin's mic was already muted
    verify(rooms).mutePublishedTrack(ROOM, "inv", "TR_im", true);
    verify(rooms, never()).mutePublishedTrack(ROOM, "walkin", "TR_wm", true);
    verify(rooms, never()).mutePublishedTrack(ROOM, "inv", "TR_is", true); // not a microphone
  }
}
```

`MeetingJoinServiceTest` — thêm:

```java
  @Test
  void someoneWhoWalkedInIsRememberedSoLockingLaterDoesNotLockThemOut() {
    m.getSettings().setWaitingRoom(false);

    assertThat(service.join(stranger, "m1").status()).isEqualTo("joined");

    verify(lobby).admit("m1", "stranger");
  }

  @Test
  void inviteesAndManagersNeedNoAdmission() {
    service.join(invitee, "m1");
    service.join(host, "m1");

    verify(lobby, never()).admit(anyString(), anyString());
  }
```

`MeetingServiceTest` — `setUp` truyền `policy` (mock) làm tham số cuối của `new MeetingService(...)`; thêm (dùng helper `stored()` sẵn có):

```java
  @Test
  void aSettingsChangeIsAlsoHandedToTheLiveRoom() {
    Meeting m = stored();
    Meeting after =
        Meeting.builder()
            .id("m1")
            .code("abc-defg-hjk")
            .hostId("host")
            .settings(Meeting.Settings.builder().allowAttendeeScreenShare(false).build())
            .build();
    when(store.update(eq("m1"), any())).thenReturn(Optional.of(after));

    service.update(
        host,
        "m1",
        new UpdateMeetingRequest(
            null, null, null, null, null, null,
            new MeetingSettingsDto(null, null, false, null, null)));

    verify(policy).afterSettingsChange(m, after);
  }
```

- [ ] **Step 2: RED** — `MVN test -Dtest='MeetingRoomPolicyTest,MeetingJoinServiceTest,MeetingServiceTest'`
- [ ] **Step 3: Hiện thực** như Interfaces.
- [ ] **Step 4: GREEN** — cùng lệnh + `MeetingControllerTest`
- [ ] **Step 5: Commit** `feat(meetings): LiveKit publish policy, admitted-on-entry, PATCH applies screen-share`

---

### Task 9: `MeetingHostService` — 13 lệnh host

**Files:**
- Create: `M/service/meeting/MeetingHostService.java` (mục tiêu ≤ 250 dòng; mỗi nhánh `switch` gọi một hàm private ngắn)
- Test: `T/service/meeting/MeetingHostServiceTest.java`

**Interfaces — Produces** (`@Service @RequiredArgsConstructor @Slf4j MeetingHostService(MeetingGuard guard, MeetingStore store, MeetingLobby lobby, MeetingHandService hands, MeetingRoomPolicy policy, MeetingPeople people, MeetingEvents events)` — **không** gọi `LiveKitRoomClient` trực tiếp, mọi việc LiveKit qua `MeetingRoomPolicy`):
- `void execute(UserPrincipal caller, MeetingHostCommand cmd)` — thứ tự:
  1. `MeetingHostAction.parse(cmd.action())` rỗng ⇒ `MeetingRequests.invalid("action")`
  2. `Meeting m = guard.find(cmd.meetingId())` (404)
  3. `ENDED` ⇒ 409 `MEETING_ENDED`
  4. `!MeetingAccess.canManage(m, uid)` ⇒ `log.warn("Ignored meeting host command {} from a non-manager", action)` (không log userId/meetingId ở mức warn — chỉ action) và **return** (Review Focus 4)
  5. `action.needsTarget()` và `targetId` blank ⇒ `invalid("targetId")`
  6. theo bảng "Lệnh host" của Contract:
     - `MUTE_MIC`: `policy.muteMicrophones(id, target::equals)`; `MUTE_ALL`: `policy.muteMicrophones(id, who -> !who.equals(uid))`; mỗi identity trả về ⇒ `events.muted(id, identity, actor)` với `actor = MeetingMapper.person(uid, people.profiles(List.of(uid)))`.
     - `REMOVE`: `target == uid` ⇒ `invalid("targetId")`; `!MeetingAccess.outranks(m, uid, target)` ⇒ 403 `MEETING_FORBIDDEN`; `store.update(id, new Update().addToSet("removedIds", target).pull("coHostIds", target))` (rỗng ⇒ 409 `MEETING_ENDED`) → `lobby.markRemoved` → `hands.lower` → `events.removed` → `policy.kick` (lỗi 503 ném ra **sau** khi trạng thái đã lưu và client đã được báo).
     - `LOWER_HAND`: `hands.lower(id, target)`; `LOWER_ALL_HANDS`: `hands.lowerAll(id)`.
     - `LOCK|UNLOCK|WAITING_ROOM_ON|WAITING_ROOM_OFF|ATTENDEE_SCREEN_SHARE_ON|ATTENDEE_SCREEN_SHARE_OFF`: field (`settings.locked` / `settings.waitingRoom` / `settings.allowAttendeeScreenShare`) và giá trị; giá trị hiện tại đã bằng ⇒ return (không ghi, không phát). Ngược lại `store.update(id, new Update().set(field, value))` (chỉ **một** field — hai lệnh đồng thời không đè nhau) → `events.settings(updated)` → với 2 action share: `policy.applyScreenShare(updated)`.
     - `MAKE_COHOST`: người gọi không phải host ⇒ 403 `MEETING_FORBIDDEN`; target là host hoặc `!MeetingAccess.isInside(m, target)` ⇒ `invalid("targetId")`; đã là co-host ⇒ return. `store.update(addToSet coHostIds)` → `events.roster(updated)` → `events.lobbyTo(target, id, lobby.waiting(id))` → `policy.applyPublishPermission(updated, target)`.
     - `REVOKE_COHOST`: người gọi không phải host ⇒ 403; target không phải co-host ⇒ return. `store.update(pull coHostIds)` → `lobby.admit(id, target)` → `events.roster(updated)` → `policy.applyPublishPermission(updated, target)`.

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import com.platform.chatservice.dto.meeting.MeetingHostCommand;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingHostServiceTest {

  @Mock private MeetingGuard guard;
  @Mock private MeetingStore store;
  @Mock private MeetingLobby lobby;
  @Mock private MeetingHandService hands;
  @Mock private MeetingRoomPolicy policy;
  @Mock private MeetingPeople people;
  @Mock private MeetingEvents events;
  @InjectMocks private MeetingHostService host;

  private Meeting m;
  private Meeting after;
  private final UserPrincipal lan = new UserPrincipal("host");
  private final UserPrincipal minh = new UserPrincipal("co");
  private final UserPrincipal hoa = new UserPrincipal("inv");

  @BeforeEach
  void setUp() {
    Instant t = Instant.now();
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .coHostIds(new ArrayList<>(List.of("co")))
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .status(MeetingStatus.LIVE)
            .attendance(
                new ArrayList<>(
                    List.of(
                        Meeting.Attendance.builder().userId("inv").joinedAt(t).build(),
                        Meeting.Attendance.builder().userId("walkin").joinedAt(t).build())))
            .build();
    after = Meeting.builder().id("m1").hostId("host").status(MeetingStatus.LIVE).build();
    when(guard.find("m1")).thenReturn(m);
    when(store.update(eq("m1"), any())).thenReturn(Optional.of(after));
    when(people.profiles(anyCollection()))
        .thenReturn(
            Map.of(
                "host", new PersonDto("host", "Lan", null),
                "co", new PersonDto("co", "Minh", null)));
  }

  private static MeetingHostCommand cmd(String action, String target) {
    return new MeetingHostCommand("m1", action, target);
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  private Update lastUpdate() {
    ArgumentCaptor<Update> captor = ArgumentCaptor.forClass(Update.class);
    verify(store).update(eq("m1"), captor.capture());
    return captor.getValue();
  }

  @SuppressWarnings("unchecked")
  private Predicate<String> mutePredicate() {
    ArgumentCaptor<Predicate<String>> captor = ArgumentCaptor.forClass(Predicate.class);
    verify(policy).muteMicrophones(eq("m1"), captor.capture());
    return captor.getValue();
  }

  @Test
  void anAttendeesHostCommandsAreIgnoredWithoutAWord() {
    for (MeetingHostAction a : MeetingHostAction.values()) {
      host.execute(hoa, cmd(a.name(), "walkin"));
    }
    verifyNoInteractions(store, lobby, hands, policy, events);
  }

  @Test
  void anUnknownActionOrAMissingTargetNamesTheField() {
    assertThat(apiError(() -> host.execute(lan, cmd("NUKE", null))).getParams())
        .isEqualTo(Map.of("field", "action"));
    assertThat(apiError(() -> host.execute(lan, cmd(null, null))).getParams())
        .isEqualTo(Map.of("field", "action"));
    assertThat(apiError(() -> host.execute(lan, cmd("REMOVE", " "))).getParams())
        .isEqualTo(Map.of("field", "targetId"));
  }

  @Test
  void anEndedMeetingTakesNoCommands() {
    m.setStatus(MeetingStatus.ENDED);
    ApiException e = apiError(() -> host.execute(lan, cmd("LOCK", null)));
    assertThat(e.status()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(e.code()).isEqualTo("MEETING_ENDED");
  }

  @Test
  void muteMicTargetsOnePersonAndTellsThemWhoDidIt() {
    when(policy.muteMicrophones(eq("m1"), any())).thenReturn(List.of("inv"));

    host.execute(minh, cmd("MUTE_MIC", "inv"));

    Predicate<String> who = mutePredicate();
    assertThat(who.test("inv")).isTrue();
    assertThat(who.test("walkin")).isFalse();
    verify(events).muted("m1", "inv", new PersonDto("co", "Minh", null));
  }

  @Test
  void muteAllSparesTheCallerAndANoOpMuteSaysNothing() {
    when(policy.muteMicrophones(eq("m1"), any())).thenReturn(List.of());

    host.execute(lan, cmd("MUTE_ALL", null));

    Predicate<String> who = mutePredicate();
    assertThat(who.test("host")).isFalse();
    assertThat(who.test("co")).isTrue();
    assertThat(who.test("inv")).isTrue();
    verify(events, never()).muted(anyString(), anyString(), any());
  }

  @Test
  void removeShutsEveryDoorInOrder() {
    host.execute(lan, cmd("REMOVE", "inv"));

    Document doc = lastUpdate().getUpdateObject();
    assertThat((Document) doc.get("$addToSet")).containsEntry("removedIds", "inv");
    assertThat((Document) doc.get("$pull")).containsEntry("coHostIds", "inv");
    InOrder order = inOrder(store, lobby, hands, events, policy);
    order.verify(store).update(eq("m1"), any());
    order.verify(lobby).markRemoved("m1", "inv");
    order.verify(hands).lower("m1", "inv");
    order.verify(events).removed("m1", "inv");
    order.verify(policy).kick("m1", "inv");
  }

  @Test
  void nobodyRemovesTheHostOrThemselvesAndCoHostsCannotRemoveCoHosts() {
    m.getCoHostIds().add("co2");

    assertThat(apiError(() -> host.execute(minh, cmd("REMOVE", "host"))).code())
        .isEqualTo("MEETING_FORBIDDEN");
    assertThat(apiError(() -> host.execute(minh, cmd("REMOVE", "co2"))).code())
        .isEqualTo("MEETING_FORBIDDEN");
    assertThat(apiError(() -> host.execute(lan, cmd("REMOVE", "host"))).getParams())
        .isEqualTo(Map.of("field", "targetId"));
    verify(store, never()).update(anyString(), any());
  }

  @Test
  void aRemovalStandsEvenWhenLiveKitIsDown() {
    doThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MEETINGS_UNAVAILABLE"))
        .when(policy)
        .kick("m1", "inv");

    assertThat(apiError(() -> host.execute(lan, cmd("REMOVE", "inv"))).code())
        .isEqualTo("MEETINGS_UNAVAILABLE");
    verify(lobby).markRemoved("m1", "inv");
    verify(events).removed("m1", "inv");
  }

  @Test
  void handsAreLoweredOneOrAll() {
    host.execute(minh, cmd("LOWER_HAND", "inv"));
    host.execute(minh, cmd("LOWER_ALL_HANDS", null));

    verify(hands).lower("m1", "inv");
    verify(hands).lowerAll("m1");
  }

  @Test
  void aSettingsCommandSetsOneFieldAndAnnouncesOnlyARealChange() {
    host.execute(lan, cmd("LOCK", null));

    Document set = (Document) lastUpdate().getUpdateObject().get("$set");
    assertThat(set).containsExactlyEntriesOf(Map.of("settings.locked", true));
    verify(events).settings(after);

    m.getSettings().setLocked(true);
    host.execute(lan, cmd("LOCK", null)); // already locked
    verify(store, times(1)).update(anyString(), any());
    verify(events, times(1)).settings(any());
    verify(policy, never()).applyScreenShare(any());
  }

  @Test
  void waitingRoomOffWritesTheWaitingRoomField() {
    host.execute(minh, cmd("WAITING_ROOM_OFF", null));

    Document set = (Document) lastUpdate().getUpdateObject().get("$set");
    assertThat(set).containsExactlyEntriesOf(Map.of("settings.waitingRoom", false));
  }

  @Test
  void theScreenShareSwitchIsAppliedToTheRoom() {
    host.execute(minh, cmd("ATTENDEE_SCREEN_SHARE_OFF", null));

    Document set = (Document) lastUpdate().getUpdateObject().get("$set");
    assertThat(set).containsExactlyEntriesOf(Map.of("settings.allowAttendeeScreenShare", false));
    verify(events).settings(after);
    verify(policy).applyScreenShare(after);
  }

  @Test
  void onlyTheHostAppointsCoHostsAndOnlyFromPeopleInTheRoom() {
    assertThat(apiError(() -> host.execute(minh, cmd("MAKE_COHOST", "inv"))).code())
        .isEqualTo("MEETING_FORBIDDEN");
    assertThat(apiError(() -> host.execute(lan, cmd("MAKE_COHOST", "outside"))).getParams())
        .isEqualTo(Map.of("field", "targetId"));
    assertThat(apiError(() -> host.execute(lan, cmd("MAKE_COHOST", "host"))).getParams())
        .isEqualTo(Map.of("field", "targetId"));
    verify(store, never()).update(anyString(), any());

    List<LobbyEntryDto> waiting = List.of(new LobbyEntryDto("w1", "Wen"));
    when(lobby.waiting("m1")).thenReturn(waiting);
    host.execute(lan, cmd("MAKE_COHOST", "inv"));

    assertThat((Document) lastUpdate().getUpdateObject().get("$addToSet"))
        .containsEntry("coHostIds", "inv");
    verify(events).roster(after);
    verify(events).lobbyTo("inv", "m1", waiting);
    verify(policy).applyPublishPermission(after, "inv");
  }

  @Test
  void appointingACoHostTwiceOrRevokingSomeoneWhoIsNotOneDoesNothing() {
    host.execute(lan, cmd("MAKE_COHOST", "co"));
    host.execute(lan, cmd("REVOKE_COHOST", "inv"));

    verify(store, never()).update(anyString(), any());
    verifyNoInteractions(events);
  }

  @Test
  void aRevokedCoHostStaysAdmittedSoTheyAreNotLockedOut() {
    host.execute(lan, cmd("REVOKE_COHOST", "co"));

    assertThat((Document) lastUpdate().getUpdateObject().get("$pull"))
        .containsEntry("coHostIds", "co");
    verify(lobby).admit("m1", "co");
    verify(events).roster(after);
    verify(policy).applyPublishPermission(after, "co");
    assertThat(apiError(() -> host.execute(minh, cmd("REVOKE_COHOST", "co"))).code())
        .isEqualTo("MEETING_FORBIDDEN");
  }
}
```

- [ ] **Step 2: RED** — `MVN test -Dtest=MeetingHostServiceTest`
- [ ] **Step 3: Hiện thực** như Interfaces.
- [ ] **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingHostServiceTest,MeetingRoomPolicyTest,MeetingHandServiceTest'`
- [ ] **Step 5: Commit** `feat(meetings): host and co-host commands`

---

### Task 10: `MeetingRtcHandler` — đá người bị mời ra khi nối lại, hạ tay khi rời phòng

**Files:**
- Modify: `M/service/meeting/MeetingRtcHandler.java` — constructor thêm `MeetingRoomPolicy policy`, `MeetingHandService hands`.
  - `onParticipantJoined`: ngay sau khi có `m` và `userId` hợp lệ, **trước** `markLive`: `if (!policy.admitOnJoin(m, userId)) return;` — người bị mời ra cầm token cũ (≤ 600s) không làm cuộc họp LIVE, không có dòng điểm danh, không bị đánh dấu bận.
  - `onParticipantLeft`: sau `recordLeave == true` và `busy.clear`: `hands.lower(meetingId, userId)` (Review Focus 3), rồi `events.roster` như cũ.
- Test: `T/service/meeting/MeetingRtcHandlerTest.java` — thêm `@Mock private MeetingRoomPolicy policy; @Mock private MeetingHandService hands;` (để `@InjectMocks` nhận), trong `setUp`: `when(policy.admitOnJoin(any(), anyString())).thenReturn(true);`

Không phụ thuộc vòng: `MeetingRtcHandler → MeetingRoomPolicy → LiveKitRoomClient` và `→ MeetingHandService → {Redis, MeetingGuard, MeetingPeople, MeetingEvents}`; không lớp nào trong đó quay lại handler hay `RtcWebhookDispatcher`.

- [ ] **Step 1: Test** — thêm:

```java
  @Test
  void aRemovedPersonRejoiningWithAnOldTokenIsTurnedAwayAndLeavesNoTrace() {
    when(policy.admitOnJoin(m, "kicked")).thenReturn(false);

    handler.onParticipantJoined(ev("kicked", "PA_9", at));

    verify(store, never()).markLive(anyString(), any()); // m is SCHEDULED: it must stay so
    verify(store, never()).recordJoin(anyString(), any());
    verifyNoInteractions(busy, events);
  }

  @Test
  void leavingTheRoomLowersTheirHand() {
    m.setStatus(MeetingStatus.LIVE);
    when(store.recordLeave(eq("m1"), eq("inv"), eq("PA_1"), any())).thenReturn(true);

    handler.onParticipantLeft(ev("inv", "PA_1", at));

    verify(hands).lower("m1", "inv");
  }

  @Test
  void aStaleLeaveLeavesTheHandUp() {
    m.setStatus(MeetingStatus.LIVE);
    when(store.recordLeave(eq("m1"), eq("inv"), eq("PA_OLD"), any())).thenReturn(false);

    handler.onParticipantLeft(ev("inv", "PA_OLD", at));

    verify(hands, never()).lower(anyString(), anyString());
  }
```

và trong `eventsForEndedOrUnknownMeetingsAreIgnored` thêm `verifyNoInteractions(policy, hands);`.

- [ ] **Step 2: RED** · **Step 3: Hiện thực** · **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingRtcHandlerTest,RtcWebhookDispatcherTest'`
- [ ] **Step 5: Commit** `feat(meetings): kick removed people on rejoin, lower hands on leave`

---

### Task 11: Bộ lọc outbound `/topic/meeting/*` cho người bị mời ra

**Files:**
- Modify: `M/security/StompDestinationPolicy.java` — `public static String meetingIdOfTopic(String destination)`: id khi destination khớp **chính xác** `/topic/meeting/{id}` (cùng regex `MEETING_ID` của allow-list), ngược lại `null`. Không đổi `SUBSCRIBE_ALLOW_LIST` (vẫn 7 rule).
- Create: `M/security/MeetingTopicOutboundInterceptor.java` — `@Component @RequiredArgsConstructor @Slf4j implements ChannelInterceptor`, phụ thuộc `WsSessionRegistry`, `MeetingLobby` (chỉ Redis — không tạo vòng bean với `WebSocketConfig`). `preSend`: không phải `MESSAGE` ⇒ giữ; `meetingIdOfTopic == null` ⇒ giữ; `wsSessionRegistry.bindingOf(sessionId) == null` ⇒ **bỏ** (như bộ lọc hội thoại); `lobby.isRemoved(meetingId, userId)` ⇒ **bỏ** (`return null`, log debug); Redis lỗi (`RuntimeException`) ⇒ log warn và **giao** (fail-open: một lần Redis chập chờn không được làm câm cả phòng; người bị mời ra đã bị LiveKit đá và đã nhận `meet.removed`).
- Modify: `M/config/WebSocketConfig.java` — field `MeetingTopicOutboundInterceptor meetingTopicOutboundInterceptor`; `configureClientOutboundChannel`: `registration.interceptors(conversationTopicOutboundInterceptor, meetingTopicOutboundInterceptor)`; sửa javadoc.
- Test: `T/security/StompDestinationPolicyTest.java` (thêm), `T/security/MeetingTopicOutboundInterceptorTest.java` (mới, cùng khuôn `ConversationTopicOutboundInterceptorTest`)

Chi phí: một `SISMEMBER` Redis cho mỗi frame của topic họp × mỗi phiên subscribe (≤ 25 người) — topic hội thoại không bị ảnh hưởng.

- [ ] **Step 1: Test** — `StompDestinationPolicyTest`:

```java
  @Test
  void meetingIdOfTopic_onlyForTheExactMeetingTopic() {
    assertThat(StompDestinationPolicy.meetingIdOfTopic("/topic/meeting/670f1c2ab9e4d21f0c3a9e11"))
        .isEqualTo("670f1c2ab9e4d21f0c3a9e11");
    assertThat(StompDestinationPolicy.meetingIdOfTopic("/topic/meeting/m1/typing")).isNull();
    assertThat(StompDestinationPolicy.meetingIdOfTopic("/topic/meeting/")).isNull();
    assertThat(StompDestinationPolicy.meetingIdOfTopic("/topic/conversation/m1")).isNull();
    assertThat(StompDestinationPolicy.meetingIdOfTopic("/user/queue/meeting")).isNull();
    assertThat(StompDestinationPolicy.meetingIdOfTopic(null)).isNull();
  }
```

`MeetingTopicOutboundInterceptorTest`

```java
package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.service.meeting.MeetingLobby;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.support.MessageBuilder;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class MeetingTopicOutboundInterceptorTest {

  private static final String TOPIC = "/topic/meeting/m1";

  @Mock private WsSessionRegistry wsSessionRegistry;
  @Mock private MeetingLobby lobby;
  @Mock private MessageChannel channel;
  @InjectMocks private MeetingTopicOutboundInterceptor interceptor;

  private static Message<byte[]> outbound(
      SimpMessageType type, String destination, String session) {
    SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create(type);
    accessor.setDestination(destination);
    accessor.setSessionId(session);
    accessor.setLeaveMutable(true);
    return MessageBuilder.createMessage("{}".getBytes(), accessor.getMessageHeaders());
  }

  private void session(String userId) {
    when(wsSessionRegistry.bindingOf("ws-1"))
        .thenReturn(new WsSessionRegistry.Binding(userId, "sid-1"));
  }

  @Test
  void aFrameToSomeoneStillInTheMeetingIsDelivered() {
    session("inv");
    when(lobby.isRemoved("m1", "inv")).thenReturn(false);
    Message<byte[]> frame = outbound(SimpMessageType.MESSAGE, TOPIC, "ws-1");

    assertThat(interceptor.preSend(frame, channel)).isSameAs(frame);
  }

  /** Removed mid-meeting: the subscription stays open but carries nothing any more. */
  @Test
  void aFrameToSomeoneWhoWasRemovedIsDropped() {
    session("kicked");
    when(lobby.isRemoved("m1", "kicked")).thenReturn(true);

    assertThat(interceptor.preSend(outbound(SimpMessageType.MESSAGE, TOPIC, "ws-1"), channel))
        .isNull();
  }

  @Test
  void aFrameForAnUnknownSessionIsDropped() {
    assertThat(interceptor.preSend(outbound(SimpMessageType.MESSAGE, TOPIC, "ws-?"), channel))
        .isNull();
  }

  @Test
  void otherDestinationsAndControlFramesSkipTheLookup() {
    Message<byte[]> conversation =
        outbound(SimpMessageType.MESSAGE, "/topic/conversation/c1", "ws-1");
    Message<byte[]> queue = outbound(SimpMessageType.MESSAGE, "/user/queue/meeting", "ws-1");
    Message<byte[]> heartbeat = outbound(SimpMessageType.HEARTBEAT, TOPIC, "ws-1");

    assertThat(interceptor.preSend(conversation, channel)).isSameAs(conversation);
    assertThat(interceptor.preSend(queue, channel)).isSameAs(queue);
    assertThat(interceptor.preSend(heartbeat, channel)).isSameAs(heartbeat);
    verifyNoInteractions(lobby, wsSessionRegistry);
  }

  @Test
  void aRedisBlipDeliversRatherThanSilencingTheWholeRoom() {
    session("inv");
    when(lobby.isRemoved("m1", "inv")).thenThrow(new RedisConnectionFailureException("down"));
    Message<byte[]> frame = outbound(SimpMessageType.MESSAGE, TOPIC, "ws-1");

    assertThat(interceptor.preSend(frame, channel)).isSameAs(frame);
  }
}
```

- [ ] **Step 2: RED** — `MVN test -Dtest='StompDestinationPolicyTest,MeetingTopicOutboundInterceptorTest'`
- [ ] **Step 3: Hiện thực** 3 file.
- [ ] **Step 4: GREEN** — cùng lệnh + `ConversationTopicOutboundInterceptorTest,AuthChannelInterceptorTest`
- [ ] **Step 5: Commit** `feat(meetings): silence the meeting topic for removed people`

---

### Task 12: `MeetingWsController` (STOMP) + REST `/messages`, `/notes/*`, `/hands`

**Files:**
- Create: `M/controller/MeetingWsController.java` — `@Controller @RequiredArgsConstructor`, phụ thuộc `MeetingHandService`, `MeetingChatService`, `MeetingHostService`, `MeetingEvents`:

  | Mapping | Gọi |
  |---|---|
  | `@MessageMapping("/meet.hand")` `(@Payload MeetingHandCommand cmd, Principal p)` | `hands.setHand(caller(p), cmd.meetingId(), Boolean.TRUE.equals(cmd.raised()))` |
  | `@MessageMapping("/meet.chat")` `(@Payload MeetingChatCommand cmd, Principal p)` | `chat.send(caller(p), cmd.meetingId(), cmd.content(), cmd.clientId())` |
  | `@MessageMapping("/meet.host")` `(@Payload MeetingHostCommand cmd, Principal p)` | `host.execute(caller(p), cmd)` |

  Mỗi method bọc bằng `private void reply(Principal p, String meetingId, String action, String clientId, Runnable r)`: `ApiException e` ⇒ `events.error(p.getName(), meetingId, action, clientId, e.code(), e.getParams())`; `RateLimitExceededException` ⇒ `events.error(..., ErrorCodes.RATE_LIMITED, null)`. Exception khác **không** nuốt (Spring log). `action` = `cmd.action()` chỉ cho `/meet.host`; `clientId` = `MeetingChatService.clientIdOrNull(cmd.clientId())` chỉ cho `/meet.chat` (hàm `public static` mới — cùng regex của Task 6, để không dội chuỗi rác về client). `caller(p)` như `MeetingController` (`UserPrincipal` hoặc `new UserPrincipal(p.getName())`).
- Modify: `M/controller/MeetingController.java` — constructor `(MeetingService meetings, MeetingJoinService joins, MeetingChatService chat, MeetingNotesService notes, MeetingHandService hands)`; thêm:

  | Mapping | Gọi | Trả |
  |---|---|---|
  | `@GetMapping("/{id}/messages")` `before` (optional), `size` (default 50) | `chat.history(caller, id, before, size)` | `PageResponse<MeetingMessageDto>` |
  | `@GetMapping("/{id}/notes/shared")` · `("/{id}/notes/private")` | `notes.get(caller, id, Scope.SHARED / PRIVATE)` | `MeetingNoteDto` |
  | `@PutMapping("/{id}/notes/shared")` · `("/{id}/notes/private")` `@RequestBody(required = false) MeetingNoteRequest` | `notes.put(caller, id, scope, body)` (body `null` ⇒ service trả `invalid("content")`) | `MeetingNoteDto` |
  | `@GetMapping("/{id}/hands")` | `hands.snapshot(caller, id)` | `MeetingHandsResponse` |

  File phải ≤ 200 dòng (hiện 115).
- Test: `T/controller/MeetingWsControllerTest.java` (mới), `T/controller/MeetingControllerTest.java` (sửa constructor ở `setUp` và `meetingRoutesDoNotCollideWithCallRoutes`, thêm `@Mock MeetingChatService chat; @Mock MeetingNotesService notes; @Mock MeetingHandService hands;`)

- [ ] **Step 1: Test** — `MeetingWsControllerTest`

```java
package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.MeetingChatCommand;
import com.platform.chatservice.dto.meeting.MeetingHandCommand;
import com.platform.chatservice.dto.meeting.MeetingHostCommand;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.RateLimitExceededException;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.meeting.MeetingChatService;
import com.platform.chatservice.service.meeting.MeetingEvents;
import com.platform.chatservice.service.meeting.MeetingHandService;
import com.platform.chatservice.service.meeting.MeetingHostService;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingWsControllerTest {

  @Mock private MeetingHandService hands;
  @Mock private MeetingChatService chat;
  @Mock private MeetingHostService host;
  @Mock private MeetingEvents events;
  private MeetingWsController controller;
  private final UserPrincipal an = new UserPrincipal("a", "Member", List.of(), List.of("dept-a"));

  @BeforeEach
  void setUp() {
    controller = new MeetingWsController(hands, chat, host, events);
  }

  @Test
  void raisingPassesTheCallersClaimsAndAMissingFlagMeansLower() {
    controller.hand(new MeetingHandCommand("m1", true), an);
    controller.hand(new MeetingHandCommand("m1", null), an);

    verify(hands).setHand(an, "m1", true);
    verify(hands).setHand(an, "m1", false);
  }

  @Test
  void aRefusedChatIsReportedToTheSenderAloneWithItsClientId() {
    doThrow(
            new ApiException(
                HttpStatus.BAD_REQUEST,
                "MEETING_INVALID",
                null,
                Map.of("field", "content", "max", 2000)))
        .when(chat)
        .send(any(), eq("m1"), anyString(), eq("c-1"));

    controller.chat(new MeetingChatCommand("m1", "x", "c-1"), an);

    verify(events)
        .error("a", "m1", null, "c-1", "MEETING_INVALID", Map.of("field", "content", "max", 2000));
  }

  @Test
  void aJunkClientIdIsNeverEchoedBack() {
    doThrow(new ApiException(HttpStatus.FORBIDDEN, "MEETING_FORBIDDEN"))
        .when(chat)
        .send(any(), any(), any(), any());

    controller.chat(new MeetingChatCommand("m1", "x", "<script>"), an);

    verify(events).error(eq("a"), eq("m1"), isNull(), isNull(), eq("MEETING_FORBIDDEN"), isNull());
  }

  @Test
  void aRateLimitedChatIsReportedAsRateLimited() {
    doThrow(new RateLimitExceededException()).when(chat).send(any(), any(), any(), any());

    controller.chat(new MeetingChatCommand("m1", "x", null), an);

    verify(events).error("a", "m1", null, null, "RATE_LIMITED", null);
  }

  @Test
  void aFailedHostCommandEchoesItsAction() {
    doThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MEETINGS_UNAVAILABLE"))
        .when(host)
        .execute(any(), any());

    controller.host(new MeetingHostCommand("m1", "MUTE_ALL", null), an);

    verify(events).error("a", "m1", "MUTE_ALL", null, "MEETINGS_UNAVAILABLE", null);
  }

  @Test
  void aLegacyPrincipalStillActsAsItsUser() {
    Principal legacy = mock(Principal.class);
    when(legacy.getName()).thenReturn("a");

    controller.host(new MeetingHostCommand("m1", "LOCK", null), legacy);

    verify(host).execute(argThat(u -> "a".equals(u.getUserId())), any());
  }

  @Test
  void unexpectedFailuresAreNotDisguisedAsAnApiError() {
    doThrow(new IllegalStateException("bug")).when(hands).setHand(any(), any(), eq(true));

    assertThatThrownBy(() -> controller.hand(new MeetingHandCommand("m1", true), an))
        .isInstanceOf(IllegalStateException.class);
    verify(events, never()).error(any(), any(), any(), any(), any(), any());
  }
}
```

`MeetingControllerTest` — thêm (import `MeetingChatService`, `MeetingNotesService`, `MeetingHandService`, `MeetingNotesService.Scope`, `MeetingNoteDto`, `MeetingNoteRequest`, `MeetingHandsResponse`, `HandDto`, `PersonDto`, `MeetingNoteConflictException`, `java.time.Instant`, `static ...MockMvcRequestBuilders.put`, `static org.mockito.ArgumentMatchers.isNull`):

```java
  @Test
  void messagesPassTheCursorAndDefaultToFiftyPerPage() throws Exception {
    when(chat.history(any(), eq("m1"), eq("x9"), eq(10)))
        .thenReturn(new com.platform.chatservice.dto.PageResponse<>(List.of(), 0, 10, 0));
    mvc.perform(get("/api/meetings/m1/messages?before=x9&size=10").principal(lan))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.hasNext").value(false));

    mvc.perform(get("/api/meetings/m1/messages").principal(lan));
    verify(chat).history(any(), eq("m1"), isNull(), eq(50));
  }

  @Test
  void aNonNumericPageSizeIsMeetingInvalidNotA500() throws Exception {
    mvc.perform(get("/api/meetings/m1/messages?size=abc").principal(lan))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MEETING_INVALID"))
        .andExpect(jsonPath("$.params.field").value("size"));
  }

  @Test
  void theNoteScopeComesFromThePath() throws Exception {
    when(notes.get(any(), eq("m1"), eq(Scope.SHARED)))
        .thenReturn(new MeetingNoteDto("shared", "", 0, null, null));
    mvc.perform(get("/api/meetings/m1/notes/shared").principal(lan))
        .andExpect(jsonPath("$.scope").value("shared"))
        .andExpect(jsonPath("$.version").value(0))
        .andExpect(jsonPath("$.updatedBy").doesNotExist());

    mvc.perform(
            put("/api/meetings/m1/notes/private")
                .principal(lan)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"x\",\"version\":3}"))
        .andExpect(status().isOk());
    verify(notes).put(any(), eq("m1"), eq(Scope.PRIVATE), eq(new MeetingNoteRequest("x", 3L)));
  }

  @Test
  void aNoteConflictAnswers409WithTheLatestNote() throws Exception {
    MeetingNoteDto latest =
        new MeetingNoteDto(
            "shared", "B", 8, new PersonDto("u2", "Hoa", null), Instant.parse("2026-10-08T02:31:02Z"));
    when(notes.put(any(), eq("m1"), eq(Scope.SHARED), any()))
        .thenThrow(new MeetingNoteConflictException(latest));

    mvc.perform(
            put("/api/meetings/m1/notes/shared")
                .principal(lan)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"C\",\"version\":7}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("MEETING_NOTE_CONFLICT"))
        .andExpect(jsonPath("$.statusCode").value(409))
        .andExpect(jsonPath("$.latest.content").value("B"))
        .andExpect(jsonPath("$.latest.version").value(8))
        .andExpect(jsonPath("$.latest.updatedBy.displayName").value("Hoa"))
        .andExpect(jsonPath("$.message").doesNotExist());
  }

  @Test
  void theHandsSnapshotIsServed() throws Exception {
    when(hands.snapshot(any(), eq("m1")))
        .thenReturn(
            new MeetingHandsResponse(
                List.of(new HandDto("u3", "Hoa", Instant.parse("2026-10-08T02:06:00Z")))));
    mvc.perform(get("/api/meetings/m1/hands").principal(lan))
        .andExpect(jsonPath("$.hands[0].userId").value("u3"))
        .andExpect(jsonPath("$.hands[0].displayName").value("Hoa"));
  }
```

(`MockMvc` standalone không có `JavaTimeModule` mặc định? — `MeetingControllerTest` của MT2 đã serialize `Instant` trong `MeetingResponse`; nếu `$.latest.updatedAt` làm vỡ test thì cấu hình `setMessageConverters(new MappingJackson2HttpMessageConverter(Jackson2ObjectMapperBuilder.json().build()))` — không đổi code prod.)

- [ ] **Step 2: RED** — `MVN test -Dtest='MeetingWsControllerTest,MeetingControllerTest'`
- [ ] **Step 3: Hiện thực** 2 controller (+ `MeetingChatService.clientIdOrNull`).
- [ ] **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingWsControllerTest,MeetingControllerTest,AssistantMappingUniquenessTest,CallRestControllerTest,ChatControllerTest'`
- [ ] **Step 5: Commit** `feat(meetings): STOMP commands and REST for chat history, notes and hands`

---

### Task 13: Kiểm tra toàn bộ + tài liệu

- [ ] `MVN spotless:apply && MVN spotless:check test` — toàn chat-service xanh (Docker chạy cho Testcontainers). Ghi số test vào commit message.
- [ ] `wc -l` mọi file mới/sửa trong `M/service/meeting/`, `M/controller/Meeting*.java`, `M/security/MeetingTopicOutboundInterceptor.java`, `M/exception/GlobalExceptionHandler.java` — ≤ 500 (mục tiêu ≤ 300; `MeetingController` ≤ 200).
- [ ] Không có `meetingRepository.save(` mới: `grep -rn "meetingRepository.save\|repository.save(" apps/server/chat-service/src/main/java/com/platform/chatservice/service/meeting` ⇒ rỗng.
- [ ] Không có tên room / text exception trong payload: `grep -rn "getMessage()" apps/server/chat-service/src/main/java/com/platform/chatservice/{service/meeting,controller/MeetingWsController.java}` — chỉ được xuất hiện trong `log.*`.
- [ ] `docs/api-spec.md` § Meetings: thêm bảng REST MT3 (`/messages`, `/notes/shared|private`, `/hands`), object `MeetingMessage`, `MeetingNote`, `MeetingNoteRequest` + ví dụ 409 `latest`, `Hand`; mục STOMP thêm C→S `/app/meet.hand|chat|host`, bảng 13 `action`, sự kiện `meet.hands`, `meet.chat`, `meet.notes.updated`, `meet.removed`, `meet.muted`, `meet.error`; ghi chú `meet.roster.role` = vai trò hiện tại; mã lỗi `MEETING_NOTE_CONFLICT`, `MEETING_NOTES_READ_ONLY`, `RATE_LIMITED`; câu "frame của `/topic/meeting/{id}` không tới người bị mời ra". Mục "🔌 WebSocket → Client Publishes" thêm 3 destination `/app/meet.*`. (Chép từ mục Contract của plan này.)
- [ ] `apps/server/chat-service/CLAUDE.md`: collection `meeting_notes` (unique `{meetingId, scope, ownerId}`, khoá lạc quan `version`) và `meeting_messages`; Redis `meet:hands:{id}` (zset), `meet:removed:{id}` (set); `MeetingTopicOutboundInterceptor` cạnh bộ lọc hội thoại.
- [ ] `docs/superpowers/plans/README.md`: dòng `2026-10-05-meetings-p1-core.md` ghi "MT1–MT3 xong trên `feat/meetings-p1`"; thêm dòng cho `2026-10-07-meetings-mt3.md`.
- [ ] Commit `docs: meetings in-room contract (MT3)`.

---

## Quyết định cho owner (đề xuất mặc định — không chặn việc code)

Plan chọn sẵn theo Meet/Teams; đổi được bằng một nhánh `if` trong `MeetingAccess`/`MeetingHostService`, không đổi contract dạng dữ liệu:

1. **Chỉ host** phong/thu hồi co-host; co-host không mời ra co-host khác (Sai khác #10).
2. **Đã vào ⇒ admitted**: người từng vào phòng (kể cả vào thẳng khi phòng chờ tắt) vẫn vào lại được sau khi host bật phòng chờ / khoá phòng. `LOCK` chỉ chặn người mới (Sai khác #8).
3. **Ghi chú vẫn sửa được sau khi họp kết thúc** (trang chi tiết MT4) — theo quyền như lúc đang họp (Sai khác #15).
4. **Người bị mời ra mất quyền đọc** lịch sử chat và ghi chú của cuộc họp đó (cả sau ENDED).
5. Tốc độ chat họp **dùng chung** hạn mức chat thường (10 tin / 5 giây / người) — không thêm hạn mức riêng.

---

## Ngoài phạm vi MT3

| Việc | Thuộc |
|---|---|
| Web: store `meeting.store.ts` theo `meet.hands/roster/settings/chat/notes.updated/removed/muted/error`, `ParticipantsPanel`, `MeetingChatPanel`, `NotesPanel` (409 không mất chữ, autosave 2s), `HostMenu`, i18n `meeting.*` cho mọi `errorCode` mới | MT5 |
| Flutter: `meeting_room_controller.dart`, `participants_sheet.dart`, `meeting_chat_sheet.dart`, `notes_sheet.dart`, `host_actions_sheet.dart`, ARB `meeting*` | MT7 |
| Trang chi tiết sau họp (ghi chú, lịch sử chat, điểm danh) dùng `GET /notes/*`, `GET /messages` | MT4 (web), MT6 (Flutter) |
| Reaction (data channel LiveKit, server không thấy), "đang nói", layout, share màn hình phía client | MT5, MT7 |
| Ma trận QC tay (giơ tay 3 người, tắt mic tất cả, tắt share attendee, mời ra rồi mở lại link, hai người cùng sửa ghi chú, …), `sync-check` | MT8 |
| `@AI` trong chat họp, phụ đề `meet.transcript`/`meet.caption`, biên bản từ ghi chú + chat | Meetings P2 |
| Co-editing realtime ghi chú (CRDT), file/ảnh trong chat họp, sửa/thu hồi tin chat họp | backlog (spec §7, D11) |
| Bật lại quyền share cho người cầm token giới hạn cấp **trước** lệnh `ATTENDEE_SCREEN_SHARE_ON` (cửa sổ ≤ 10 phút — họ `join` lại là có) | chấp nhận, không làm |
| `ChatController` trả `e.getMessage()` của `RateLimitExceededException` trong sự kiện `RATE_LIMITED` (chữ nội bộ ra client) | việc riêng, không thuộc tính năng họp |

## Final gate (chạy trước khi PR `feat/meetings-p1` → `dev`)

```bash
# chat-service (JDK 21; Docker chạy cho Testcontainers)
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home \
  mvn -B -f apps/server/chat-service/pom.xml spotless:apply
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home \
  mvn -B -f apps/server/chat-service/pom.xml spotless:check test

# kích thước file
wc -l apps/server/chat-service/src/main/java/com/platform/chatservice/service/meeting/*.java \
      apps/server/chat-service/src/main/java/com/platform/chatservice/controller/Meeting*.java \
      apps/server/chat-service/src/main/java/com/platform/chatservice/security/MeetingTopicOutboundInterceptor.java

# MT3 không đụng client — các gate dưới chỉ để chắc nhánh vẫn xanh trước PR
pnpm --filter @platform/web exec tsc --noEmit
cd apps/client && flutter analyze && cd -

# không lọt file dev-only
git diff origin/main...HEAD --stat   # chỉ file của MT1–MT3; không scripts/dev/, *.local, localhost
```
