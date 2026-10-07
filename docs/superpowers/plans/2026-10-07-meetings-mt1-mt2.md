# Phòng họp P1 — MT1 (capability `HOST_MEETING`) + MT2 (chat-service) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (MT1) thêm capability `HOST_MEETING` end-to-end — catalog RBAC, preset, JWT `perms`, nhãn ma trận quyền trên web + Flutter ở 7 locale. (MT2) chat-service có domain **Phòng họp**: tạo họp ngay / lên lịch, xem, danh sách, sửa, huỷ, vào phòng (token LiveKit) hoặc phòng chờ, cho vào / từ chối, kết thúc, điểm danh + trạng thái phòng từ webhook LiveKit, nhắc lịch trước 10 phút — kèm sự kiện STOMP và mã lỗi ổn định.

**Architecture:** Domain `Meeting` mới trong chat-service (tách khỏi `CallSession`, spec D7), luôn chạy trên LiveKit, room `meet_{meetingId}` (`RtcRooms.forMeeting`, đã có). Tái dùng nguyên lớp `rtc` (`LiveKitTokenService`, `LiveKitRoomClient`, `RtcWebhookDispatcher` → `RtcRoomEventHandler`), chỉ **thêm** `LiveKitRoomClient.createRoom`. Logic chia nhỏ trong package mới `service/meeting/` để mỗi file < 500 dòng: quyền là hàm thuần (`MeetingAccess`), mọi ghi Mongo sau khi tạo là cập nhật nguyên tử qua `MeetingStore` (webhook của 25 người tới đồng thời — `save()` cả document sẽ làm mất điểm danh), Redis phòng chờ qua `MeetingLobby`, phát sự kiện + FCM qua `MeetingEvents`. Controller mỏng, kiểm quyền/capability ở service, lỗi qua `ApiException` (`{error, code, statusCode, params?}`).

**Tech Stack:** Spring Boot 3.3 · Java 21 · MongoDB · Redis · STOMP · JUnit 5 + Mockito + AssertJ + Testcontainers (đã có trong `pom.xml`) · Spotless · TypeScript (`packages/database`, auth-service jest) · Next.js (vitest) · Flutter (ARB + `flutter test`).

**Spec:** `docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md` §3 (D7–D11), §4.1, §4.3. **Milestone plan (binding):** `docs/superpowers/plans/2026-10-05-meetings-p1-core.md` — Model, Quyền, Contract, MT1, MT2. Plan này hiện thực MT1 + MT2 của plan đó; chỗ nào lệch đều ghi ở mục "Sai khác so với milestone plan".

## Global Constraints

- Nhánh `feat/meetings-p1` (worktree hiện tại, cắt từ `main` = v1.1.0). Không commit dữ liệu seed / localhost / key LiveKit dev (`.claude/rules/dev-local-only.md`); test trên `dev` trước khi PR.
- Java ≤ 500 dòng/file, controller chỉ parse + gọi service (`.claude/rules/clean-code.md`). `mvn spotless:apply` sau **mỗi** lần sửa Java; Maven chạy JDK 21:
  `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home mvn -B -f apps/server/chat-service/pom.xml ...`
- **Sau `insert` đầu tiên, không bao giờ `meetingRepository.save(meeting)`** — mọi thay đổi đi qua `MeetingStore` bằng `$set` / `$push` / positional update có điều kiện. Lý do: webhook `participant_joined/left` của nhiều người tới song song; read-modify-write cả document sẽ ghi đè điểm danh của nhau.
- Lỗi REST: `ApiException(status, code)` hoặc `ApiException(status, code, null, params)` — body `{error, code, statusCode, params?}`, **không** có `message` nội bộ. Không dùng `@PreAuthorize` (xem Sai khác #7).
- Không lộ dữ liệu thô (`.claude/rules/no-raw-system-data-in-ui.md`): response/sự kiện mang **tên** người (`displayName`) cạnh mọi userId để client không phải hiện id; tên không resolve được ⇒ bỏ trống (client hiện nhãn chung), **không** thay bằng userId. Tên room `meet_*` không bao giờ nằm trong payload gửi client.
- Giới hạn (milestone): tiêu đề ≤ 120, mô tả ≤ 2000, ≤ 100 người mời đích danh, tối đa 25 người trong phòng.
- Room LiveKit: identity = userId, name = `users.displayName`, metadata `{"avatarUrl": "..."}` khi có (giống `SfuCallService.issueToken`).
- `call:user:{userId}` = `meet_{meetingId}` khi đang trong phòng (dùng chung `CallBusyRegistry`) ⇒ đang họp = bận với Cuộc gọi; chỉ xoá khi giá trị đúng là room này (`CallBusyRegistry.clear` đã làm vậy).
- i18n: web `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json`; Flutter `apps/client/lib/l10n/app_*.arb` thêm bằng `apps/client/tool/add_arb_keys.py` rồi `flutter gen-l10n`; **không** sửa tay `app_localizations*.dart`.
- Không biến môi trường mới. Chu kỳ sweep đọc `${app.meeting.sweep-interval-ms:60000}` (chỉ là default trong annotation, không thêm vào `application.yml` ⇒ không đụng `check-env-parity.sh`).

## Review Focus

1. **Người không được mời mở link khi host chưa vào** — `join` trả `{status:"waiting"}`, người đó nằm trong `meet:lobby:{id}`; host gọi `join` sau đó nhận ngay `meet.lobby` với danh sách chờ. Test Task 11.
2. **Người bị mời ra (`removedIds`) gọi `join`** — 403 `MEETING_REMOVED`, **không** vào phòng chờ. Test Task 6 + 11. (Việc đưa vào `removedIds` là MT3.)
3. **Hai webhook `participant_joined` của hai người tới cùng lúc** — cả hai dòng điểm danh còn nguyên. Test Task 7 (Testcontainers, `MeetingStoreTest`).
4. **Host rời phòng không bấm Kết thúc** — `participant_left` chỉ đóng dòng điểm danh, phòng vẫn LIVE; LiveKit đóng room sau 5 phút trống (`departure_timeout=300` đặt khi `createRoom`) ⇒ `room_finished` ⇒ ENDED, idempotent. Test Task 8 + 13.
5. **Mở link cuộc họp đã kết thúc** — `GET /by-code/{code}` vẫn 200 (client sang trang chi tiết), `join` trả 409 `MEETING_ENDED`. Test Task 10 + 11.
6. **Nhắc lịch chạy trên nhiều instance** — mỗi cuộc họp nhắc đúng một lần nhờ claim `reminded:false → true`. Test Task 14.

---

## Ruling khi viết plan

Như plan C1: plan ghi **đầy đủ code test** (test là đặc tả) cho các lớp có logic; code hiện thực mô tả bằng chữ ký + hành vi chính xác thay vì chép sẵn. Lớp chỉ là dữ liệu (model, DTO record) ghi đủ field. Nếu giao cho người khác thực thi mà không có ngữ cảnh phiên này, viết bổ sung code hiện thực trước.

Đường dẫn viết tắt trong plan:
- `M/` = `apps/server/chat-service/src/main/java/com/platform/chatservice/`
- `T/` = `apps/server/chat-service/src/test/java/com/platform/chatservice/`
- `MVN` = `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home mvn -B -f apps/server/chat-service/pom.xml`

---

## Sai khác so với milestone plan (đã đối chiếu code thật, 2026-10-07)

| # | Milestone plan nói | Code thật | Plan này làm |
|---|---|---|---|
| 1 | MT1: sau khi sửa `packages/database/src` chạy `npx tsc -p . --outDir src` vì có `.js` build sẵn trong `src/` che file `.ts` | `git ls-files packages/database/src` **không** còn file `.js` nào; auth-service jest map `@platform/database` → `packages/database/src` (`apps/server/auth-service/package.json` `moduleNameMapper`) và đọc thẳng `.ts`. Chạy lệnh đó bây giờ sẽ **tạo ra** chính các file `.js` che `.ts` | **Không** chạy. Thay bằng kiểm tra `find packages/database/src -name '*.js'` rỗng; build package bằng `pnpm --filter @platform/database build` (ra `dist/`) |
| 2 | MT1: thêm migration idempotent trong `bootstrap.service.ts` | `BootstrapService.ensurePresetRoles()` (`apps/server/auth-service/src/modules/workspace/bootstrap.service.ts:77`) đã merge `preset.permissions` dưới giá trị đã lưu bằng `$mergeObjects` cho Admin/Manager/Member và ép full matrix cho Owner ⇒ preset đã lưu tự nhận key mới khi boot | Không thêm code; chỉ thêm test khoá hành vi cho `HOST_MEETING` (Task 2) |
| 3 | MT1 Flutter: `features/admin/data/admin_models.dart` | File thật: `apps/client/lib/features/admin/data/models/admin_models.dart` (`abstract class Cap`, không phải enum); nhãn ở `features/admin/ui/widgets/cap_label.dart` | Dùng đường dẫn thật |
| 4 | MT1 web: nhãn `admin.cap*` | Key thật: `admin.caps.<CAPABILITY>` (vd `admin.caps.MANAGE_AI_CONTEXT`), render ở `components/admin/RolesPanel.tsx` qua `t(\`caps.${cap}\`)` | Thêm `admin.caps.HOST_MEETING` |
| 5 | MT2: sửa `MongoIndexInitializer` để thêm index | `M/config/MongoIndexInitializer.java` tự resolve mọi `@Indexed`/`@CompoundIndex` của mọi `@Document` | Khai báo index bằng annotation trên model; **không** sửa `MongoIndexInitializer` |
| 6 | `MeetingAccess.decide(meeting, userId, departmentIds)` | Bước 4 của bảng quyền cần biết user có trong `meet:admitted:{id}` (Redis) — hàm thuần không đọc Redis | Chữ ký `decide(meeting, userId, departmentIds, admitted)`; caller đọc `admitted` qua `MeetingLobby.isAdmitted` |
| 7 | MT2 test: "thiếu `HOST_MEETING` ⇒ 403" ở `MeetingControllerTest` | `@PreAuthorize` ném `AccessDeniedException` — `GlobalExceptionHandler` không có handler riêng nên rơi vào `handleGeneric(RuntimeException)` ⇒ **500** (lỗi tiềm ẩn đang có ở `ExternalBotController`) | Kiểm capability trong `MeetingService.create` bằng `ApiException(403, MEETING_CREATE_FORBIDDEN)`; test ở `MeetingServiceTest`; `MeetingControllerTest` kiểm route + hình dạng lỗi |
| 8 | Index `{hostId, scheduledStart}`, `{inviteeIds, scheduledStart}`, `{departmentId, scheduledStart}`, `{status, scheduledStart}` | "Họp ngay" có `scheduledStart = null` ⇒ không sắp xếp được trong danh sách | Thêm field nội bộ `sortAt = scheduledStart ?? createdAt` (không trả cho client); index `{hostId, sortAt}`, `{coHostIds, sortAt}` (thêm — co-host cũng phải thấy trong danh sách), `{inviteeIds, sortAt}`, `{departmentId, sortAt}`, `{status, scheduledStart}` |
| 9 | Phòng tự ENDED khi trống 5 phút (`empty_timeout`) | `infra/livekit/compose.livekit.yml` chỉ đặt `empty_timeout: 300` (áp cho room **chưa ai vào**). Room tự tạo khi join dùng `departure_timeout` mặc định của LiveKit (20 giây — cần xác nhận theo bản LiveKit đang chạy) cho room **đã có người rồi trống** ⇒ host rớt mạng 20 giây là cuộc họp ENDED. `LiveKitRoomClient` chưa có `CreateRoom` dù spec §4.1 liệt kê | Thêm `LiveKitRoomClient.createRoom(room, emptyTimeout, departureTimeout, maxParticipants)` (Twirp `CreateRoom`, idempotent phía LiveKit); `join` gọi với `300, 300, 25` trước khi cấp token |
| 10 | Subscribe `/topic/meeting/{id}`: "chỉ người đang ở trong phòng hoặc host/co-host" | Client subscribe **trước** khi kết nối LiveKit; webhook `joined` tới sau vài trăm ms ⇒ kiểm "đang ở trong phòng" sẽ từ chối chính người vừa được cấp token | Cho subscribe khi `MeetingAccess.decide(...)` ∈ {HOST, COHOST, INVITED} — đúng tập người được cấp token; người đang chờ / bị mời ra / phòng khoá / ENDED bị từ chối |
| 11 | Contract chưa nói cách huỷ thông báo cho người được mời, chưa có mã lỗi cho phòng đầy / huỷ sai trạng thái / dữ liệu không hợp lệ | — | **Bổ sung** (đánh dấu ➕ trong mục Contract): sự kiện `meet.cancelled`; `meet.ended` cũng gửi qua `/user/queue/meeting` cho người đang trong phòng chờ (họ chưa subscribe topic); mã `MEETING_NOT_FOUND`, `MEETING_FORBIDDEN`, `MEETING_CREATE_FORBIDDEN`, `MEETING_DEPARTMENT_FORBIDDEN`, `MEETING_INVALID`, `MEETING_FULL`, `MEETING_NOT_CANCELLABLE`; field `viewerRole`, `host`/`coHosts`/`invitees` dạng `{userId, displayName, avatarUrl}`, `cancelledAt` |
| 12 | Spec §4.3 model có `settings.aiNotetaker`, `summaryId` | Milestone plan (binding) bỏ hai field này khỏi P1 | Theo milestone: không có (thuộc Meetings P2) |
| 13 | Nhánh `feat/meetings` | Worktree đang ở `feat/meetings-p1` | Dùng `feat/meetings-p1` |

---

## Contract chốt cho MT1–MT2 (web/mobile MT4–MT7 dựa vào đây)

➕ = bổ sung so với milestone plan (lý do ở Sai khác #11). Thời gian luôn là chuỗi ISO-8601 UTC (`Instant`); field `null` bị **bỏ khỏi** JSON (`spring.jackson.default-property-inclusion: non_null`).

### Capability (MT1)

- Key mới `HOST_MEETING` — đứng **cuối** catalog (sau `VIEW_CONFIDENTIAL_CONTEXT`), nên ma trận quyền web/Flutter hiện nó ở dòng cuối.
- Preset: Owner (full matrix) ✓, Admin ✓, Manager ✓, Member ✓ — spec D9 ("Owner/Admin/Manager/Member đều bật; admin tắt được theo role") + milestone MT1. Lý do: tạo phòng họp là công cụ cộng tác cơ bản như tạo nhóm chat; RBAC chỉ để công ty nào muốn thì khoá lại.
- Role **tuỳ chỉnh** đã lưu không có key ⇒ tắt (milestone: "Role đã lưu trong DB không có key mới ⇒ coi là tắt"); admin bật bằng tay trong ma trận.
- Đi vào JWT `perms` như mọi capability (`ClaimsService` → `enabledCapabilities`); chat-service đọc qua `UserPrincipal.hasPermission("HOST_MEETING")`. Người đang đăng nhập nhận quyền mới ở lần refresh access token kế tiếp.
- Chỉ **tạo** cuộc họp cần `HOST_MEETING`. Vào họp, làm co-host, cho vào/từ chối không cần capability.

### Object `Meeting` (response của mọi endpoint trả cuộc họp)

```json
{
  "id": "670f1c2ab9e4d21f0c3a9e11",
  "code": "abc-defg-hjk",
  "title": "Weekly sync",
  "description": "Agenda…",
  "host":    { "userId": "64b0…01", "displayName": "Lan Nguyen", "avatarUrl": "/api/uploads/…" },
  "coHosts": [ { "userId": "64b0…02", "displayName": "Minh Tran" } ],
  "invitees":[ { "userId": "64b0…03", "displayName": "Hoa Le", "avatarUrl": "/api/uploads/…" } ],
  "departmentId": "66aa…09",
  "scheduledStart": "2026-10-08T02:00:00Z",
  "scheduledEnd":   "2026-10-08T03:00:00Z",
  "status": "SCHEDULED",
  "settings": {
    "waitingRoom": true, "muteOnEntry": false, "allowAttendeeScreenShare": true,
    "attendeesCanEditNotes": true, "locked": false
  },
  "attendance": [
    { "userId": "64b0…01", "displayName": "Lan Nguyen", "role": "host",
      "joinedAt": "2026-10-08T02:00:05Z", "leftAt": "2026-10-08T02:40:00Z" }
  ],
  "removedIds": ["64b0…07"],
  "viewerRole": "host",
  "createdAt": "2026-10-07T09:00:00Z",
  "startedAt": "2026-10-08T02:00:05Z",
  "endedAt":   "2026-10-08T02:41:00Z",
  "cancelledAt": null
}
```

- `status` ∈ `SCHEDULED | LIVE | ENDED`. Không có `scheduledStart` = họp ngay. ENDED là kết thúc hẳn (kể cả huỷ: `status=ENDED` + `cancelledAt`).
- `viewerRole` ➕ ∈ `host | cohost | invited | guest` — vai trò **người gọi API** với cuộc họp này. `invited` = có trong `invitees`, thuộc `departmentId`, hoặc đã từng có trong `attendance`.
- Field theo `viewerRole`:
  - `guest` (có link, cùng workspace): chỉ `id, code, title, description, host, scheduledStart, scheduledEnd, status, settings, viewerRole, createdAt, startedAt, endedAt, cancelledAt`.
  - `invited`: thêm `coHosts, invitees, departmentId, attendance`.
  - `host` / `cohost`: thêm `removedIds` (id thô — client chỉ dùng để lọc/so khớp, **không** hiển thị; muốn hiện thì resolve tên).
- `attendance[]` là từng **phiên** vào/ra (một người vào lại = dòng mới); `leftAt` vắng = đang trong phòng. `role` ∈ `host | cohost | attendee` tại lúc vào.
- `displayName` / `avatarUrl` vắng khi không resolve được ⇒ client hiện nhãn chung ("Ai đó"), không hiện userId.

### REST `/api/meetings` (chat-service, JWT bắt buộc)

| Method · Path | Ai được gọi | Request | 2xx | Lỗi (`code`) |
|---|---|---|---|---|
| `POST /api/meetings` | có `HOST_MEETING` | `CreateMeetingRequest` | **201** `Meeting` (`viewerRole:"host"`) | 403 `MEETING_CREATE_FORBIDDEN` · 403 `MEETING_DEPARTMENT_FORBIDDEN` · 400 `MEETING_INVALID` |
| `GET /api/meetings?scope=upcoming\|past&cursor=&size=` | mọi người | — | 200 `PageResponse<Meeting>` | 400 `MEETING_INVALID {field:"scope"}` |
| `GET /api/meetings/{id}` | mọi người trong workspace | — | 200 `Meeting` (field theo `viewerRole`) | 404 `MEETING_NOT_FOUND` |
| `GET /api/meetings/by-code/{code}` | mọi người trong workspace | `code` không phân biệt hoa thường, có/không gạch ngang | 200 `Meeting` | 404 `MEETING_NOT_FOUND` |
| `PATCH /api/meetings/{id}` | host, co-host | `UpdateMeetingRequest` | 200 `Meeting` | 403 `MEETING_FORBIDDEN` · 403 `MEETING_DEPARTMENT_FORBIDDEN` · 404 · 409 `MEETING_ENDED` · 400 `MEETING_INVALID` |
| `DELETE /api/meetings/{id}` (huỷ) | host | — | 204 | 403 `MEETING_FORBIDDEN` · 404 · 409 `MEETING_NOT_CANCELLABLE` (đã LIVE/ENDED hoặc đã từng có người vào) |
| `POST /api/meetings/{id}/join` | mọi người trong workspace | — | 200 `MeetingJoinResponse` | 403 `MEETING_REMOVED` · 403 `MEETING_LOCKED` · 404 · 409 `MEETING_ENDED` · 409 `MEETING_FULL` ➕ · 503 `MEETINGS_UNAVAILABLE` |
| `DELETE /api/meetings/{id}/lobby` | người đang chờ | — | 204 (idempotent) | 404 |
| `POST /api/meetings/{id}/lobby/{userId}/admit` | host, co-host | — | 204 (idempotent: không còn chờ ⇒ vẫn 204, không phát gì) | 403 `MEETING_FORBIDDEN` · 404 · 409 `MEETING_ENDED` |
| `POST /api/meetings/{id}/lobby/{userId}/deny` | host, co-host | — | 204 (idempotent như trên) | 403 · 404 · 409 `MEETING_ENDED` |
| `POST /api/meetings/{id}/end` | host, co-host | — | 204 (đã ENDED ⇒ vẫn 204) | 403 `MEETING_FORBIDDEN` · 404 |

Body lỗi: `{"error":"Forbidden","code":"MEETING_LOCKED","statusCode":403}`; `MEETING_INVALID` thêm `params`, vd `{"error":"Bad Request","code":"MEETING_INVALID","statusCode":400,"params":{"field":"title","max":120}}`. `params.field` ∈ `title | description | inviteeIds | departmentId | scheduledStart | scheduledEnd | settings | scope`.

Các endpoint ghi chú (`/notes/*`) và chat (`/messages`) của contract thuộc **MT3**, không có ở đây.

**`CreateMeetingRequest`**

```json
{
  "title": "Weekly sync",
  "description": "Agenda…",
  "inviteeIds": ["64b0…03"],
  "departmentId": "66aa…09",
  "scheduledStart": "2026-10-08T02:00:00Z",
  "scheduledEnd": "2026-10-08T03:00:00Z",
  "settings": { "waitingRoom": true, "locked": false }
}
```

Quy tắc (vi phạm ⇒ 400 `MEETING_INVALID` với `params.field`):
- `title` tuỳ chọn, trim, ≤ 120 (`max:120`); rỗng ⇒ lưu `null` — client tự hiện tiêu đề mặc định đã dịch (vd "Cuộc họp của {host}"). Server **không** sinh tiêu đề chữ.
- `description` ≤ 2000 (`max:2000`); rỗng ⇒ `null`.
- `inviteeIds`: bỏ trùng, bỏ host; id không phải ObjectId hợp lệ ⇒ 400; > 100 sau khi lọc ⇒ 400 `max:100`; id hợp lệ nhưng không có user ⇒ bỏ âm thầm.
- `departmentId`: người tạo phải thuộc phòng ban đó hoặc có `MANAGE_DEPARTMENTS` (như `ConversationService.requireDepartmentAccess`), ngược lại 403 `MEETING_DEPARTMENT_FORBIDDEN`.
- `scheduledStart` vắng ⇒ họp ngay. Có ⇒ không sớm hơn `now − 5 phút` (`field:"scheduledStart"`).
- `scheduledEnd` chỉ hợp lệ khi có `scheduledStart`, phải `> scheduledStart` và `≤ scheduledStart + 24h` (`field:"scheduledEnd"`).
- `settings` partial; field vắng lấy mặc định `waitingRoom=true, muteOnEntry=false, allowAttendeeScreenShare=true, attendeesCanEditNotes=true, locked=false`. `muteOnEntry` chỉ là gợi ý cho client (bật mic tắt khi vào) — server không ép.

**`UpdateMeetingRequest`** — cùng field với Create, mọi field tuỳ chọn; field vắng = giữ nguyên; `inviteeIds` có mặt = **thay** cả danh sách; `settings` merge từng field; `description: ""` = xoá. Đổi `scheduledStart`/`scheduledEnd` khi `status=LIVE` ⇒ 400 `MEETING_INVALID {field:"scheduledStart"}`. Đổi `scheduledStart` ⇒ reset `reminded=false`. Người **mới** có trong `inviteeIds` nhận `meet.invited`. Đổi `settings` ⇒ phát `meet.settings`.

**`GET /api/meetings` (danh sách)** — người gọi là host / co-host / được mời đích danh / thuộc `departmentId` (theo claim `depts`).
- `scope=upcoming` (mặc định): `status ∈ {SCHEDULED, LIVE}`, sắp theo `(sortAt asc, _id asc)` — `sortAt = scheduledStart ?? createdAt`, không trả về client.
- `scope=past`: `status = ENDED`, sắp `(sortAt desc, _id desc)`.
- `cursor` = `id` của phần tử cuối trang trước; `size` mặc định 20, kẹp bởi `PageLimits.size` (≤ 100).
- Response `PageResponse<Meeting>` như `GET /api/conversations/{id}/messages`: `{content, page:0, size, totalElements, hasNext}` (totalElements tổng hợp từ over-fetch một dòng, như `MessageQueryService.getMessages`).
- Cuộc họp `SCHEDULED` mà `sortAt` đã qua 48h ⇒ sweep chuyển `ENDED` (Task 14) nên "Sắp tới" không đọng rác.

**`MeetingJoinResponse`**

```json
{ "status": "joined", "url": "wss://rtc.example.com", "token": "eyJ…", "role": "host" }
{ "status": "waiting" }
```

- `role` ∈ `host | cohost | attendee`. Token sống `app.livekit.token-ttl-seconds` (600s), room `meet_{id}`, identity = userId. Host/co-host: grant thêm `roomAdmin`. Attendee khi `allowAttendeeScreenShare=false`: `canPublishSources=["camera","microphone"]`.
- `waiting`: client subscribe `/user/queue/meeting`, chờ `meet.admitted` rồi gọi lại `join` (lần này trả `joined`), hoặc `meet.denied` / `meet.ended`.
- Gọi lại `join` khi đang chờ ⇒ vẫn `waiting` (không nhân đôi trong phòng chờ). Người trong phòng chờ rời trang ⇒ client gọi `DELETE /lobby`.

### STOMP (MT2 phát; MT3 thêm `meet.hands`, `meet.chat`, `meet.notes.updated`, `meet.removed`, lệnh `/app/meet.*`)

Mọi payload là `MeetingEventDto` `{event, meetingId, …}` — field vắng thì bỏ.

| Destination | `event` | Payload | Khi nào |
|---|---|---|---|
| `/topic/meeting/{id}` | `meet.roster` | `{event, meetingId, participants:[{userId, displayName, role, joinedAt}]}` — người đang trong phòng (mỗi userId một dòng, `joinedAt` của phiên đang mở) | webhook `participant_joined` / `participant_left` |
| `/topic/meeting/{id}` | `meet.settings` | `{event, meetingId, settings:{…5 field…}}` | `PATCH` đổi `settings` |
| `/topic/meeting/{id}` | `meet.ended` | `{event, meetingId}` | `POST /end`, `room_finished` |
| `/user/queue/meeting` | `meet.lobby` | `{event, meetingId, waiting:[{userId, displayName}]}` (sắp theo tên; tên vắng ở cuối) | gửi host + co-host khi phòng chờ đổi, và khi host/co-host `join` (kể cả danh sách rỗng ⇒ client xoá badge) |
| `/user/queue/meeting` | `meet.admitted` | `{event, meetingId}` | host cho vào |
| `/user/queue/meeting` | `meet.denied` | `{event, meetingId}` | host từ chối |
| `/user/queue/meeting` | `meet.ended` ➕ | `{event, meetingId}` | gửi người **đang trong phòng chờ** khi cuộc họp kết thúc |
| `/user/queue/meeting` | `meet.invited` | `{event, meetingId, code, title, hostId, hostName, scheduledStart}` | tạo cuộc họp / `PATCH` thêm người — chỉ người trong `inviteeIds` (không fan-out cả phòng ban) |
| `/user/queue/meeting` | `meet.starting` | `{event, meetingId, code, title, scheduledStart}` | 10 phút trước `scheduledStart` — host, co-host, người được mời, thành viên `departmentId`, trừ `removedIds` |
| `/user/queue/meeting` | `meet.cancelled` ➕ | `{event, meetingId}` | host huỷ (`DELETE`) — cùng tập người như `meet.starting` |

Subscribe:
- `/user/queue/meeting` — mọi user đã xác thực (allow-list exact).
- `/topic/meeting/{id}` — chỉ khi `MeetingAccess.decide(...)` ∈ {HOST, COHOST, INVITED} (Sai khác #10); ngược lại ERROR `Unauthorized subscription`.

### FCM (data, cho Flutter MT6)

- `MEETING_INVITED` — gửi người được mời đích danh **khi họ offline** (giống push tin nhắn).
- `MEETING_STARTING` — gửi mọi người nhận `meet.starting`, **bất kể** online (giống push Reminder).
- `data`: `{type, meetingId, code}`. `notification.title` = tiêu đề cuộc họp (nội dung người dùng nhập; vắng ⇒ không đặt title). Body **không** có chữ cứng: Android `body_loc_key` = `meeting_push_invited` / `meeting_push_starting`, APNs `loc-key` cùng tên — Flutter (MT6) phải thêm chuỗi tài nguyên native cho 7 locale và tự dịch khi app ở foreground theo `type`. Channel Android `pon_meetings`.

---

# MT1 — Capability `HOST_MEETING`

### Task 1: Catalog + preset trong `packages/database`

**Files:**
- Modify: `packages/database/src/rbac/capabilities.ts` — thêm vào **cuối** enum:
  ```ts
  /** Create and schedule meetings (Phòng họp). Joining a meeting needs no capability. */
  HOST_MEETING = 'HOST_MEETING',
  ```
- Modify: `packages/database/src/rbac/preset-roles.ts` — `[C.HOST_MEETING]: true` cho Admin, Manager, Member (Owner tự có qua `buildFullMatrix`). Cập nhật doc comment của `PRESET_ROLES`: "HOST_MEETING is on for every preset (spec D9) — admins may switch it off per role".
- Test: `packages/database/src/rbac/preset-roles.spec.ts`

- [ ] **Step 1: Test** — sửa `'exposes all 14 capabilities in the catalog'` thành 15 và thêm:

```ts
  it('exposes all 15 capabilities in the catalog', () => {
    expect(Object.keys(Capability)).toHaveLength(15);
  });

  it('lists HOST_MEETING last so the role matrices keep their existing order', () => {
    const all = Object.values(Capability);
    expect(all[all.length - 1]).toBe(Capability.HOST_MEETING);
  });

  it('lets every preset role host meetings (spec D9)', () => {
    for (const role of PRESET_ROLES) {
      expect(role.permissions[Capability.HOST_MEETING]).toBe(true);
    }
  });
```

(xoá test `14` cũ — chỉ còn một test đếm.)

- [ ] **Step 2: RED** — `pnpm --filter @platform/database test` ⇒ đỏ: đếm ra 14 ≠ 15, phần tử cuối là `VIEW_CONFIDENTIAL_CONTEXT`, preset thiếu key.
- [ ] **Step 3: Hiện thực** như mục Files.
- [ ] **Step 4: GREEN** — `pnpm --filter @platform/database test && pnpm --filter @platform/database build`; rồi `find packages/database/src -name '*.js'` phải **rỗng** (Sai khác #1 — không chạy `tsc --outDir src`).
- [ ] **Step 5: Commit** `feat(rbac): HOST_MEETING capability, on for every preset role`

---

### Task 2: auth-service — khoá hành vi bằng test (không đổi code)

auth-service đọc catalog từ `@platform/database` (`ClaimsService` → `enabledCapabilities`, `role-grant.ts` → `ALL_CAPABILITIES`, `BootstrapService.ensurePresetRoles` → `$mergeObjects`). Không cần sửa code; chỉ thêm test để một refactor sau này không âm thầm làm mất quyền tạo họp của role đã lưu.

**Files:**
- Test: `apps/server/auth-service/src/modules/workspace/bootstrap.service.spec.ts` — thêm một `it` vào `describe('BootstrapService')`

- [ ] **Step 1: Test**

```ts
  it('gives stored preset roles that predate HOST_MEETING the new capability, keeping admin edits', async () => {
    for (const name of ['Admin', 'Manager', 'Member'] as const) {
      const preset = PRESET_ROLES.find((r) => r.name === name)!;
      const stored: Record<string, boolean> = { ...preset.permissions } as any;
      delete stored[Capability.HOST_MEETING]; // saved by a release before meetings existed
      stored[Capability.USE_GROUP_BOT] = false; // an admin edit that must survive
      roleModel.docs.push({ _id: `r-${name}`, name, isPreset: true, permissions: stored });
    }

    const service = await build();
    await service.onApplicationBootstrap();

    for (const name of ['Admin', 'Manager', 'Member']) {
      const role = roleModel.docs.find((r: any) => r.name === name);
      expect(role.permissions[Capability.HOST_MEETING]).toBe(true);
      expect(role.permissions[Capability.USE_GROUP_BOT]).toBe(false);
    }
  });
```

- [ ] **Step 2: Chạy** — `pnpm --filter @platform/auth-service test -- bootstrap.service.spec` ⇒ xanh ngay (hành vi đã có; nếu đỏ nghĩa là `$mergeObjects` đã bị đổi — dừng lại điều tra, đừng sửa test).
- [ ] **Step 3: Toàn suite** — `pnpm --filter @platform/auth-service test` (các spec dùng `ALL_CAPABILITIES` như `roles.service.spec.ts`, `admin.service.spec.ts` tự nhận key mới; đếm cứng 14 không có trong auth-service — đã grep).
- [ ] **Step 4: Commit** `test(auth): stored preset roles gain HOST_MEETING on boot`

---

### Task 3: Web — nhãn ma trận quyền (7 locale)

**Files:**
- Modify: `apps/web/lib/api/admin-types.ts` — thêm `'HOST_MEETING'` vào **cuối** `CAPABILITIES` (sau `'VIEW_CONFIDENTIAL_CONTEXT'`). **Không** thêm vào `ADMIN_SECTION_CAPS` (`lib/hooks/use-capabilities.ts`) — không mở mục admin nào; **không** thêm vào `PRIVILEGED_CAPABILITIES` (`lib/admin/role-guard.ts`) — không buộc 2FA.
- Modify: `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json` — key `admin.caps.HOST_MEETING` (đặt sau `VIEW_CONFIDENTIAL_CONTEXT`):

  | locale | nhãn |
  |---|---|
  | en | Host meetings |
  | vi | Tổ chức cuộc họp |
  | zh | 主持会议 |
  | ja | 会議を主催 |
  | ko | 회의 주최 |
  | es | Organizar reuniones |
  | fr | Organiser des réunions |

- Test (mới): `apps/web/lib/admin/__tests__/capability-labels.test.ts`

`RolesPanel.tsx` / `RolesPanelMobile.tsx` lặp trên `CAPABILITIES` nên tự có dòng mới; `admin-errors.ts` (`ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS`) và `role-guard.ts` (`grantBlockers`) cũng lọc theo `CAPABILITIES` ⇒ tự nhận.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { CAPABILITIES } from '@/lib/api/admin-types'
import { SUPPORTED_LOCALES } from '@/i18n/config'

const MESSAGES_DIR = path.join(__dirname, '../../../messages')

function caps(locale: string): Record<string, string> {
  const json = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8'))
  return json.admin.caps as Record<string, string>
}

describe('capability labels', () => {
  it('lists HOST_MEETING last, after the AI-context capabilities', () => {
    expect(CAPABILITIES[CAPABILITIES.length - 1]).toBe('HOST_MEETING')
  })

  it.each(SUPPORTED_LOCALES)('%s labels every capability with real text, never the code', (locale) => {
    const labels = caps(locale)
    for (const cap of CAPABILITIES) {
      expect(labels[cap], `${locale} admin.caps.${cap}`).toBeTruthy()
      expect(labels[cap]).not.toBe(cap)
    }
  })
})
```

- [ ] **Step 2: RED** — `pnpm --filter @platform/web exec vitest run lib/admin/__tests__/capability-labels.test.ts`
- [ ] **Step 3: Hiện thực** như mục Files (sửa JSON bằng script Python nhỏ `json.load` → chèn key → `json.dump(..., ensure_ascii=False, indent=2)` **chỉ khi** định dạng file giữ nguyên; nếu không, sửa tay bằng Edit — diff phải chỉ có 7 dòng thêm).
- [ ] **Step 4: GREEN** — test trên + `pnpm --filter @platform/web exec vitest run lib/__tests__/i18n-parity.test.ts lib/admin` + `pnpm --filter @platform/web exec tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(web): HOST_MEETING in the role matrix`

---

### Task 4: Flutter — nhãn ma trận quyền (7 locale)

**Files:**
- Modify: `apps/client/lib/features/admin/data/models/admin_models.dart` — `static const hostMeeting = 'HOST_MEETING';` và thêm vào **cuối** `Cap.all`. **Không** thêm vào `Cap.adminSections`.
- Modify: `apps/client/lib/features/admin/ui/widgets/cap_label.dart` — `case Cap.hostMeeting: return l.adminCapHostMeeting;`
- Modify: `apps/client/lib/l10n/app_{en,vi,zh,ja,ko,es,fr}.arb` — key `adminCapHostMeeting`, cùng chữ với bảng ở Task 3. Thêm bằng:
  ```bash
  cd apps/client && python3 tool/add_arb_keys.py <<'JSON'
  {"adminCapHostMeeting": {"translations": {
    "en": "Host meetings", "vi": "Tổ chức cuộc họp", "zh": "主持会议", "ja": "会議を主催",
    "ko": "회의 주최", "es": "Organizar reuniones", "fr": "Organiser des réunions"}}}
  JSON
  flutter gen-l10n
  ```
- Test: `apps/client/test/features/admin/admin_error_test.dart` — thay test `'the AI-context capabilities have real labels, not their codes'` bằng test bao **mọi** capability.

`roles_panel.dart` lặp `Cap.all`, `admin_error.dart` lọc theo `Cap.all` ⇒ tự nhận.

- [ ] **Step 1: Test**

```dart
  test('every capability has a real label in every locale — never its code', () {
    for (final locale in AppLocalizations.supportedLocales) {
      final loc = lookupAppLocalizations(locale);
      for (final cap in Cap.all) {
        final label = capabilityLabelOf(loc, cap);
        expect(label, isNot(cap), reason: '$locale $cap');
        expect(label, isNot(loc.adminCapUnknown), reason: '$locale $cap');
      }
    }
  });

  test('HOST_MEETING is the last row of the role matrix and opens no admin section', () {
    expect(Cap.all.last, Cap.hostMeeting);
    expect(Cap.adminSections, isNot(contains(Cap.hostMeeting)));
  });
```

- [ ] **Step 2: RED** — `cd apps/client && flutter test test/features/admin/admin_error_test.dart` (compile error `Cap.hostMeeting`).
- [ ] **Step 3: Hiện thực** như mục Files.
- [ ] **Step 4: GREEN** — test trên + `flutter analyze`.
- [ ] **Step 5: Commit** `feat(client): HOST_MEETING in the role matrix`

**MT1 xong khi:** 4 commit trên xanh; `git diff origin/main --stat` chỉ có các file liệt kê ở Task 1–4 (+ file l10n sinh tự động).

---

# MT2 — chat-service: domain, REST, vào phòng, phòng chờ, webhook, nhắc lịch

Thứ tự task theo phụ thuộc: 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16. Mỗi task kết thúc bằng `MVN spotless:apply` rồi test của task + `-Dtest=AssistantMappingUniquenessTest` khi có controller mới.

### Task 5: `MeetingCodeGenerator`

**Files:**
- Create: `M/service/meeting/MeetingCodeGenerator.java`
- Test: `T/service/meeting/MeetingCodeGeneratorTest.java`

**Interfaces — Produces:** `@Component class MeetingCodeGenerator` — `public MeetingCodeGenerator()` (dùng `SecureRandom`), package-private `MeetingCodeGenerator(java.util.Random)`; `public String next()` ⇒ `"xxx-xxxx-xxx"`; `public static String normalize(String raw)` ⇒ dạng chuẩn hoặc `null`; hằng `ALPHABET = "abcdefghjkmnpqrstuvwxyz"` (23 chữ, bỏ `i l o`). 23¹⁰ ≈ 4·10¹³ mã — trùng là cực hiếm; retry khi trùng nằm ở `MeetingService.create` (Task 10, bắt `DuplicateKeyException` từ unique index).

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Test;

class MeetingCodeGeneratorTest {

  @Test
  void codesAreThreeFourThreeLowercaseLettersWithoutLookalikes() {
    MeetingCodeGenerator gen = new MeetingCodeGenerator(new Random(42));
    for (int i = 0; i < 2_000; i++) {
      String code = gen.next();
      assertThat(code).matches("[a-z]{3}-[a-z]{4}-[a-z]{3}");
      assertThat(code).doesNotContain("i", "l", "o");
    }
  }

  @Test
  void codesSpreadOverTheAlphabet() {
    MeetingCodeGenerator gen = new MeetingCodeGenerator(new Random(7));
    Set<Character> seen = new HashSet<>();
    Set<String> codes = new HashSet<>();
    for (int i = 0; i < 500; i++) {
      String code = gen.next();
      codes.add(code);
      code.replace("-", "").chars().forEach(c -> seen.add((char) c));
    }
    assertThat(codes).hasSize(500);
    assertThat(seen).hasSize(MeetingCodeGenerator.ALPHABET.length());
  }

  @Test
  void normalizeAcceptsWhatPeopleTypeOrPaste() {
    assertThat(MeetingCodeGenerator.normalize("abc-defg-hjk")).isEqualTo("abc-defg-hjk");
    assertThat(MeetingCodeGenerator.normalize(" ABC-DEFG-HJK ")).isEqualTo("abc-defg-hjk");
    assertThat(MeetingCodeGenerator.normalize("abcdefghjk")).isEqualTo("abc-defg-hjk");
    assertThat(MeetingCodeGenerator.normalize("abc defg hjk")).isEqualTo("abc-defg-hjk");
  }

  @Test
  void normalizeRejectsAnythingThatCannotBeACode() {
    assertThat(MeetingCodeGenerator.normalize(null)).isNull();
    assertThat(MeetingCodeGenerator.normalize("")).isNull();
    assertThat(MeetingCodeGenerator.normalize("abc-defg-hj")).isNull(); // 9 letters
    assertThat(MeetingCodeGenerator.normalize("abc-defg-hjkm")).isNull(); // 11 letters
    assertThat(MeetingCodeGenerator.normalize("abi-defg-hjk")).isNull(); // 'i' never generated
    assertThat(MeetingCodeGenerator.normalize("ab1-defg-hjk")).isNull();
    assertThat(MeetingCodeGenerator.normalize("670f1c2ab9e4d21f0c3a9e11")).isNull(); // an id
  }
}
```

- [ ] **Step 2: RED** — `MVN test -Dtest=MeetingCodeGeneratorTest` ⇒ compile error.
- [ ] **Step 3: Hiện thực** — `next()`: 10 lần `ALPHABET.charAt(random.nextInt(23))`, chèn `-` sau ký tự 3 và 7. `normalize`: `null`/blank ⇒ `null`; lowercase (`Locale.ROOT`), bỏ mọi `-` và whitespace; đúng 10 ký tự và mọi ký tự ∈ `ALPHABET` ⇒ chèn gạch; ngược lại `null`.
- [ ] **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest=MeetingCodeGeneratorTest`
- [ ] **Step 5: Commit** `feat(meetings): meeting code generator`

---

### Task 6: Model + `MeetingAccess` (bảng quyền, hàm thuần)

**Files:**
- Create: `M/model/MeetingStatus.java` — `public enum MeetingStatus { SCHEDULED, LIVE, ENDED }`
- Create: `M/model/Meeting.java`
- Create: `M/model/MeetingNote.java`, `M/model/MeetingMessage.java` (model + index theo milestone; service dùng chúng ở MT3)
- Create: `M/service/meeting/MeetingAccess.java`
- Test: `T/service/meeting/MeetingAccessTest.java`

`Meeting` (`@Document(collection = "meetings")`, `@Data @Builder @NoArgsConstructor @AllArgsConstructor` như `CallSession`):

```java
@CompoundIndexes({
  @CompoundIndex(name = "host_sort", def = "{'hostId': 1, 'sortAt': 1}"),
  @CompoundIndex(name = "cohost_sort", def = "{'coHostIds': 1, 'sortAt': 1}"),
  @CompoundIndex(name = "invitee_sort", def = "{'inviteeIds': 1, 'sortAt': 1}"),
  @CompoundIndex(name = "dept_sort", def = "{'departmentId': 1, 'sortAt': 1}"),
  @CompoundIndex(name = "status_start", def = "{'status': 1, 'scheduledStart': 1}"),
})
// fields
@Id String id;
@Indexed(unique = true) String code;
String title; String description;
String hostId;
@Builder.Default List<String> coHostIds = new ArrayList<>();
@Builder.Default List<String> inviteeIds = new ArrayList<>();
String departmentId;
Instant scheduledStart; Instant scheduledEnd;
Instant sortAt;                                   // scheduledStart ?? createdAt — list ordering only
@Builder.Default MeetingStatus status = MeetingStatus.SCHEDULED;
@Builder.Default Settings settings = new Settings();
@Builder.Default List<String> removedIds = new ArrayList<>();
@Builder.Default List<Attendance> attendance = new ArrayList<>();
boolean reminded;
Instant createdAt; Instant startedAt; Instant endedAt; Instant cancelledAt;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public static class Settings {
  @Builder.Default private boolean waitingRoom = true;
  private boolean muteOnEntry;
  @Builder.Default private boolean allowAttendeeScreenShare = true;
  @Builder.Default private boolean attendeesCanEditNotes = true;
  private boolean locked;
}

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public static class Attendance {      // one row per session in the room
  private String userId; private String displayName;
  private String role;                // "host" | "cohost" | "attendee" at join time
  private String sid;                 // LiveKit participant sid of this session
  private Instant joinedAt; private Instant leftAt;
}
```

`MeetingNote` (`@Document("meeting_notes")`, `@CompoundIndex(name = "meeting_scope_owner", def = "{'meetingId': 1, 'scope': 1, 'ownerId': 1}", unique = true)`): `id, meetingId, scope ("SHARED" | "PRIVATE"), ownerId (null khi SHARED), content, long version, updatedBy, updatedAt`.
`MeetingMessage` (`@Document("meeting_messages")`, `@CompoundIndex(name = "meeting_created", def = "{'meetingId': 1, 'createdAt': 1}")`): `id, meetingId, senderId, content, createdAt`.

**Interfaces — Produces** (`public final class MeetingAccess`, mọi method `static`, không phụ thuộc Spring):
- `enum Decision { HOST, COHOST, INVITED, MUST_WAIT, DENIED_REMOVED, DENIED_LOCKED, DENIED_ENDED; boolean entersRoom() }` — `entersRoom()` true cho HOST/COHOST/INVITED.
- `Decision decide(Meeting m, String userId, Collection<String> departmentIds, boolean admitted)` — đúng thứ tự 6 bước của milestone (ENDED → removed → host/co-host → invited/department/admitted → locked → waitingRoom).
- `boolean canManage(Meeting m, String userId)` — host hoặc co-host.
- `boolean isInvited(Meeting m, String userId, Collection<String> departmentIds)` — trong `inviteeIds` hoặc `departmentId ∈ departmentIds`.
- `String roleOf(Meeting m, String userId)` — `"host" | "cohost" | "attendee"`.
- `String viewerRole(Meeting m, String userId, Collection<String> departmentIds)` — `"host" | "cohost" | "invited" | "guest"`; `invited` gồm cả người có dòng trong `attendance`.

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.service.meeting.MeetingAccess.Decision;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class MeetingAccessTest {

  private Meeting m;

  @BeforeEach
  void setUp() {
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .coHostIds(new ArrayList<>(List.of("co")))
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .departmentId("dept-a")
            .build();
  }

  private Decision decide(String userId, List<String> depts, boolean admitted) {
    return MeetingAccess.decide(m, userId, depts, admitted);
  }

  @Test
  void defaultsAreScheduledWithAWaitingRoom() {
    assertThat(m.getStatus()).isEqualTo(MeetingStatus.SCHEDULED);
    assertThat(m.getSettings().isWaitingRoom()).isTrue();
    assertThat(m.getSettings().isLocked()).isFalse();
    assertThat(m.getSettings().isAllowAttendeeScreenShare()).isTrue();
  }

  @Test
  void endedMeetingsAdmitNobodyNotEvenTheHost() {
    m.setStatus(MeetingStatus.ENDED);
    assertThat(decide("host", List.of(), false)).isEqualTo(Decision.DENIED_ENDED);
    assertThat(decide("inv", List.of(), true)).isEqualTo(Decision.DENIED_ENDED);
  }

  @Test
  void removedPeopleStayOutEvenIfInvitedOrAdmitted() {
    m.getRemovedIds().add("inv");
    assertThat(decide("inv", List.of("dept-a"), true)).isEqualTo(Decision.DENIED_REMOVED);
  }

  @Test
  void hostAndCoHostEnterEvenWhenLocked() {
    m.getSettings().setLocked(true);
    assertThat(decide("host", List.of(), false)).isEqualTo(Decision.HOST);
    assertThat(decide("co", List.of(), false)).isEqualTo(Decision.COHOST);
  }

  @Test
  void inviteesDepartmentMembersAndAdmittedPeopleEnterDirectlyEvenWhenLocked() {
    m.getSettings().setLocked(true);
    assertThat(decide("inv", List.of(), false)).isEqualTo(Decision.INVITED);
    assertThat(decide("stranger", List.of("dept-b", "dept-a"), false)).isEqualTo(Decision.INVITED);
    assertThat(decide("stranger", List.of(), true)).isEqualTo(Decision.INVITED);
  }

  @Test
  void othersAreRefusedWhenLocked() {
    m.getSettings().setLocked(true);
    assertThat(decide("stranger", List.of("dept-b"), false)).isEqualTo(Decision.DENIED_LOCKED);
  }

  @Test
  void othersWaitWhenTheWaitingRoomIsOnAndWalkInWhenItIsOff() {
    assertThat(decide("stranger", List.of(), false)).isEqualTo(Decision.MUST_WAIT);
    m.getSettings().setWaitingRoom(false);
    assertThat(decide("stranger", List.of(), false)).isEqualTo(Decision.INVITED);
  }

  @Test
  void aMeetingWithoutDepartmentDoesNotMatchAnEmptyDepartmentList() {
    m.setDepartmentId(null);
    assertThat(decide("stranger", List.of(), false)).isEqualTo(Decision.MUST_WAIT);
  }

  @Test
  void nullCollectionsAreTreatedAsEmpty() {
    assertThat(MeetingAccess.decide(m, "stranger", null, false)).isEqualTo(Decision.MUST_WAIT);
  }

  @ParameterizedTest
  @EnumSource(Decision.class)
  void onlyHostCoHostAndInvitedEnterTheRoom(Decision d) {
    assertThat(d.entersRoom())
        .isEqualTo(d == Decision.HOST || d == Decision.COHOST || d == Decision.INVITED);
  }

  @Test
  void rolesAndViewerRoles() {
    assertThat(MeetingAccess.roleOf(m, "host")).isEqualTo("host");
    assertThat(MeetingAccess.roleOf(m, "co")).isEqualTo("cohost");
    assertThat(MeetingAccess.roleOf(m, "inv")).isEqualTo("attendee");
    assertThat(MeetingAccess.canManage(m, "co")).isTrue();
    assertThat(MeetingAccess.canManage(m, "inv")).isFalse();

    assertThat(MeetingAccess.viewerRole(m, "host", List.of())).isEqualTo("host");
    assertThat(MeetingAccess.viewerRole(m, "co", List.of())).isEqualTo("cohost");
    assertThat(MeetingAccess.viewerRole(m, "inv", List.of())).isEqualTo("invited");
    assertThat(MeetingAccess.viewerRole(m, "x", List.of("dept-a"))).isEqualTo("invited");
    assertThat(MeetingAccess.viewerRole(m, "x", List.of())).isEqualTo("guest");

    m.getAttendance()
        .add(
            Meeting.Attendance.builder()
                .userId("x")
                .role("attendee")
                .joinedAt(Instant.now())
                .build());
    assertThat(MeetingAccess.viewerRole(m, "x", List.of())).isEqualTo("invited");
  }
}
```

- [ ] **Step 2: RED** — `MVN test -Dtest=MeetingAccessTest` ⇒ compile error.
- [ ] **Step 3: Hiện thực** model + `MeetingAccess` (mọi list `null` coi như rỗng; so sánh `Objects.equals`).
- [ ] **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest=MeetingAccessTest`
- [ ] **Step 5: Commit** `feat(meetings): meeting model and access rules`

---

### Task 7: Repository + `MeetingStore` (mọi ghi nguyên tử)

**Files:**
- Create: `M/repository/MeetingRepository.java` — `MongoRepository<Meeting, String>`, `Optional<Meeting> findByCode(String code)`
- Create: `M/repository/MeetingNoteRepository.java`, `M/repository/MeetingMessageRepository.java` (rỗng, cho MT3)
- Create: `M/service/meeting/MeetingStore.java`
- Test: `T/service/meeting/MeetingStoreTest.java` — `@DataMongoTest @Testcontainers` như `T/service/DirectConversationLookupTest.java` (cần Docker đang chạy — giống mọi `mvn test` hiện tại của repo)

**Interfaces — Produces** (`@Component @RequiredArgsConstructor class MeetingStore(MongoTemplate mongo, MeetingRepository repository)`):

| Method | Hành vi |
|---|---|
| `Meeting insert(Meeting m)` | `repository.insert(m)`; trùng `code` ⇒ ném `DuplicateKeyException` cho caller retry |
| `Optional<Meeting> findById(String id)` / `findByCode(String code)` | đọc |
| `Optional<Meeting> update(String id, Update update)` | `findAndModify({_id:id, status:{$ne:ENDED}}, update, returnNew(true))`; rỗng khi không có hoặc đã ENDED |
| `boolean markLive(String id, Instant at)` | `{_id, status:SCHEDULED}` ⇒ `status=LIVE, startedAt=at`; true khi đổi được |
| `void recordJoin(String id, Meeting.Attendance row)` | B1: `updateFirst({_id, attendance:{$elemMatch:{userId, leftAt:null}}}, $set attendance.$.sid)`; nếu **`getMatchedCount()` == 0** (không phải modified — webhook lặp lại cùng sid thì modified = 0) ⇒ B2: `$push attendance row` |
| `boolean recordLeave(String id, String userId, String sid, Instant at)` | `updateFirst({_id, attendance:{$elemMatch:{userId, leftAt:null, sid}}}, $set attendance.$.leftAt=at)` — bỏ điều kiện `sid` khi `sid == null`; true khi modified |
| `Optional<Meeting> markEnded(String id, Instant at)` | `findAndModify({_id, status:{$ne:ENDED}}, set status=ENDED, endedAt=at, attendance.$[open].leftAt=at với filterArray open.leftAt==null, returnNew(false))` ⇒ trả bản **trước** khi đổi (để biết ai còn trong phòng); rỗng khi đã ENDED/không có |
| `boolean markCancelled(String id, Instant at)` | `{_id, status:SCHEDULED, startedAt:null, attendance:{$size:0}}` ⇒ `status=ENDED, endedAt=at, cancelledAt=at` |
| `List<Meeting> dueForReminder(Instant now, Duration lead)` | `status ∈ {SCHEDULED, LIVE}` (host mở phòng sớm vẫn phải nhắc người khác), `reminded=false`, `scheduledStart ∈ [now − lead, now + lead]` |
| `boolean claimReminder(String id)` | `{_id, reminded:false}` ⇒ `reminded=true`; true khi modified (như `ReminderSweepService`) |
| `long expireStale(Instant cutoff, Instant at)` | `updateMulti({status:SCHEDULED, sortAt:{$lt:cutoff}}, status=ENDED, endedAt=at)` |
| `List<Meeting> page(String userId, Collection<String> depts, boolean upcoming, Meeting cursor, int limit)` | `$or:[{hostId:u},{coHostIds:u},{inviteeIds:u},{departmentId:{$in:depts}}]` (bỏ nhánh dept khi rỗng) + status (`upcoming` ⇒ `$in [SCHEDULED, LIVE]`, ngược lại `ENDED`) + cursor compound `(sortAt, _id)` như `MessageQueryService.queryMessagePage` (upcoming: `>`; past: `<`); sort `sortAt, _id` asc/desc; `limit` |

Insert luôn ghi `attendance: []` (builder default) — `$[open]` của `markEnded` cần field tồn tại.

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.repository.MeetingRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataMongoTest
@Testcontainers
class MeetingStoreTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired private MongoTemplate template;
  @Autowired private MongoMappingContext mappingContext;
  @Autowired private MeetingRepository repository;
  private MeetingStore store;
  private final Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

  @BeforeEach
  void setUp() {
    repository.deleteAll();
    IndexOperations ops = template.indexOps(Meeting.class);
    new MongoPersistentEntityIndexResolver(mappingContext)
        .resolveIndexFor(Meeting.class)
        .forEach(ops::ensureIndex);
    store = new MeetingStore(template, repository);
  }

  private Meeting meeting(String code, Instant sortAt, String... invitees) {
    return store.insert(
        Meeting.builder()
            .code(code)
            .hostId("host")
            .inviteeIds(new ArrayList<>(List.of(invitees)))
            .sortAt(sortAt)
            .createdAt(now)
            .build());
  }

  private static Meeting.Attendance row(String userId, String sid) {
    return Meeting.Attendance.builder()
        .userId(userId)
        .role("attendee")
        .sid(sid)
        .joinedAt(Instant.now())
        .build();
  }

  private Meeting reload(Meeting m) {
    return store.findById(m.getId()).orElseThrow();
  }

  @Test
  void codesAreUnique() {
    meeting("abc-defg-hjk", now);
    assertThatThrownBy(() -> meeting("abc-defg-hjk", now))
        .isInstanceOf(DuplicateKeyException.class);
    assertThat(store.findByCode("abc-defg-hjk")).isPresent();
  }

  @Test
  void concurrentJoinsAllLand() throws Exception {
    Meeting m = meeting("aaa-aaaa-aaa", now);
    ExecutorService pool = Executors.newFixedThreadPool(8);
    for (int i = 0; i < 20; i++) {
      String user = "u" + i;
      pool.submit(() -> store.recordJoin(m.getId(), row(user, "PA_" + user)));
    }
    pool.shutdown();
    assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

    assertThat(reload(m).getAttendance()).hasSize(20);
  }

  @Test
  void aSecondSessionOfTheSamePersonReplacesTheSidAndAReplayAddsNothing() {
    Meeting m = meeting("bbb-bbbb-bbb", now);
    store.recordJoin(m.getId(), row("u1", "PA_OLD"));
    store.recordJoin(m.getId(), row("u1", "PA_NEW"));
    store.recordJoin(m.getId(), row("u1", "PA_NEW")); // webhook delivered twice

    assertThat(reload(m).getAttendance())
        .singleElement()
        .satisfies(a -> assertThat(a.getSid()).isEqualTo("PA_NEW"));
  }

  @Test
  void aStaleSessionLeavingDoesNotCloseTheNewOne() {
    Meeting m = meeting("ccc-cccc-ccc", now);
    store.recordJoin(m.getId(), row("u1", "PA_OLD"));
    store.recordJoin(m.getId(), row("u1", "PA_NEW"));

    assertThat(store.recordLeave(m.getId(), "u1", "PA_OLD", now)).isFalse();
    assertThat(reload(m).getAttendance().get(0).getLeftAt()).isNull();

    assertThat(store.recordLeave(m.getId(), "u1", "PA_NEW", now)).isTrue();
    assertThat(reload(m).getAttendance().get(0).getLeftAt()).isEqualTo(now);
  }

  @Test
  void comingBackAfterLeavingOpensANewRow() {
    Meeting m = meeting("ddd-dddd-ddd", now);
    store.recordJoin(m.getId(), row("u1", "PA_1"));
    store.recordLeave(m.getId(), "u1", "PA_1", now);
    store.recordJoin(m.getId(), row("u1", "PA_2"));

    assertThat(reload(m).getAttendance()).hasSize(2);
    assertThat(reload(m).getAttendance().get(1).getLeftAt()).isNull();
  }

  @Test
  void liveOnlyOnceAndEndedOnlyOnce() {
    Meeting m = meeting("eee-eeee-eee", now);
    store.recordJoin(m.getId(), row("u1", "PA_1"));
    store.recordJoin(m.getId(), row("u2", "PA_2"));
    store.recordLeave(m.getId(), "u2", "PA_2", now.minusSeconds(60));

    assertThat(store.markLive(m.getId(), now)).isTrue();
    assertThat(store.markLive(m.getId(), now.plusSeconds(5))).isFalse();
    assertThat(reload(m).getStartedAt()).isEqualTo(now);

    Instant end = now.plusSeconds(600);
    Meeting before = store.markEnded(m.getId(), end).orElseThrow();
    assertThat(before.getStatus()).isEqualTo(MeetingStatus.LIVE);
    assertThat(before.getAttendance().stream().filter(a -> a.getLeftAt() == null))
        .extracting(Meeting.Attendance::getUserId)
        .containsExactly("u1");

    Meeting after = reload(m);
    assertThat(after.getStatus()).isEqualTo(MeetingStatus.ENDED);
    assertThat(after.getEndedAt()).isEqualTo(end);
    assertThat(after.getAttendance()).allSatisfy(a -> assertThat(a.getLeftAt()).isNotNull());
    assertThat(after.getAttendance().get(1).getLeftAt()).isEqualTo(now.minusSeconds(60));

    assertThat(store.markEnded(m.getId(), end.plusSeconds(1))).isEmpty();
    assertThat(store.update(m.getId(), new Update().set("title", "x"))).isEmpty();
  }

  @Test
  void onlyAMeetingNobodyEverJoinedCanBeCancelled() {
    Meeting quiet = meeting("fff-ffff-fff", now);
    Meeting used = meeting("ggg-gggg-ggg", now);
    store.recordJoin(used.getId(), row("u1", "PA_1"));

    assertThat(store.markCancelled(used.getId(), now)).isFalse();
    assertThat(store.markCancelled(quiet.getId(), now)).isTrue();
    assertThat(reload(quiet).getCancelledAt()).isEqualTo(now);
    assertThat(reload(quiet).getStatus()).isEqualTo(MeetingStatus.ENDED);
    assertThat(store.markCancelled(quiet.getId(), now)).isFalse();
  }

  @Test
  void remindersAreDueInTheWindowAndClaimedOnce() {
    Meeting soon = meeting("hhh-hhhh-hhh", now);
    store.update(soon.getId(), new Update().set("scheduledStart", now.plusSeconds(300)));
    Meeting later = meeting("jjj-jjjj-jjj", now);
    store.update(later.getId(), new Update().set("scheduledStart", now.plusSeconds(3600)));

    assertThat(store.dueForReminder(now, Duration.ofMinutes(10)))
        .extracting(Meeting::getId)
        .containsExactly(soon.getId());
    assertThat(store.claimReminder(soon.getId())).isTrue();
    assertThat(store.claimReminder(soon.getId())).isFalse();
    assertThat(store.dueForReminder(now, Duration.ofMinutes(10))).isEmpty();
  }

  @Test
  void staleScheduledMeetingsExpire() {
    Meeting old = meeting("kkk-kkkk-kkk", now.minus(Duration.ofHours(49)));
    Meeting fresh = meeting("mmm-mmmm-mmm", now.minus(Duration.ofHours(1)));

    assertThat(store.expireStale(now.minus(Duration.ofHours(48)), now)).isEqualTo(1);
    assertThat(reload(old).getStatus()).isEqualTo(MeetingStatus.ENDED);
    assertThat(reload(fresh).getStatus()).isEqualTo(MeetingStatus.SCHEDULED);
  }

  @Test
  void pagesListOnlyMyMeetingsInOrderWithACursor() {
    Meeting a = meeting("nnn-nnnn-nnn", now.plusSeconds(10), "me");
    Meeting b = meeting("ppp-pppp-ppp", now.plusSeconds(20));
    store.update(b.getId(), new Update().set("departmentId", "dept-a"));
    Meeting c = meeting("qqq-qqqq-qqq", now.plusSeconds(30));
    store.update(c.getId(), new Update().set("coHostIds", List.of("me")));
    meeting("rrr-rrrr-rrr", now.plusSeconds(40), "someone-else");
    Meeting ended = meeting("sss-ssss-sss", now.plusSeconds(5), "me");
    store.markEnded(ended.getId(), now);

    List<Meeting> first = store.page("me", List.of("dept-a"), true, null, 2);
    assertThat(first).extracting(Meeting::getId).containsExactly(a.getId(), b.getId());
    List<Meeting> second = store.page("me", List.of("dept-a"), true, first.get(1), 2);
    assertThat(second).extracting(Meeting::getId).containsExactly(c.getId());

    assertThat(store.page("me", List.of(), false, null, 10))
        .extracting(Meeting::getId)
        .containsExactly(ended.getId());
    assertThat(store.page("me", List.of(), true, null, 10))
        .extracting(Meeting::getId)
        .containsExactly(a.getId(), c.getId()); // no department ⇒ b is not mine
  }
}
```

- [ ] **Step 2: RED** — `MVN test -Dtest=MeetingStoreTest` ⇒ compile error.
- [ ] **Step 3: Hiện thực** theo bảng Interfaces. `Update.filterArray(Criteria.where("open.leftAt").is(null))` cho `attendance.$[open].leftAt`. `FindAndModifyOptions.options().returnNew(...)`.
- [ ] **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingStoreTest,MeetingAccessTest'`
- [ ] **Step 5: Commit** `feat(meetings): atomic meeting store`

---

### Task 8: `LiveKitRoomClient.createRoom`

**Files:**
- Modify: `M/service/rtc/LiveKitRoomClient.java` — `public void createRoom(String room, int emptyTimeoutSeconds, int departureTimeoutSeconds, int maxParticipants)` ⇒ Twirp `CreateRoom`, body `{"name", "empty_timeout", "departure_timeout", "max_participants"}` (snake_case như `track_sid` sẵn có). LiveKit trả room có sẵn nếu đã tồn tại ⇒ gọi lại vô hại.
- Test: `T/service/rtc/LiveKitRoomClientTest.java` — thêm 1 test (dùng `sentRequest()` / `bodyOf()` sẵn có)

- [ ] **Step 1: Test**

```java
  @Test
  void createRoomSetsTheTimeoutsAndTheParticipantCap() throws Exception {
    client.createRoom("meet_1", 300, 300, 25);

    HttpRequest request = sentRequest();
    assertThat(request.uri().getPath()).isEqualTo("/twirp/livekit.RoomService/CreateRoom");
    assertThat(new ObjectMapper().readValue(bodyOf(request), Map.class))
        .isEqualTo(
            Map.of(
                "name", "meet_1",
                "empty_timeout", 300,
                "departure_timeout", 300,
                "max_participants", 25));
  }
```

- [ ] **Step 2: RED** · **Step 3: Hiện thực** (body `LinkedHashMap`, `call("CreateRoom", room, body)`) · **Step 4: GREEN** `MVN spotless:apply && MVN test -Dtest=LiveKitRoomClientTest`
- [ ] **Step 5: Commit** `feat(rtc): CreateRoom with departure timeout`

---

### Task 9: Thành phần phụ trợ — DTO, `MeetingPeople`, `MeetingLobby`, `MeetingEvents`, FCM

**Files:**
- Create `M/dto/meeting/` (record trừ khi ghi khác; mọi type `@JsonInclude(NON_NULL)`):
  - `PersonDto(String userId, String displayName, String avatarUrl)`
  - `MeetingSettingsDto(Boolean waitingRoom, Boolean muteOnEntry, Boolean allowAttendeeScreenShare, Boolean attendeesCanEditNotes, Boolean locked)` + `static MeetingSettingsDto of(Meeting.Settings s)` (đủ 5 field) — `Boolean` để request partial được
  - `AttendanceDto(String userId, String displayName, String role, Instant joinedAt, Instant leftAt)`
  - `LobbyEntryDto(String userId, String displayName)`
  - `MeetingEventDto` — class `@Data @Builder @NoArgsConstructor @AllArgsConstructor`: `event, meetingId, code, title, hostId, hostName, scheduledStart, List<AttendanceDto> participants, List<LobbyEntryDto> waiting, MeetingSettingsDto settings`
  - `CreateMeetingRequest(String title, String description, List<String> inviteeIds, String departmentId, Instant scheduledStart, Instant scheduledEnd, MeetingSettingsDto settings)`
  - `UpdateMeetingRequest` — cùng 7 field
  - `MeetingResponse(String id, String code, String title, String description, PersonDto host, List<PersonDto> coHosts, List<PersonDto> invitees, String departmentId, Instant scheduledStart, Instant scheduledEnd, String status, MeetingSettingsDto settings, List<AttendanceDto> attendance, List<String> removedIds, String viewerRole, Instant createdAt, Instant startedAt, Instant endedAt, Instant cancelledAt)`
  - `MeetingJoinResponse(String status, String url, String token, String role)` + `static joined(url, token, role)`, `static waiting()`
- Create: `M/service/meeting/MeetingPeople.java`
- Create: `M/service/meeting/MeetingLobby.java`
- Create: `M/service/meeting/MeetingEvents.java`
- Modify: `M/service/FcmService.java` — `public void sendMeetingPush(String userId, String type, String meetingId, String code, String title, boolean onlyWhenOffline)`
- Modify: `M/exception/ErrorCodes.java` — hằng + javadoc cho 11 mã meeting: `MEETING_NOT_FOUND, MEETING_FORBIDDEN, MEETING_CREATE_FORBIDDEN, MEETING_DEPARTMENT_FORBIDDEN, MEETING_INVALID, MEETING_REMOVED, MEETING_LOCKED, MEETING_ENDED, MEETING_FULL, MEETING_NOT_CANCELLABLE, MEETINGS_UNAVAILABLE`
- Test: `T/service/meeting/MeetingLobbyTest.java`, `T/service/meeting/MeetingEventsTest.java`, `T/service/meeting/MeetingPeopleTest.java`

**Interfaces — Produces:**
- `MeetingPeople(MongoTemplate mongo)`: `Map<String, PersonDto> profiles(Collection<String> userIds)` — **một** query `users` theo `_id $in` (chỉ id `ObjectId.isValid`), `fields().include("displayName","avatarUrl")`; user không có ⇒ không có trong map (fallback `PersonDto(userId, null, null)` nằm ở `MeetingMapper.person`, Task 10 — không bao giờ dùng id làm tên). `List<String> departmentMembers(String departmentId)` — `{departmentIds: ObjectId(dept), status: {$ne: "blocked"}}`, chỉ `_id`; dept không hợp lệ ⇒ rỗng. `Set<String> existingUserIds(Collection<String>)` — lọc invitee không tồn tại.
- `MeetingLobby(StringRedisTemplate redis)`: hằng `TTL = Duration.ofHours(24)`, key `meet:lobby:{id}` (hash userId → displayName, `""` khi không có tên), `meet:admitted:{id}` (set), `meet:hands:{id}` (MT3 dùng; `clear` xoá luôn). Methods: `void add(meetingId, userId, displayName)` (HSET + expire), `boolean remove(meetingId, userId)` (HDEL == 1), `boolean isWaiting(meetingId, userId)`, `List<LobbyEntryDto> waiting(meetingId)` (sắp theo tên không phân biệt hoa thường, tên rỗng ⇒ `displayName=null` và ở cuối), `void admit(meetingId, userId)` (SADD + expire), `boolean isAdmitted(meetingId, userId)`, `void clear(meetingId)` (DEL 3 key).
- `MeetingEvents(ClusterMessageBroker broker, FcmService fcm)`: hằng `TOPIC_PREFIX = "/topic/meeting/"`, `USER_QUEUE = "/queue/meeting"`. Methods:
  - `roster(Meeting m)` ⇒ topic, `meet.roster`, participants = dòng `attendance` có `leftAt == null`, mỗi userId một dòng (dòng mở mới nhất)
  - `settings(Meeting m)` ⇒ topic, `meet.settings`
  - `ended(String meetingId, Collection<String> lobbyUserIds)` ⇒ topic `meet.ended` + `meet.ended` tới từng người chờ
  - `lobby(Meeting m, List<LobbyEntryDto> waiting)` ⇒ `meet.lobby` tới host + mỗi co-host; `lobbyTo(String userId, String meetingId, List<LobbyEntryDto> waiting)` ⇒ chỉ một người (host vừa `join`)
  - `admitted(meetingId, userId)`, `denied(meetingId, userId)`, `cancelled(meetingId, Collection<String> userIds)`
  - `invited(Meeting m, String hostName, Collection<String> userIds)` ⇒ STOMP `meet.invited` + `fcm.sendMeetingPush(u, "MEETING_INVITED", id, code, title, true)`
  - `starting(Meeting m, Collection<String> userIds)` ⇒ STOMP `meet.starting` + `fcm.sendMeetingPush(u, "MEETING_STARTING", id, code, title, false)`
  - Lỗi FCM của một người chỉ log, không chặn người khác.
- `FcmService.sendMeetingPush`: Firebase chưa cấu hình ⇒ no-op; `onlyWhenOffline` ⇒ bỏ qua khi `user:status:{id}` = `online` (như `sendPushNotification`); data `{type, meetingId, code}`; `Notification` chỉ có `title` (khi có) — không đặt body chữ; `AndroidNotification.builder().setChannelId("pon_meetings").setBodyLocalizationKey(type == MEETING_INVITED ? "meeting_push_invited" : "meeting_push_starting")`; APNs `ApsAlert.builder().setLocalizationKey(<cùng key>)`; dùng lại `dispatch(...)` (dọn token chết).

- [ ] **Step 1: Test** — `MeetingLobbyTest`

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

class MeetingLobbyTest {

  private StringRedisTemplate redis;
  private HashOperations<String, Object, Object> hashes;
  private SetOperations<String, String> sets;
  private MeetingLobby lobby;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    redis = mock(StringRedisTemplate.class);
    hashes = mock(HashOperations.class);
    sets = mock(SetOperations.class);
    when(redis.opsForHash()).thenReturn(hashes);
    when(redis.opsForSet()).thenReturn(sets);
    lobby = new MeetingLobby(redis);
  }

  @Test
  void addKeepsTheNameAndExpiresWithTheMeetingDay() {
    lobby.add("m1", "u1", "Hoa");
    lobby.add("m1", "u2", null);

    verify(hashes).put("meet:lobby:m1", "u1", "Hoa");
    verify(hashes).put("meet:lobby:m1", "u2", "");
    verify(redis, org.mockito.Mockito.times(2)).expire("meet:lobby:m1", Duration.ofHours(24));
  }

  @Test
  void removeTellsWhetherTheyWereWaiting() {
    when(hashes.delete("meet:lobby:m1", "u1")).thenReturn(1L);
    when(hashes.delete("meet:lobby:m1", "u2")).thenReturn(0L);

    assertThat(lobby.remove("m1", "u1")).isTrue();
    assertThat(lobby.remove("m1", "u2")).isFalse();
  }

  @Test
  void waitingIsSortedByNameWithNamelessPeopleLastAndNeverNamedByTheirId() {
    Map<Object, Object> raw = new LinkedHashMap<>();
    raw.put("u3", "");
    raw.put("u1", "minh");
    raw.put("u2", "Anh");
    when(hashes.entries("meet:lobby:m1")).thenReturn(raw);

    assertThat(lobby.waiting("m1"))
        .containsExactly(
            new LobbyEntryDto("u2", "Anh"),
            new LobbyEntryDto("u1", "minh"),
            new LobbyEntryDto("u3", null));
  }

  @Test
  void admittedPeopleAreRemembered() {
    lobby.admit("m1", "u1");
    verify(sets).add("meet:admitted:m1", "u1");
    verify(redis).expire("meet:admitted:m1", Duration.ofHours(24));

    when(sets.isMember("meet:admitted:m1", "u1")).thenReturn(true);
    assertThat(lobby.isAdmitted("m1", "u1")).isTrue();
    assertThat(lobby.isAdmitted("m1", "u2")).isFalse();
  }

  @Test
  void clearDropsEverythingTheMeetingKeptInRedis() {
    lobby.clear("m1");
    verify(redis).delete(List.of("meet:lobby:m1", "meet:admitted:m1", "meet:hands:m1"));
  }
}
```

`MeetingEventsTest`

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import com.platform.chatservice.dto.meeting.MeetingEventDto;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.FcmService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class MeetingEventsTest {

  private ClusterMessageBroker broker;
  private FcmService fcm;
  private MeetingEvents events;
  private Meeting m;

  @BeforeEach
  void setUp() {
    broker = mock(ClusterMessageBroker.class);
    fcm = mock(FcmService.class);
    events = new MeetingEvents(broker, fcm);
    m =
        Meeting.builder()
            .id("m1")
            .code("abc-defg-hjk")
            .title("Sync")
            .hostId("host")
            .coHostIds(new ArrayList<>(List.of("co")))
            .scheduledStart(Instant.parse("2026-10-08T02:00:00Z"))
            .build();
  }

  private MeetingEventDto toTopic() {
    ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
    verify(broker).convertAndSend(eq("/topic/meeting/m1"), captor.capture());
    return (MeetingEventDto) captor.getValue();
  }

  private List<MeetingEventDto> toUser(String userId) {
    ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
    verify(broker, org.mockito.Mockito.atLeast(0))
        .convertAndSendToUser(eq(userId), eq("/queue/meeting"), captor.capture());
    return captor.getAllValues().stream().map(MeetingEventDto.class::cast).toList();
  }

  private static Meeting.Attendance row(String userId, String name, Instant joined, Instant left) {
    return Meeting.Attendance.builder()
        .userId(userId)
        .displayName(name)
        .role("attendee")
        .joinedAt(joined)
        .leftAt(left)
        .build();
  }

  @Test
  void rosterListsOnlyPeopleStillInTheRoomOncePerPerson() {
    Instant t = Instant.parse("2026-10-08T02:00:00Z");
    m.getAttendance().add(row("a", "An", t, t.plusSeconds(60)));
    m.getAttendance().add(row("a", "An", t.plusSeconds(120), null));
    m.getAttendance().add(row("b", null, t, null));
    m.getAttendance().add(row("c", "Chi", t, t.plusSeconds(5)));

    events.roster(m);

    MeetingEventDto e = toTopic();
    assertThat(e.getEvent()).isEqualTo("meet.roster");
    assertThat(e.getMeetingId()).isEqualTo("m1");
    assertThat(e.getParticipants())
        .extracting(p -> p.userId() + "@" + p.joinedAt())
        .containsExactlyInAnyOrder("a@" + t.plusSeconds(120), "b@" + t);
  }

  @Test
  void lobbyGoesToTheHostAndEveryCoHostOnly() {
    events.lobby(m, List.of(new LobbyEntryDto("w1", "Wen")));

    assertThat(toUser("host")).singleElement().satisfies(e -> {
      assertThat(e.getEvent()).isEqualTo("meet.lobby");
      assertThat(e.getWaiting()).containsExactly(new LobbyEntryDto("w1", "Wen"));
    });
    assertThat(toUser("co")).hasSize(1);
    assertThat(toUser("w1")).isEmpty();
  }

  @Test
  void endedReachesTheRoomAndThePeopleStillWaiting() {
    events.ended("m1", List.of("w1"));

    assertThat(toTopic().getEvent()).isEqualTo("meet.ended");
    assertThat(toUser("w1")).singleElement().satisfies(e -> {
      assertThat(e.getEvent()).isEqualTo("meet.ended");
      assertThat(e.getMeetingId()).isEqualTo("m1");
    });
  }

  @Test
  void invitesArePushedOnlyToOfflineDevicesAndRemindersAlways() {
    events.invited(m, "Lan", List.of("u1"));
    events.starting(m, List.of("u1"));

    assertThat(toUser("u1"))
        .extracting(MeetingEventDto::getEvent)
        .containsExactly("meet.invited", "meet.starting");
    assertThat(toUser("u1").get(0).getHostName()).isEqualTo("Lan");
    assertThat(toUser("u1").get(0).getCode()).isEqualTo("abc-defg-hjk");
    verify(fcm).sendMeetingPush("u1", "MEETING_INVITED", "m1", "abc-defg-hjk", "Sync", true);
    verify(fcm).sendMeetingPush("u1", "MEETING_STARTING", "m1", "abc-defg-hjk", "Sync", false);
  }

  @Test
  void oneFailingPushDoesNotStopTheOthers() {
    doThrow(new RuntimeException("boom"))
        .when(fcm)
        .sendMeetingPush(eq("u1"), anyString(), anyString(), anyString(), anyString(), eq(false));

    events.starting(m, List.of("u1", "u2"));

    verify(fcm).sendMeetingPush("u2", "MEETING_STARTING", "m1", "abc-defg-hjk", "Sync", false);
    assertThat(toUser("u2")).hasSize(1);
  }

  @Test
  void noPayloadEverCarriesTheLiveKitRoomName() {
    events.roster(m);
    assertThat(toTopic().toString()).doesNotContain("meet_m1");
    verify(fcm, never())
        .sendMeetingPush(anyString(), anyString(), anyString(), anyString(), anyString(), eq(true));
  }
}
```

`MeetingPeopleTest` (Mockito `MongoTemplate`, `ArgumentCaptor<Query>`): (1) `profiles` chạy **một** `find(..., Document.class, "users")`, bỏ id không hợp lệ, user không có thì vắng trong map, `displayName` không bao giờ bằng userId; (2) `existingUserIds` trả đúng tập có trong `users`; (3) `departmentMembers("not-an-id")` ⇒ rỗng, không query; (4) `departmentMembers(validHex)` ⇒ query có `departmentIds` = `ObjectId` và `status $ne blocked`.

- [ ] **Step 2: RED** — `MVN test -Dtest='MeetingLobbyTest,MeetingEventsTest,MeetingPeopleTest'`
- [ ] **Step 3: Hiện thực** như Interfaces.
- [ ] **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingLobbyTest,MeetingEventsTest,MeetingPeopleTest,FcmServiceTokenCleanupTest'`
- [ ] **Step 5: Commit** `feat(meetings): lobby, people lookup, events and push`

---

### Task 10: `MeetingService` — tạo, xem, danh sách, sửa, huỷ

**Files:**
- Create: `M/service/meeting/MeetingRequests.java` — kiểm/chuẩn hoá input (static, package-private), ném `ApiException(BAD_REQUEST, MEETING_INVALID, null, Map.of("field", f[, "max", n]))`:
  `String title(String)` (trim, rỗng ⇒ null, > 120 ⇒ `max:120`), `String description(String)` (> 2000 ⇒ `max:2000`), `List<String> invitees(List<String> raw, String hostId)` (bỏ null/trùng/host giữ thứ tự; id không `ObjectId.isValid` ⇒ `field:inviteeIds`; > 100 ⇒ `max:100`), `void schedule(Instant start, Instant end, Instant now)` (luật ở Contract), `Meeting.Settings settings(MeetingSettingsDto patch, Meeting.Settings base)` (copy base, ghi đè field khác null), `void department(UserPrincipal caller, String departmentId)` (403 `MEETING_DEPARTMENT_FORBIDDEN` trừ khi `inDepartment` hoặc `hasPermission("MANAGE_DEPARTMENTS")`)
- Create: `M/service/meeting/MeetingMapper.java` — `@Component`, `MeetingMapper(MeetingPeople people)`; `MeetingResponse toResponse(Meeting m, String viewerRole)` (một lần `people.profiles(host + coHosts + invitees)`; lọc field theo `viewerRole` như Contract); `static PersonDto person(String userId, Map<String, PersonDto> profiles)`; `static List<String> recipients(Meeting m, List<String> departmentMembers)` (host + co-host + invitee + thành viên phòng ban − `removedIds`, không trùng, giữ thứ tự)
- Create: `M/service/meeting/MeetingService.java`
- Test: `T/service/meeting/MeetingServiceTest.java`

**Interfaces — Produces** (`@Service @RequiredArgsConstructor MeetingService(MeetingStore store, MeetingCodeGenerator codes, MeetingPeople people, MeetingEvents events, MeetingMapper mapper)`):
- `MeetingResponse create(UserPrincipal caller, CreateMeetingRequest req)` — thứ tự: capability (403 `MEETING_CREATE_FORBIDDEN`) → validate → `department` → `people.existingUserIds` (giữ thứ tự) → build (`status=SCHEDULED`, `createdAt=now`, `sortAt = scheduledStart ?? now`, `attendance=[]`) → `insert` với code mới, **tối đa 5 lần** khi `DuplicateKeyException` (lần 6 ném `IllegalStateException` ⇒ 500) → `events.invited(saved, hostName, invitees)` khi có invitee → `toResponse(saved, "host")`.
- `MeetingResponse get(UserPrincipal caller, String id)`, `MeetingResponse getByCode(UserPrincipal caller, String rawCode)` (`MeetingCodeGenerator.normalize`; `null` ⇒ 404 không chạm DB) — 404 `MEETING_NOT_FOUND`; `viewerRole = MeetingAccess.viewerRole(m, caller.getUserId(), caller.getDepts())`.
- `PageResponse<MeetingResponse> list(UserPrincipal caller, String scope, String cursor, int size)` — scope `null`/`upcoming`/`past`, khác ⇒ 400 `{field:"scope"}`; `limit = PageLimits.size(size, 20)`; cursor id không tìm thấy ⇒ trang rỗng; over-fetch `limit + 1` ⇒ `new PageResponse<>(content, 0, limit, hasMore ? limit + 1 : content.size())`.
- `MeetingResponse update(UserPrincipal caller, String id, UpdateMeetingRequest req)` — 404 → không `canManage` 403 `MEETING_FORBIDDEN` → ENDED 409 `MEETING_ENDED` → validate → dựng `Update` chỉ với field có trong request (`scheduledStart` ⇒ thêm `sortAt` + `reminded=false`; đổi lịch khi `LIVE` ⇒ 400 `{field:"scheduledStart"}`) → `store.update` rỗng ⇒ 409 `MEETING_ENDED` → `events.settings` nếu settings đổi → `events.invited` cho invitee **mới** → `toResponse(updated, viewerRole)`.
- `void cancel(UserPrincipal caller, String id)` — 404 → không phải **host** 403 `MEETING_FORBIDDEN` → `store.markCancelled` false ⇒ 409 `MEETING_NOT_CANCELLABLE` → `events.cancelled(id, recipients − caller)`.

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.PageResponse;
import com.platform.chatservice.dto.meeting.CreateMeetingRequest;
import com.platform.chatservice.dto.meeting.MeetingResponse;
import com.platform.chatservice.dto.meeting.MeetingSettingsDto;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.dto.meeting.UpdateMeetingRequest;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.stream.IntStream;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingServiceTest {

  private static final String U1 = "64b000000000000000000011";
  private static final String U2 = "64b000000000000000000012";

  @Mock private MeetingStore store;
  @Mock private MeetingPeople people;
  @Mock private MeetingEvents events;
  private MeetingService service;

  private final UserPrincipal host =
      new UserPrincipal("host", "Member", List.of("HOST_MEETING"), List.of("dept-a"));
  private final UserPrincipal stranger = new UserPrincipal("stranger");

  @BeforeEach
  void setUp() {
    service =
        new MeetingService(
            store, new MeetingCodeGenerator(new Random(1)), people, events, new MeetingMapper(people));
    when(store.insert(any()))
        .thenAnswer(
            inv -> {
              Meeting m = inv.getArgument(0);
              m.setId("m1");
              return m;
            });
    when(people.existingUserIds(anyCollection()))
        .thenAnswer(inv -> new HashSet<>(inv.<Collection<String>>getArgument(0)));
    when(people.profiles(anyCollection()))
        .thenReturn(Map.of("host", new PersonDto("host", "Lan", null)));
  }

  private static CreateMeetingRequest create(
      String title, List<String> invitees, Instant start, Instant end) {
    return new CreateMeetingRequest(title, null, invitees, null, start, end, null);
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  private Meeting inserted() {
    ArgumentCaptor<Meeting> captor = ArgumentCaptor.forClass(Meeting.class);
    verify(store).insert(captor.capture());
    return captor.getValue();
  }

  // ---- create

  @Test
  void creatingNeedsTheHostMeetingCapability() {
    UserPrincipal noCap = new UserPrincipal("u", "Member", List.of(), List.of());
    ApiException e = apiError(() -> service.create(noCap, create("x", null, null, null)));
    assertThat(e.status()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(e.code()).isEqualTo("MEETING_CREATE_FORBIDDEN");
    verify(store, never()).insert(any());
  }

  @Test
  void anInstantMeetingIsScheduledWithDefaultsAndSortsByCreation() {
    MeetingResponse r = service.create(host, create("  Sync  ", null, null, null));

    Meeting m = inserted();
    assertThat(m.getHostId()).isEqualTo("host");
    assertThat(m.getTitle()).isEqualTo("Sync");
    assertThat(m.getStatus()).isEqualTo(MeetingStatus.SCHEDULED);
    assertThat(m.getScheduledStart()).isNull();
    assertThat(m.getSortAt()).isEqualTo(m.getCreatedAt()).isNotNull();
    assertThat(m.getCode()).matches("[a-z]{3}-[a-z]{4}-[a-z]{3}");
    assertThat(m.getSettings().isWaitingRoom()).isTrue();
    assertThat(m.getAttendance()).isEmpty();
    assertThat(r.viewerRole()).isEqualTo("host");
    assertThat(r.host()).isEqualTo(new PersonDto("host", "Lan", null));
    verify(events, never()).invited(any(), any(), anyCollection());
  }

  @Test
  void aBlankTitleIsStoredAsNoTitleNotAServerMadeString() {
    service.create(host, create("   ", null, null, null));
    assertThat(inserted().getTitle()).isNull();
  }

  @Test
  void aScheduledMeetingSortsByItsStart() {
    Instant start = Instant.now().plus(Duration.ofDays(1));
    service.create(host, create("Plan", null, start, start.plus(Duration.ofHours(1))));
    assertThat(inserted().getSortAt()).isEqualTo(start);
  }

  @Test
  void inviteesAreDedupedTheHostDroppedUnknownsDroppedAndInvited() {
    when(people.existingUserIds(anyCollection())).thenReturn(new HashSet<>(List.of(U1)));

    service.create(host, create("Sync", List.of(U1, U1, "host", U2), null, null));

    Meeting m = inserted();
    assertThat(m.getInviteeIds()).containsExactly(U1);
    verify(events).invited(m, "Lan", List.of(U1));
  }

  @Test
  void settingsArePartial() {
    service.create(
        host,
        new CreateMeetingRequest(
            "x", null, null, null, null, null,
            new MeetingSettingsDto(false, null, null, null, true)));
    Meeting.Settings s = inserted().getSettings();
    assertThat(s.isWaitingRoom()).isFalse();
    assertThat(s.isLocked()).isTrue();
    assertThat(s.isAllowAttendeeScreenShare()).isTrue();
  }

  @Test
  void invalidInputNamesTheField() {
    Instant start = Instant.now().plus(Duration.ofHours(2));
    List<String> tooMany =
        IntStream.range(0, 101).mapToObj(i -> String.format("64b0000000000000000%05d", i)).toList();
    Object[][] cases = {
      {create("x".repeat(121), null, null, null), "title", 120},
      {new CreateMeetingRequest("x", "d".repeat(2001), null, null, null, null, null),
          "description", 2000},
      {create("x", tooMany, null, null), "inviteeIds", 100},
      {create("x", List.of("not-an-id"), null, null), "inviteeIds", null},
      {create("x", null, null, start), "scheduledEnd", null},
      {create("x", null, start, start.minusSeconds(60)), "scheduledEnd", null},
      {create("x", null, start, start.plus(Duration.ofHours(25))), "scheduledEnd", null},
      {create("x", null, Instant.now().minus(Duration.ofHours(1)), null), "scheduledStart", null},
    };
    for (Object[] c : cases) {
      ApiException e = apiError(() -> service.create(host, (CreateMeetingRequest) c[0]));
      assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST);
      assertThat(e.code()).isEqualTo("MEETING_INVALID");
      assertThat(e.getParams()).containsEntry("field", c[1]);
      if (c[2] != null) {
        assertThat(e.getParams()).containsEntry("max", c[2]);
      }
    }
    verify(store, never()).insert(any());
  }

  @Test
  void aDepartmentMeetingNeedsMembershipOrDepartmentManagement() {
    CreateMeetingRequest forB = new CreateMeetingRequest("x", null, null, "dept-b", null, null, null);
    assertThat(apiError(() -> service.create(host, forB)).code())
        .isEqualTo("MEETING_DEPARTMENT_FORBIDDEN");

    UserPrincipal manager =
        new UserPrincipal("mgr", "Admin", List.of("HOST_MEETING", "MANAGE_DEPARTMENTS"), List.of());
    service.create(manager, forB);
    assertThat(inserted().getDepartmentId()).isEqualTo("dept-b");
  }

  @Test
  void aCodeCollisionIsRetriedWithAFreshCode() {
    when(store.insert(any()))
        .thenThrow(new DuplicateKeyException("dup"))
        .thenAnswer(inv -> inv.getArgument(0));

    service.create(host, create("x", null, null, null));

    ArgumentCaptor<Meeting> captor = ArgumentCaptor.forClass(Meeting.class);
    verify(store, times(2)).insert(captor.capture());
    // the builder object is reused or rebuilt — either way the second attempt has its own code
    assertThat(captor.getAllValues().get(1).getCode()).matches("[a-z]{3}-[a-z]{4}-[a-z]{3}");
  }

  // ---- read

  private Meeting stored() {
    Meeting m =
        Meeting.builder()
            .id("m1")
            .code("abc-defg-hjk")
            .hostId("host")
            .inviteeIds(new ArrayList<>(List.of(U1)))
            .removedIds(new ArrayList<>(List.of(U2)))
            .attendance(
                new ArrayList<>(
                    List.of(Meeting.Attendance.builder().userId("host").role("host").build())))
            .build();
    when(store.findById("m1")).thenReturn(Optional.of(m));
    when(store.findByCode("abc-defg-hjk")).thenReturn(Optional.of(m));
    return m;
  }

  @Test
  void aGuestSeesOnlyWhatTheLinkPageNeeds() {
    stored();
    MeetingResponse r = service.get(stranger, "m1");

    assertThat(r.viewerRole()).isEqualTo("guest");
    assertThat(r.code()).isEqualTo("abc-defg-hjk");
    assertThat(r.host().userId()).isEqualTo("host");
    assertThat(r.invitees()).isNull();
    assertThat(r.attendance()).isNull();
    assertThat(r.removedIds()).isNull();
  }

  @Test
  void theHostSeesEverythingAndNamesAreNeverIds() {
    stored();
    MeetingResponse r = service.get(host, "m1");

    assertThat(r.viewerRole()).isEqualTo("host");
    assertThat(r.removedIds()).containsExactly(U2);
    assertThat(r.invitees()).containsExactly(new PersonDto(U1, null, null));
    assertThat(r.attendance()).hasSize(1);
  }

  @Test
  void codesAreNormalisedAndJunkNeverHitsTheDatabase() {
    stored();
    assertThat(service.getByCode(stranger, "ABCDEFGHJK").id()).isEqualTo("m1");

    assertThat(apiError(() -> service.getByCode(stranger, "../etc")).status())
        .isEqualTo(HttpStatus.NOT_FOUND);
    verify(store, never()).findByCode("../etc");
    assertThat(apiError(() -> service.get(stranger, "nope")).code())
        .isEqualTo("MEETING_NOT_FOUND");
  }

  @Test
  void listOverFetchesOneRowToKnowIfThereIsMore() {
    Meeting a = Meeting.builder().id("a").hostId("me").build();
    Meeting b = Meeting.builder().id("b").hostId("me").build();
    Meeting c = Meeting.builder().id("c").hostId("me").build();
    UserPrincipal me = new UserPrincipal("me", "Member", List.of(), List.of("dept-a"));
    when(store.page(eq("me"), eq(List.of("dept-a")), eq(true), isNull(), eq(3)))
        .thenReturn(List.of(a, b, c));

    PageResponse<MeetingResponse> page = service.list(me, "upcoming", null, 2);

    assertThat(page.content()).extracting(MeetingResponse::id).containsExactly("a", "b");
    assertThat(page.hasNext()).isTrue();
    assertThat(apiError(() -> service.list(me, "someday", null, 2)).getParams())
        .containsEntry("field", "scope");
    when(store.findById("gone")).thenReturn(Optional.empty());
    assertThat(service.list(me, "past", "gone", 2).content()).isEmpty();
  }

  // ---- update / cancel

  @Test
  void onlyHostAndCoHostsEditAndEndedMeetingsAreFrozen() {
    Meeting m = stored();
    UpdateMeetingRequest rename = new UpdateMeetingRequest("New", null, null, null, null, null, null);

    assertThat(apiError(() -> service.update(stranger, "m1", rename)).code())
        .isEqualTo("MEETING_FORBIDDEN");
    m.setStatus(MeetingStatus.ENDED);
    assertThat(apiError(() -> service.update(host, "m1", rename)).code())
        .isEqualTo("MEETING_ENDED");
  }

  @Test
  void editingWritesOnlyTheChangedFieldsAndAnnouncesWhatChanged() {
    Meeting m = stored();
    Instant start = Instant.now().plus(Duration.ofDays(2));
    Meeting after = Meeting.builder().id("m1").code("abc-defg-hjk").hostId("host")
        .inviteeIds(new ArrayList<>(List.of(U1, U2)))
        .settings(Meeting.Settings.builder().locked(true).build()).build();
    ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
    when(store.update(eq("m1"), update.capture())).thenReturn(Optional.of(after));
    when(people.existingUserIds(anyCollection())).thenReturn(new HashSet<>(List.of(U1, U2)));

    service.update(
        host,
        "m1",
        new UpdateMeetingRequest(
            null, null, List.of(U1, U2), null, start, null,
            new MeetingSettingsDto(null, null, null, null, true)));

    Document set = (Document) update.getValue().getUpdateObject().get("$set");
    assertThat(set).containsKeys("inviteeIds", "scheduledStart", "sortAt", "reminded", "settings");
    assertThat(set).doesNotContainKeys("title", "description", "attendance", "status");
    assertThat(set.get("reminded")).isEqualTo(false);
    verify(events).invited(after, "Lan", List.of(U2)); // only the newcomer
    verify(events).settings(after);
  }

  @Test
  void aLiveMeetingCannotBeRescheduled() {
    stored().setStatus(MeetingStatus.LIVE);
    UpdateMeetingRequest move =
        new UpdateMeetingRequest(
            null, null, null, null, Instant.now().plus(Duration.ofDays(1)), null, null);
    assertThat(apiError(() -> service.update(host, "m1", move)).getParams())
        .containsEntry("field", "scheduledStart");
  }

  @Test
  void onlyTheHostCancelsAndOnlyBeforeAnyoneJoined() {
    Meeting m = stored();
    m.getCoHostIds().add("co");
    UserPrincipal co = new UserPrincipal("co");
    assertThat(apiError(() -> service.cancel(co, "m1")).code()).isEqualTo("MEETING_FORBIDDEN");

    when(store.markCancelled(eq("m1"), any())).thenReturn(false);
    assertThat(apiError(() -> service.cancel(host, "m1")).code())
        .isEqualTo("MEETING_NOT_CANCELLABLE");

    when(store.markCancelled(eq("m1"), any())).thenReturn(true);
    service.cancel(host, "m1");
    verify(events).cancelled("m1", List.of("co", U1)); // removed U2 and the host left out
  }
}
```

- [ ] **Step 2: RED** — `MVN test -Dtest=MeetingServiceTest` ⇒ compile error.
- [ ] **Step 3: Hiện thực** (3 file). `MeetingService` < 300 dòng; nếu vượt, tách `update` sang `MeetingEditService`.
- [ ] **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingServiceTest,MeetingAccessTest,MeetingCodeGeneratorTest'`
- [ ] **Step 5: Commit** `feat(meetings): create, read, list, edit and cancel meetings`

---

### Task 11: `MeetingJoinService` + `MeetingCloser` — vào phòng, phòng chờ, kết thúc

**Files:**
- Create: `M/service/meeting/MeetingCloser.java`
- Create: `M/service/meeting/MeetingJoinService.java`
- Test: `T/service/meeting/MeetingCloserTest.java`, `T/service/meeting/MeetingJoinServiceTest.java`

**Interfaces — Produces:**
- `@Component MeetingCloser(MeetingStore store, MeetingLobby lobby, MeetingEvents events, CallBusyRegistry busy)` — `boolean close(String meetingId)`: `store.markEnded(id, now)`; rỗng ⇒ `false` (đã ENDED — idempotent). Ngược lại: lấy id người đang chờ (`lobby.waiting`) → `lobby.clear(id)` → `busy.clear(userId, RtcRooms.forMeeting(id))` cho mọi dòng điểm danh **đang mở** trong bản trước-khi-đổi → `events.ended(id, waitingIds)` → `true`. Dùng chung cho `POST /end` (Task 11) và `room_finished` (Task 13).
- `@Service MeetingJoinService(LiveKitProperties props, LiveKitTokenService tokens, LiveKitRoomClient rooms, MeetingStore store, MeetingLobby lobby, MeetingPeople people, MeetingEvents events, MeetingCloser closer)`; hằng `ROOM_TIMEOUT_SECONDS = 300`, `MAX_PARTICIPANTS = 25`:
  - `MeetingJoinResponse join(UserPrincipal caller, String meetingId)` — thứ tự kiểm: LiveKit chưa cấu hình ⇒ 503 `MEETINGS_UNAVAILABLE` (trước cả DB) → 404 → `MeetingAccess.decide(m, uid, caller.getDepts(), lobby.isAdmitted(id, uid))`:
    - `DENIED_ENDED` 409 `MEETING_ENDED` · `DENIED_REMOVED` 403 `MEETING_REMOVED` · `DENIED_LOCKED` 403 `MEETING_LOCKED`
    - `MUST_WAIT`: đã chờ rồi (`lobby.isWaiting`) ⇒ trả `waiting()` không phát gì; chưa ⇒ `lobby.add(id, uid, displayName)` + `events.lobby(m, lobby.waiting(id))` ⇒ `waiting()`
    - vào phòng: số userId khác nhau có dòng điểm danh mở ≥ 25 và người này không nằm trong đó ⇒ 409 `MEETING_FULL`; `lobby.remove` (nếu đúng là vừa ra khỏi phòng chờ ⇒ `events.lobby`); `rooms.createRoom(meet_{id}, 300, 300, 25)` — `LiveKitApiException`/`LiveKitUnavailableException` ⇒ 503 `MEETINGS_UNAVAILABLE`; grant `RtcGrant.participant(room)`, host/co-host `.asRoomAdmin()`, attendee khi `!allowAttendeeScreenShare` `.withSources(List.of(CAMERA, MICROPHONE))`; `tokens.participantToken(uid, displayName, {"avatarUrl"} | null, grant)`; host/co-host thêm `events.lobbyTo(uid, id, lobby.waiting(id))` (Review Focus 1) ⇒ `joined(props.getUrl(), token, MeetingAccess.roleOf(m, uid))`
  - `void leaveLobby(String userId, String meetingId)` — 404; `lobby.remove` true ⇒ `events.lobby(m, waiting)`
  - `void admit(String callerId, String meetingId, String userId)` / `deny(...)` — 404 → không `canManage` 403 `MEETING_FORBIDDEN` → ENDED 409 `MEETING_ENDED` → `lobby.remove` false ⇒ no-op; true ⇒ admit: `lobby.admit` + `events.admitted`; deny: `events.denied`; cả hai `events.lobby(m, waiting)`
  - `void end(String callerId, String meetingId)` — 404 → 403 → đã ENDED ⇒ return → `closer.close(id)` → `rooms.deleteRoom(meet_{id})` (lỗi `RuntimeException` chỉ log: room có thể đã tự đóng / LiveKit tắt)

- [ ] **Step 1: Test** — `MeetingCloserTest`

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.service.CallBusyRegistry;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MeetingCloserTest {

  @Mock private MeetingStore store;
  @Mock private MeetingLobby lobby;
  @Mock private MeetingEvents events;
  @Mock private CallBusyRegistry busy;
  @InjectMocks private MeetingCloser closer;

  @Test
  void closingFreesThePeopleStillInsideAndTellsTheLobby() {
    Instant t = Instant.now();
    Meeting before =
        Meeting.builder()
            .id("m1")
            .status(MeetingStatus.LIVE)
            .attendance(
                new ArrayList<>(
                    List.of(
                        Meeting.Attendance.builder().userId("in").joinedAt(t).build(),
                        Meeting.Attendance.builder()
                            .userId("gone")
                            .joinedAt(t)
                            .leftAt(t)
                            .build())))
            .build();
    when(store.markEnded(eq("m1"), any())).thenReturn(Optional.of(before));
    when(lobby.waiting("m1")).thenReturn(List.of(new LobbyEntryDto("w1", "Wen")));

    assertThat(closer.close("m1")).isTrue();

    verify(busy).clear("in", "meet_m1");
    verify(busy, never()).clear(eq("gone"), anyString());
    verify(lobby).clear("m1");
    verify(events).ended("m1", List.of("w1"));
  }

  @Test
  void closingTwiceDoesNothingTheSecondTime() {
    when(store.markEnded(eq("m1"), any())).thenReturn(Optional.empty());

    assertThat(closer.close("m1")).isFalse();

    verify(lobby, never()).clear(anyString());
    verify(events, never()).ended(anyString(), anyCollection());
  }
}
```

`MeetingJoinServiceTest`

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.config.LiveKitProperties;
import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import com.platform.chatservice.dto.meeting.MeetingJoinResponse;
import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.rtc.LiveKitApiException;
import com.platform.chatservice.service.rtc.LiveKitRoomClient;
import com.platform.chatservice.service.rtc.LiveKitTokenService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
class MeetingJoinServiceTest {

  @Mock private LiveKitRoomClient rooms;
  @Mock private MeetingStore store;
  @Mock private MeetingLobby lobby;
  @Mock private MeetingPeople people;
  @Mock private MeetingEvents events;
  @Mock private MeetingCloser closer;
  private LiveKitProperties props;
  private MeetingJoinService service;
  private Meeting m;

  private final UserPrincipal host = new UserPrincipal("host");
  private final UserPrincipal stranger = new UserPrincipal("stranger");
  private final UserPrincipal invitee = new UserPrincipal("inv");

  @BeforeEach
  void setUp() {
    props = new LiveKitProperties();
    props.setUrl("wss://rtc.example.com");
    props.setApiKey("APIkey1");
    props.setApiSecret("0123456789abcdef0123456789abcdef");
    service =
        new MeetingJoinService(
            props, new LiveKitTokenService(props), rooms, store, lobby, people, events, closer);
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .coHostIds(new ArrayList<>(List.of("co")))
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .build();
    when(store.findById("m1")).thenReturn(Optional.of(m));
    when(people.profiles(anyCollection()))
        .thenReturn(
            Map.of(
                "host", new PersonDto("host", "Lan", "/a.png"),
                "stranger", new PersonDto("stranger", "Sam", null)));
  }

  private static ApiException apiError(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e;
    }
    throw new AssertionError("expected ApiException");
  }

  private Claims claims(MeetingJoinResponse r) {
    return Jwts.parserBuilder()
        .setSigningKey(props.signingKey())
        .build()
        .parseClaimsJws(r.token())
        .getBody();
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> video(MeetingJoinResponse r) {
    return (Map<String, Object>) claims(r).get("video", Map.class);
  }

  @Test
  void withoutLiveKitMeetingsAreUnavailableBeforeAnyLookup() {
    props.setUrl("");
    ApiException e = apiError(() -> service.join(host, "m1"));
    assertThat(e.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    assertThat(e.code()).isEqualTo("MEETINGS_UNAVAILABLE");
    verifyNoInteractions(store);
  }

  @Test
  void refusalsMapToTheirCodes() {
    when(store.findById("gone")).thenReturn(Optional.empty());
    assertThat(apiError(() -> service.join(host, "gone")).code()).isEqualTo("MEETING_NOT_FOUND");

    m.getRemovedIds().add("stranger");
    ApiException removed = apiError(() -> service.join(stranger, "m1"));
    assertThat(removed.status()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(removed.code()).isEqualTo("MEETING_REMOVED");
    verify(lobby, never()).add(anyString(), anyString(), any());
    m.getRemovedIds().clear();

    m.getSettings().setLocked(true);
    assertThat(apiError(() -> service.join(stranger, "m1")).code()).isEqualTo("MEETING_LOCKED");
    m.getSettings().setLocked(false);

    m.setStatus(MeetingStatus.ENDED);
    ApiException ended = apiError(() -> service.join(host, "m1"));
    assertThat(ended.status()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(ended.code()).isEqualTo("MEETING_ENDED");
  }

  @Test
  void aStrangerWaitsAndTheHostsHearAboutIt() {
    List<LobbyEntryDto> waiting = List.of(new LobbyEntryDto("stranger", "Sam"));
    when(lobby.waiting("m1")).thenReturn(waiting);

    MeetingJoinResponse r = service.join(stranger, "m1");

    assertThat(r.status()).isEqualTo("waiting");
    assertThat(r.token()).isNull();
    verify(lobby).add("m1", "stranger", "Sam");
    verify(events).lobby(m, waiting);
    verify(rooms, never()).createRoom(anyString(), anyInt(), anyInt(), anyInt());
  }

  @Test
  void askingAgainWhileWaitingDoesNotPingTheHostAgain() {
    when(lobby.isWaiting("m1", "stranger")).thenReturn(true);

    assertThat(service.join(stranger, "m1").status()).isEqualTo("waiting");

    verify(lobby, never()).add(anyString(), anyString(), any());
    verify(events, never()).lobby(any(), any());
  }

  @Test
  void theHostGetsAnAdminTokenForTheMeetingRoomAndSeesWhoIsWaiting() {
    List<LobbyEntryDto> waiting = List.of(new LobbyEntryDto("stranger", "Sam"));
    when(lobby.waiting("m1")).thenReturn(waiting);

    MeetingJoinResponse r = service.join(host, "m1");

    assertThat(r.status()).isEqualTo("joined");
    assertThat(r.url()).isEqualTo("wss://rtc.example.com");
    assertThat(r.role()).isEqualTo("host");
    assertThat(claims(r).getSubject()).isEqualTo("host");
    assertThat(claims(r).get("name")).isEqualTo("Lan");
    assertThat(claims(r).get("metadata")).isEqualTo("{\"avatarUrl\":\"/a.png\"}");
    assertThat(video(r)).containsEntry("room", "meet_m1").containsEntry("roomAdmin", true);
    verify(rooms).createRoom("meet_m1", 300, 300, 25);
    verify(events).lobbyTo("host", "m1", waiting);
  }

  @Test
  void attendeesCannotShareTheirScreenWhenTheHostTurnedItOff() {
    m.getSettings().setAllowAttendeeScreenShare(false);

    MeetingJoinResponse r = service.join(invitee, "m1");

    assertThat(r.role()).isEqualTo("attendee");
    assertThat(video(r)).doesNotContainKey("roomAdmin");
    assertThat(video(r).get("canPublishSources")).isEqualTo(List.of("camera", "microphone"));
    assertThat(claims(r).containsKey("name")).isFalse(); // unknown name is left out, never the id
    verify(events, never()).lobbyTo(anyString(), anyString(), any());
  }

  @Test
  void anAdmittedPersonWalksInEvenIfTheRoomIsLockedAndLeavesTheLobby() {
    m.getSettings().setLocked(true);
    when(lobby.isAdmitted("m1", "stranger")).thenReturn(true);
    when(lobby.remove("m1", "stranger")).thenReturn(true);

    assertThat(service.join(stranger, "m1").status()).isEqualTo("joined");
    verify(events).lobby(eq(m), any());
  }

  @Test
  void theTwentySixthPersonIsTurnedAwayButSomeoneAlreadyInsideMayRejoin() {
    Instant t = Instant.now();
    for (int i = 0; i < 24; i++) {
      m.getAttendance().add(Meeting.Attendance.builder().userId("u" + i).joinedAt(t).build());
    }
    m.getAttendance().add(Meeting.Attendance.builder().userId("inv").joinedAt(t).build());

    ApiException full = apiError(() -> service.join(host, "m1"));
    assertThat(full.status()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(full.code()).isEqualTo("MEETING_FULL");
    assertThat(service.join(invitee, "m1").status()).isEqualTo("joined");
  }

  @Test
  void aLiveKitOutageWhileOpeningTheRoomIsUnavailableNotA500() {
    doThrow(new LiveKitApiException("CreateRoom", 503, null))
        .when(rooms)
        .createRoom(anyString(), anyInt(), anyInt(), anyInt());

    assertThat(apiError(() -> service.join(host, "m1")).code()).isEqualTo("MEETINGS_UNAVAILABLE");
  }

  @Test
  void admitAndDenyAreForHostsAndCoHostsAndIgnoreWhoIsNoLongerWaiting() {
    assertThat(apiError(() -> service.admit("inv", "m1", "stranger")).code())
        .isEqualTo("MEETING_FORBIDDEN");

    when(lobby.remove("m1", "stranger")).thenReturn(true);
    service.admit("co", "m1", "stranger");
    verify(lobby).admit("m1", "stranger");
    verify(events).admitted("m1", "stranger");
    verify(events).lobby(eq(m), any());

    when(lobby.remove("m1", "late")).thenReturn(false);
    service.deny("host", "m1", "late");
    verify(events, never()).denied("m1", "late");

    when(lobby.remove("m1", "pest")).thenReturn(true);
    service.deny("host", "m1", "pest");
    verify(events).denied("m1", "pest");
    verify(lobby, never()).admit("m1", "pest");
  }

  @Test
  void leavingTheLobbyUpdatesTheHosts() {
    when(lobby.remove("m1", "stranger")).thenReturn(true);
    service.leaveLobby("stranger", "m1");
    verify(events).lobby(eq(m), any());
  }

  @Test
  void endClosesTheMeetingThenDropsTheRoomAndSurvivesARoomAlreadyGone() {
    assertThat(apiError(() -> service.end("inv", "m1")).code()).isEqualTo("MEETING_FORBIDDEN");

    doThrow(new LiveKitApiException("DeleteRoom", 404, null)).when(rooms).deleteRoom("meet_m1");
    service.end("co", "m1");
    verify(closer).close("m1");
    verify(rooms).deleteRoom("meet_m1");
  }

  @Test
  void endingAnEndedMeetingIsANoOp() {
    m.setStatus(MeetingStatus.ENDED);
    service.end("host", "m1");
    verify(closer, never()).close(anyString());
    verify(rooms, never()).deleteRoom(anyString());
  }
}
```

- [ ] **Step 2: RED** — `MVN test -Dtest='MeetingCloserTest,MeetingJoinServiceTest'`
- [ ] **Step 3: Hiện thực** như Interfaces. `metadata` dựng bằng Jackson như `SfuCallService.metadata` (copy 8 dòng là chấp nhận được; nếu muốn dùng chung thì chuyển thành `public static` trong `LiveKitTokenService` — **không** đổi hành vi của calls).
- [ ] **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingCloserTest,MeetingJoinServiceTest,SfuCallServiceTokenTest'`
- [ ] **Step 5: Commit** `feat(meetings): join, waiting room, admit, deny and end`

---

### Task 12: `MeetingController` (REST mỏng)

**Files:**
- Create: `M/controller/MeetingController.java` — `@RestController @RequestMapping("/api/meetings") @RequiredArgsConstructor`, phụ thuộc `MeetingService`, `MeetingJoinService`. Mỗi method một dòng gọi service; `private static UserPrincipal caller(Principal p)` = `p instanceof UserPrincipal u ? u : new UserPrincipal(p.getName())` (prod luôn là `UserPrincipal` do `JwtAuthenticationFilter`; nhánh sau chỉ cho test/legacy và **không** có perms ⇒ không tạo được họp).

| Mapping | Gọi | Trả |
|---|---|---|
| `@PostMapping` | `meetings.create(caller, body)` | `ResponseEntity.status(CREATED)` |
| `@GetMapping` `scope`, `cursor` (optional), `size` (default 20) | `meetings.list(...)` | `PageResponse<MeetingResponse>` |
| `@GetMapping("/{id}")` | `meetings.get` | `MeetingResponse` |
| `@GetMapping("/by-code/{code}")` | `meetings.getByCode` | `MeetingResponse` |
| `@PatchMapping("/{id}")` | `meetings.update` | `MeetingResponse` |
| `@DeleteMapping("/{id}")` | `meetings.cancel` | 204 |
| `@PostMapping("/{id}/join")` | `joins.join` | `MeetingJoinResponse` |
| `@DeleteMapping("/{id}/lobby")` | `joins.leaveLobby(uid, id)` | 204 |
| `@PostMapping("/{id}/lobby/{userId}/admit")` · `/deny` | `joins.admit/deny(uid, id, userId)` | 204 |
| `@PostMapping("/{id}/end")` | `joins.end(uid, id)` | 204 |

- Test: `T/controller/MeetingControllerTest.java` (standalone MockMvc + `GlobalExceptionHandler`, như `CallRestControllerTest`)

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.platform.chatservice.config.LiveKitProperties;
import com.platform.chatservice.dto.meeting.CreateMeetingRequest;
import com.platform.chatservice.dto.meeting.MeetingJoinResponse;
import com.platform.chatservice.dto.meeting.MeetingResponse;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.exception.GlobalExceptionHandler;
import com.platform.chatservice.security.UserPrincipal;
import com.platform.chatservice.service.SfuCallService;
import com.platform.chatservice.service.meeting.MeetingJoinService;
import com.platform.chatservice.service.meeting.MeetingService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingControllerTest {

  @Mock private MeetingService meetings;
  @Mock private MeetingJoinService joins;
  private MockMvc mvc;
  private final UserPrincipal lan =
      new UserPrincipal("lan", "Member", List.of("HOST_MEETING"), List.of("dept-a"));

  @BeforeEach
  void setUp() {
    mvc =
        MockMvcBuilders.standaloneSetup(new MeetingController(meetings, joins))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  private static MeetingResponse response(String id) {
    return new MeetingResponse(
        id, "abc-defg-hjk", "Sync", null, null, null, null, null, null, null, "SCHEDULED", null,
        null, null, "host", null, null, null, null);
  }

  @Test
  void createAnswers201AndHandsTheServiceTheCallersClaims() throws Exception {
    when(meetings.create(any(), any())).thenReturn(response("m1"));

    mvc.perform(
            post("/api/meetings")
                .principal(lan)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"title\":\"Sync\",\"inviteeIds\":[\"64b000000000000000000011\"],"
                        + "\"scheduledStart\":\"2026-10-08T02:00:00Z\","
                        + "\"settings\":{\"waitingRoom\":false}}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value("m1"))
        .andExpect(jsonPath("$.viewerRole").value("host"));

    ArgumentCaptor<UserPrincipal> who = ArgumentCaptor.forClass(UserPrincipal.class);
    ArgumentCaptor<CreateMeetingRequest> body = ArgumentCaptor.forClass(CreateMeetingRequest.class);
    verify(meetings).create(who.capture(), body.capture());
    assertThat(who.getValue().hasPermission("HOST_MEETING")).isTrue();
    assertThat(who.getValue().getDepts()).containsExactly("dept-a");
    assertThat(body.getValue().inviteeIds()).containsExactly("64b000000000000000000011");
    assertThat(body.getValue().settings().waitingRoom()).isFalse();
    assertThat(body.getValue().settings().locked()).isNull();
  }

  @Test
  void byCodeAndByIdAreDifferentRoutes() throws Exception {
    when(meetings.getByCode(any(), eq("abc-defg-hjk"))).thenReturn(response("m1"));
    when(meetings.get(any(), eq("m2"))).thenReturn(response("m2"));

    mvc.perform(get("/api/meetings/by-code/abc-defg-hjk").principal(lan))
        .andExpect(jsonPath("$.id").value("m1"));
    mvc.perform(get("/api/meetings/m2").principal(lan)).andExpect(jsonPath("$.id").value("m2"));
  }

  @Test
  void listPassesScopeCursorAndSize() throws Exception {
    when(meetings.list(any(), eq("past"), eq("m9"), eq(5)))
        .thenReturn(new com.platform.chatservice.dto.PageResponse<>(List.of(), 0, 5, 0));
    mvc.perform(get("/api/meetings?scope=past&cursor=m9&size=5").principal(lan))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.hasNext").value(false));
  }

  @Test
  void joinedAndWaitingBodies() throws Exception {
    when(joins.join(any(), eq("m1")))
        .thenReturn(MeetingJoinResponse.joined("wss://rtc.example.com", "jwt", "attendee"));
    mvc.perform(post("/api/meetings/m1/join").principal(lan))
        .andExpect(jsonPath("$.status").value("joined"))
        .andExpect(jsonPath("$.url").value("wss://rtc.example.com"))
        .andExpect(jsonPath("$.token").value("jwt"))
        .andExpect(jsonPath("$.role").value("attendee"));

    when(joins.join(any(), eq("m2"))).thenReturn(MeetingJoinResponse.waiting());
    mvc.perform(post("/api/meetings/m2/join").principal(lan))
        .andExpect(jsonPath("$.status").value("waiting"))
        .andExpect(jsonPath("$.token").doesNotExist())
        .andExpect(jsonPath("$.url").doesNotExist());
  }

  @Test
  void lobbyAndEndRoutesAnswer204() throws Exception {
    mvc.perform(delete("/api/meetings/m1/lobby").principal(lan)).andExpect(status().isNoContent());
    mvc.perform(post("/api/meetings/m1/lobby/u9/admit").principal(lan))
        .andExpect(status().isNoContent());
    mvc.perform(post("/api/meetings/m1/lobby/u9/deny").principal(lan))
        .andExpect(status().isNoContent());
    mvc.perform(post("/api/meetings/m1/end").principal(lan)).andExpect(status().isNoContent());
    mvc.perform(delete("/api/meetings/m1").principal(lan)).andExpect(status().isNoContent());

    verify(joins).leaveLobby("lan", "m1");
    verify(joins).admit("lan", "m1", "u9");
    verify(joins).deny("lan", "m1", "u9");
    verify(joins).end("lan", "m1");
  }

  @Test
  void errorsCarryACodeAndParamsButNoInternalMessage() throws Exception {
    when(meetings.create(any(), any()))
        .thenThrow(
            new ApiException(
                HttpStatus.BAD_REQUEST, "MEETING_INVALID", null, Map.of("field", "title", "max", 120)));
    mvc.perform(
            post("/api/meetings")
                .principal(lan)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"x\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MEETING_INVALID"))
        .andExpect(jsonPath("$.params.field").value("title"))
        .andExpect(jsonPath("$.params.max").value(120))
        .andExpect(jsonPath("$.message").doesNotExist());

    when(joins.join(any(), eq("m1")))
        .thenThrow(new ApiException(HttpStatus.FORBIDDEN, "MEETING_REMOVED"));
    mvc.perform(post("/api/meetings/m1/join").principal(lan))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("MEETING_REMOVED"))
        .andExpect(jsonPath("$.statusCode").value(403));
  }

  @Test
  void meetingRoutesDoNotCollideWithCallRoutes() {
    assertThatCode(
            () ->
                MockMvcBuilders.standaloneSetup(
                        new MeetingController(meetings, joins),
                        new CallRestController(
                            org.mockito.Mockito.mock(SfuCallService.class),
                            new LiveKitProperties()))
                    .build())
        .doesNotThrowAnyException();
  }
}
```

- [ ] **Step 2: RED** · **Step 3: Hiện thực** · **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingControllerTest,AssistantMappingUniquenessTest,CallRestControllerTest'`
- [ ] **Step 5: Commit** `feat(meetings): REST endpoints`

---

### Task 13: `MeetingRtcHandler` — điểm danh và trạng thái phòng từ webhook

**Files:**
- Create: `M/service/meeting/MeetingRtcHandler.java` — `@Service @RequiredArgsConstructor implements RtcRoomEventHandler`; `RtcWebhookDispatcher` tự nhặt qua `ObjectProvider<RtcRoomEventHandler>`, **không** sửa dispatcher/controller webhook.
- Test: `T/service/meeting/MeetingRtcHandlerTest.java`

**Interfaces — Consumes:** `MeetingStore`, `MeetingEvents`, `CallBusyRegistry`, `MeetingCloser`, `MeetingPeople`, `RtcRooms.MEETING_PREFIX` / `idOf`.

Hành vi:
- `supports(room)` = `room.startsWith(RtcRooms.MEETING_PREFIX)`.
- `onParticipantJoined(e)`: id = `RtcRooms.idOf(e.room(), MEETING_PREFIX)`; `null` / không có / ENDED ⇒ bỏ qua. `at = e.createdAt() ?? now`. `SCHEDULED` ⇒ `store.markLive(id, at)`. `store.recordJoin(id, Attendance{userId=identity, displayName (people.profiles, có thể null), role=MeetingAccess.roleOf(m, identity), sid=e.participantSid(), joinedAt=at})`. `busy.markBusy(identity, e.room())`. Đọc lại ⇒ `events.roster(reloaded)`.
- `onParticipantLeft(e)`: không có / ENDED ⇒ bỏ qua. `store.recordLeave(id, identity, sid, now)` false (phiên cũ sau khi vào lại từ máy khác, hoặc webhook lặp) ⇒ bỏ qua. True ⇒ `busy.clear(identity, e.room())` + đọc lại + `events.roster`. **Không** kết thúc phòng khi host rời (Review Focus 4) — LiveKit tự đóng room sau `departure_timeout`.
- `onRoomFinished(room)`: id hợp lệ ⇒ `closer.close(id)` (idempotent).

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.service.CallBusyRegistry;
import com.platform.chatservice.service.rtc.RtcParticipantEvent;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingRtcHandlerTest {

  @Mock private MeetingStore store;
  @Mock private MeetingEvents events;
  @Mock private CallBusyRegistry busy;
  @Mock private MeetingCloser closer;
  @Mock private MeetingPeople people;
  @InjectMocks private MeetingRtcHandler handler;
  private Meeting m;
  private final Instant at = Instant.parse("2026-10-08T02:00:05Z");

  @BeforeEach
  void setUp() {
    m = Meeting.builder().id("m1").hostId("host").build();
    when(store.findById("m1")).thenReturn(Optional.of(m));
    when(people.profiles(anyCollection()))
        .thenReturn(Map.of("host", new PersonDto("host", "Lan", null)));
  }

  private static RtcParticipantEvent ev(String identity, String sid, Instant createdAt) {
    return new RtcParticipantEvent("meet_m1", identity, sid, "evt", createdAt);
  }

  @Test
  void ownsOnlyMeetingRooms() {
    assertThat(handler.supports("meet_m1")).isTrue();
    assertThat(handler.supports("call_c1")).isFalse();
  }

  @Test
  void theFirstPersonInMakesTheMeetingLiveAndIsRecorded() {
    handler.onParticipantJoined(ev("host", "PA_1", at));

    verify(store).markLive("m1", at);
    ArgumentCaptor<Meeting.Attendance> row = ArgumentCaptor.forClass(Meeting.Attendance.class);
    verify(store).recordJoin(eq("m1"), row.capture());
    assertThat(row.getValue().getUserId()).isEqualTo("host");
    assertThat(row.getValue().getDisplayName()).isEqualTo("Lan");
    assertThat(row.getValue().getRole()).isEqualTo("host");
    assertThat(row.getValue().getSid()).isEqualTo("PA_1");
    assertThat(row.getValue().getJoinedAt()).isEqualTo(at);
    verify(busy).markBusy("host", "meet_m1");
    verify(events).roster(m);
  }

  @Test
  void aLiveMeetingIsNotMadeLiveAgainAndUnnamedPeopleStayUnnamed() {
    m.setStatus(MeetingStatus.LIVE);

    handler.onParticipantJoined(ev("guest", "PA_2", null));

    verify(store, never()).markLive(anyString(), any());
    ArgumentCaptor<Meeting.Attendance> row = ArgumentCaptor.forClass(Meeting.Attendance.class);
    verify(store).recordJoin(eq("m1"), row.capture());
    assertThat(row.getValue().getDisplayName()).isNull();
    assertThat(row.getValue().getRole()).isEqualTo("attendee");
    assertThat(row.getValue().getJoinedAt()).isNotNull();
  }

  @Test
  void eventsForEndedOrUnknownMeetingsAreIgnored() {
    m.setStatus(MeetingStatus.ENDED);
    handler.onParticipantJoined(ev("host", "PA_1", at));
    handler.onParticipantLeft(ev("host", "PA_1", at));
    when(store.findById("m1")).thenReturn(Optional.empty());
    handler.onParticipantJoined(ev("host", "PA_1", at));

    verify(store, never()).recordJoin(anyString(), any());
    verify(store, never()).recordLeave(anyString(), anyString(), any(), any());
    verifyNoInteractions(busy, events);
  }

  @Test
  void leavingClosesTheRowFreesThePersonAndUpdatesTheRosterButNeverEndsTheMeeting() {
    m.setStatus(MeetingStatus.LIVE);
    when(store.recordLeave(eq("m1"), eq("host"), eq("PA_1"), any())).thenReturn(true);

    handler.onParticipantLeft(ev("host", "PA_1", at));

    verify(busy).clear("host", "meet_m1");
    verify(events).roster(m);
    verify(closer, never()).close(anyString());
  }

  @Test
  void aStaleOrRepeatedLeaveChangesNothing() {
    m.setStatus(MeetingStatus.LIVE);
    when(store.recordLeave(eq("m1"), eq("host"), eq("PA_OLD"), any())).thenReturn(false);

    handler.onParticipantLeft(ev("host", "PA_OLD", at));

    verifyNoInteractions(busy, events);
  }

  @Test
  void roomFinishedClosesTheMeeting() {
    handler.onRoomFinished("meet_m1");
    handler.onRoomFinished("meet_");

    verify(closer).close("m1");
    verify(closer, never()).close("");
  }
}
```

- [ ] **Step 2: RED** · **Step 3: Hiện thực** · **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingRtcHandlerTest,RtcWebhookDispatcherTest,SfuCallServiceWebhookTest'`
- [ ] **Step 5: Commit** `feat(meetings): attendance and room state from LiveKit webhooks`

---

### Task 14: `MeetingReminderSweep` — nhắc trước 10 phút + dọn lịch cũ

**Files:**
- Create: `M/service/meeting/MeetingReminderSweep.java` — `@Service @RequiredArgsConstructor @Slf4j`, phụ thuộc `MeetingStore`, `MeetingPeople`, `MeetingEvents`; hằng `LEAD = Duration.ofMinutes(10)`, `STALE_AFTER = Duration.ofHours(48)`.
- Test: `T/service/meeting/MeetingReminderSweepTest.java`

Hành vi:
- `@Scheduled(fixedDelayString = "${app.meeting.sweep-interval-ms:60000}") public void sweep()` ⇒ `remindDue(Instant.now())` rồi `expireStale(Instant.now())`.
- `void remindDue(Instant now)`: với mỗi `store.dueForReminder(now, LEAD)`: `store.claimReminder(id)` false ⇒ bỏ (instance khác đã nhận); true ⇒ `recipients = MeetingMapper.recipients(m, departmentId == null ? List.of() : people.departmentMembers(departmentId))` ⇒ `events.starting(m, recipients)`. Lỗi của một cuộc họp chỉ log và **không** reset `reminded` (giống `ReminderSweepService`: giao một lần, best-effort).
- `void expireStale(Instant now)`: `store.expireStale(now.minus(STALE_AFTER), now)` — cuộc họp SCHEDULED mà mốc (lịch, hoặc lúc tạo nếu họp ngay) đã qua 48h mà chưa ai vào ⇒ ENDED, rời khỏi "Sắp tới".

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service.meeting;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.model.Meeting;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingReminderSweepTest {

  @Mock private MeetingStore store;
  @Mock private MeetingPeople people;
  @Mock private MeetingEvents events;
  @InjectMocks private MeetingReminderSweep sweep;
  private final Instant now = Instant.parse("2026-10-08T01:50:00Z");

  private Meeting meeting(String id, String departmentId) {
    return Meeting.builder()
        .id(id)
        .hostId("host")
        .coHostIds(new ArrayList<>(List.of("co")))
        .inviteeIds(new ArrayList<>(List.of("inv", "kicked")))
        .removedIds(new ArrayList<>(List.of("kicked")))
        .departmentId(departmentId)
        .scheduledStart(now.plus(Duration.ofMinutes(10)))
        .build();
  }

  @Test
  void aDueMeetingIsClaimedOnceAndEveryoneConcernedIsReminded() {
    Meeting m = meeting("m1", "dept-a");
    when(store.dueForReminder(now, Duration.ofMinutes(10))).thenReturn(List.of(m));
    when(store.claimReminder("m1")).thenReturn(true);
    when(people.departmentMembers("dept-a")).thenReturn(List.of("d1", "inv"));

    sweep.remindDue(now);

    verify(events).starting(m, List.of("host", "co", "inv", "d1"));
  }

  @Test
  void aMeetingAnotherInstanceAlreadyClaimedIsSkipped() {
    Meeting m = meeting("m1", null);
    when(store.dueForReminder(now, Duration.ofMinutes(10))).thenReturn(List.of(m));
    when(store.claimReminder("m1")).thenReturn(false);

    sweep.remindDue(now);

    verify(events, never()).starting(any(), anyCollection());
    verify(people, never()).departmentMembers(anyString());
  }

  @Test
  void oneFailingMeetingDoesNotStopTheNext() {
    Meeting bad = meeting("bad", null);
    Meeting good = meeting("good", null);
    when(store.dueForReminder(now, Duration.ofMinutes(10))).thenReturn(List.of(bad, good));
    when(store.claimReminder(anyString())).thenReturn(true);
    doThrow(new RuntimeException("broker down")).when(events).starting(eq(bad), anyCollection());

    sweep.remindDue(now);

    verify(events).starting(eq(good), anyCollection());
  }

  @Test
  void staleScheduledMeetingsAreRetiredAfterTwoDays() {
    sweep.expireStale(now);
    verify(store).expireStale(now.minus(Duration.ofHours(48)), now);
  }
}
```

- [ ] **Step 2: RED** · **Step 3: Hiện thực** · **Step 4: GREEN** — `MVN spotless:apply && MVN test -Dtest='MeetingReminderSweepTest,ReminderSweepServiceTest'`
- [ ] **Step 5: Commit** `feat(meetings): 10-minute reminders and stale meeting cleanup`

---

### Task 15: STOMP — `/user/queue/meeting`, `/topic/meeting/{id}` có kiểm quyền

**Files:**
- Modify: `M/security/StompDestinationPolicy.java`
  - `public static final String MEETING_TOPIC_PREFIX = "/topic/meeting/";`, group `(?<meetingId>[A-Za-z0-9_-]{1,64})`
  - `Rule(Pattern pattern, Scope scope)` với `enum Scope { NONE, CONVERSATION, MEETING }` thay cho `boolean requiresMembership`; factory `exact`, `conversation`, `meeting`
  - `SUBSCRIBE_ALLOW_LIST` thêm `Rule.exact("/user/queue/meeting")` và `Rule.meeting(quote(MEETING_TOPIC_PREFIX) + MEETING_ID)` ⇒ 7 rule
  - `SubscribeDecision(boolean allowed, String conversationId, String meetingId)`
- Create: `M/service/meeting/MeetingTopicAuthorizer.java` — `@Component @RequiredArgsConstructor(MeetingRepository meetings, MeetingLobby lobby)`; `boolean canSubscribe(String meetingId, UserPrincipal user)` = cuộc họp tồn tại và `MeetingAccess.decide(m, uid, user.getDepts(), lobby.isAdmitted(id, uid)).entersRoom()`. **Chỉ** phụ thuộc repository + Redis — không `ClusterMessageBroker`/`SimpMessagingTemplate` — để `AuthChannelInterceptor` (được `WebSocketConfig` inject) không tạo vòng bean với cấu hình broker.
- Modify: `M/security/AuthChannelInterceptor.java` — field mới `MeetingTopicAuthorizer meetingTopics`; trong `authorizeSubscription`, khi `decision.meetingId() != null`: `UserPrincipal p = user instanceof UserPrincipal u ? u : new UserPrincipal(user.getName())`; `!meetingTopics.canSubscribe(id, p)` ⇒ `MessageDeliveryException(UNAUTHORIZED_SUBSCRIPTION)`. Cập nhật javadoc lớp.
- Test: `T/security/StompDestinationPolicyTest.java`, `T/security/AuthChannelInterceptorTest.java`, `T/service/meeting/MeetingTopicAuthorizerTest.java`

Ngoài phạm vi task này (MT3): bộ lọc outbound cho `/topic/meeting/*` (người bị mời ra giữa chừng vẫn giữ subscription cũ) — giống `ConversationTopicOutboundInterceptor`, làm cùng lệnh `REMOVE`.

- [ ] **Step 1: Test** — `StompDestinationPolicyTest`: đổi `hasSize(5)` thành `hasSize(7)`; thêm `"/user/queue/meeting"` vào `@ValueSource` của `fixedDestinations_areAllowed_withoutMembership`; thêm `"/topic/meeting/*"`, `"/topic/meeting/**"`, `"/topic/meeting/"`, `"/topic/meeting/m1/typing"`, `"/topic/meeting/{id}"`, `"/topic/meetings/m1"` vào `@ValueSource` của `everythingElse_isDenied`; và:

```java
  @Test
  void meetingTopics_areAllowed_andCaptureTheMeetingId() {
    StompDestinationPolicy.SubscribeDecision d =
        StompDestinationPolicy.evaluateSubscribe("/topic/meeting/670f1c2ab9e4d21f0c3a9e11");
    assertThat(d.allowed()).isTrue();
    assertThat(d.meetingId()).isEqualTo("670f1c2ab9e4d21f0c3a9e11");
    assertThat(d.conversationId()).isNull();
  }
```

`AuthChannelInterceptorTest`: thêm `@Mock private MeetingTopicAuthorizer meetingTopics;` (được `@InjectMocks` nhận), thêm `"/user/queue/meeting"` vào `@ValueSource` của `subscribe_toUserQueuesAndPresence_passesWithoutMembershipLookup`, thêm `"/topic/meeting/*"`, `"/topic/meeting/"` vào list của `subscribe_outsideAllowList_isRefusedBeforeAnyLookup` (và `verifyNoInteractions(meetingTopics)` ở test đó), và:

```java
  @Test
  void subscribe_toMeetingTopic_whenAllowedIntoTheRoom_passes() {
    sessionValid();
    when(meetingTopics.canSubscribe(eq("m1"), any(UserPrincipal.class))).thenReturn(true);
    Message<byte[]> message = frame(StompCommand.SUBSCRIBE, "/topic/meeting/m1", true);

    assertThat(interceptor.preSend(message, channel)).isSameAs(message);
    verifyNoInteractions(conversationQueryService);
  }

  @Test
  void subscribe_toMeetingTopic_whileWaitingOrRemoved_isRefused() {
    sessionValid();
    when(meetingTopics.canSubscribe(eq("m1"), any(UserPrincipal.class))).thenReturn(false);

    assertThatThrownBy(
            () ->
                interceptor.preSend(
                    frame(StompCommand.SUBSCRIBE, "/topic/meeting/m1", true), channel))
        .isInstanceOf(MessageDeliveryException.class)
        .hasMessageContaining(AuthChannelInterceptor.UNAUTHORIZED_SUBSCRIPTION);
  }
```

(import thêm `com.platform.chatservice.service.meeting.MeetingTopicAuthorizer`, `ArgumentMatchers.any/eq` nếu chưa có.)

`MeetingTopicAuthorizerTest`

```java
package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.repository.MeetingRepository;
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

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingTopicAuthorizerTest {

  @Mock private MeetingRepository meetings;
  @Mock private MeetingLobby lobby;
  @InjectMocks private MeetingTopicAuthorizer authorizer;
  private Meeting m;

  @BeforeEach
  void setUp() {
    m =
        Meeting.builder()
            .id("m1")
            .hostId("host")
            .inviteeIds(new ArrayList<>(List.of("inv")))
            .departmentId("dept-a")
            .build();
    when(meetings.findById("m1")).thenReturn(Optional.of(m));
  }

  private boolean can(String userId, List<String> depts) {
    return authorizer.canSubscribe("m1", new UserPrincipal(userId, null, List.of(), depts));
  }

  @Test
  void peopleWhoMayEnterTheRoomMaySubscribe() {
    assertThat(can("host", List.of())).isTrue();
    assertThat(can("inv", List.of())).isTrue();
    assertThat(can("x", List.of("dept-a"))).isTrue();
    when(lobby.isAdmitted("m1", "y")).thenReturn(true);
    assertThat(can("y", List.of())).isTrue();
  }

  @Test
  void waitingRemovedEndedAndUnknownMeetingsMayNot() {
    assertThat(can("stranger", List.of())).isFalse(); // waiting room on
    m.getRemovedIds().add("inv");
    assertThat(can("inv", List.of())).isFalse();
    m.setStatus(MeetingStatus.ENDED);
    assertThat(can("host", List.of())).isFalse();
    assertThat(authorizer.canSubscribe("nope", new UserPrincipal("host"))).isFalse();
  }
}
```

- [ ] **Step 2: RED** — `MVN test -Dtest='StompDestinationPolicyTest,AuthChannelInterceptorTest,MeetingTopicAuthorizerTest'`
- [ ] **Step 3: Hiện thực** như mục Files.
- [ ] **Step 4: GREEN** — cùng lệnh + `ConversationTopicOutboundInterceptorTest` (dùng `conversationIdOfTopic`, không đổi).
- [ ] **Step 5: Commit** `feat(meetings): STOMP destinations for meetings`

---

### Task 16: Kiểm tra toàn bộ + tài liệu

- [ ] `MVN spotless:apply && MVN spotless:check && MVN test` — toàn chat-service xanh (Docker phải chạy cho các test Testcontainers, như hiện tại). Ghi số test vào commit message.
- [ ] `wc -l` mọi file mới trong `M/service/meeting/`, `M/controller/MeetingController.java` ≤ 500 (mục tiêu ≤ 300).
- [ ] `docs/api-spec.md`: mục mới "📅 Meetings (`/api/meetings`)" — bảng REST, object `Meeting`, `MeetingJoinResponse`, mã lỗi, sự kiện STOMP, FCM `MEETING_*` (chép từ mục Contract của plan này); mục "🔌 WebSocket" thêm 2 destination subscribe mới.
- [ ] `apps/server/chat-service/CLAUDE.md`: thêm collection `meetings` vào "MongoDB Documents" và `MeetingReminderSweep` vào "Scheduled jobs".
- [ ] `docs/superpowers/plans/README.md`: dòng `2026-10-05-meetings-p1-core.md` ghi "MT1 + MT2 xong trên `feat/meetings-p1` (step plan `2026-10-07-meetings-mt1-mt2.md`)"; thêm dòng cho plan này.
- [ ] Commit `docs: meetings server contract (MT1–MT2)`.

---

## Ngoài phạm vi MT1–MT2

| Việc | Thuộc |
|---|---|
| Giơ tay (`meet:hands`, `meet.hands`), chat trong họp (`/app/meet.chat`, `GET /messages`, `MeetingMessage` service), ghi chú (`GET/PUT /notes/*`, `meet.notes.updated`, 409 theo `version`), lệnh host (`/app/meet.host`: mute, remove → `removedIds` + `meet.removed`, khoá, phòng chờ bật/tắt, quyền share màn hình, co-host), `LiveKitRoomClient.updateParticipant`, `MeetingWsController` | MT3 |
| Bộ lọc outbound `/topic/meeting/*` cho người bị mời ra giữa chừng; webhook `participant_joined` của người trong `removedIds` (token cũ còn hạn ≤ 10 phút) ⇒ `removeParticipant` lần nữa | MT3 (cùng lệnh `REMOVE`) |
| Hạ tay khi rời phòng (`onParticipantLeft`) | MT3 |
| Web: `lib/api/meetings.ts`, hooks, trang `/meetings`, `/meetings/[id]`, `/meet/[code]`, gate nút "Họp ngay/Lên lịch" theo `perms.includes('HOST_MEETING')`, namespace i18n `meeting`, toast `meet.invited`/`meet.starting` | MT4, MT5 |
| Flutter: repository/provider/màn hình, route `/meetings`, `/meet/:code`, xử lý FCM `MEETING_*` + chuỗi native `meeting_push_invited`/`meeting_push_starting` (7 locale) + channel `pon_meetings`, prefix ARB `meeting` | MT6, MT7 |
| `LiveKitSession` dùng chung với Cuộc gọi, reaction qua data channel, layout, share màn hình | MT5, MT7 |
| Ma trận QC tay, `sync-check` | MT8 |
| AI notetaker, phụ đề, biên bản, `summaryId`, `settings.aiNotetaker` | Meetings P2 |
| "Họp lại" (tạo cuộc họp mới cùng người mời) | client MT4/MT6 — chỉ dùng `POST /api/meetings` |
| Khách ngoài không tài khoản, ghi hình, breakout, đồng bộ Google Calendar, chuyển cuộc gọi nhóm thành phòng họp | backlog (spec §7) |
| Sửa lỗi tiềm ẩn `@PreAuthorize` ⇒ 500 ở `ExternalBotController` (thiếu handler `AccessDeniedException`) | việc riêng, không thuộc tính năng họp |

## Final gate (chạy trước khi PR `feat/meetings-p1` → `dev`)

```bash
# packages/database
pnpm --filter @platform/database build && pnpm --filter @platform/database test
find packages/database/src -name '*.js'          # phải rỗng

# auth-service
pnpm --filter @platform/auth-service test

# chat-service (JDK 21; Docker chạy cho Testcontainers)
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home \
  mvn -B -f apps/server/chat-service/pom.xml spotless:apply
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home \
  mvn -B -f apps/server/chat-service/pom.xml spotless:check test

# web
pnpm --filter @platform/web exec tsc --noEmit
pnpm --filter @platform/web test
pnpm --filter @platform/web lint

# Flutter
cd apps/client && flutter gen-l10n && flutter analyze && flutter test

# không lọt file dev-only
git diff origin/main...HEAD --stat   # chỉ file của MT1–MT2; không scripts/dev/, *.local, localhost
```
