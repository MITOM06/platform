# Cuộc gọi & Phòng họp — Design

**Ngày:** 2026-10-05 · **Trạng thái:** ĐÃ CHỐT hướng sản phẩm, chưa implement
**Thay thế:** `2026-08-22-meeting-room-livekit-design.md` (giữ lại làm lịch sử; các quyết định
D1, D4, D5, D6 và 3 quyết định owner ngày 2026-08-28 được **kế thừa** vào tài liệu này).
**Giữ nguyên:** contract `2026-06-22-track-a-group-call-contracts.md` §1 `CallSession`,
§5 AI summary, §6 `meeting_summary`.

---

## 1. Hai sản phẩm, không phải một

Owner chốt ngày 2026-10-05: **Cuộc gọi** và **Phòng họp** là hai tính năng khác nhau. Người dùng
chọn giữa hai thứ này theo *mục đích*, giống như chọn giữa Zalo/Messenger và Google Meet/Teams.

| | **Cuộc gọi** (Call) | **Phòng họp** (Meeting) — tính năng mới |
|---|---|---|
| Hình mẫu | Messenger, Zalo | Google Meet, Microsoft Teams |
| Bắt đầu từ | Nút gọi thoại/video trong một hội thoại (1-1 hoặc nhóm) | Màn **Phòng họp**: "Họp ngay" hoặc "Lên lịch"; mở bằng link `/meet/{code}` |
| Cách mời | **Đổ chuông** mọi thành viên hội thoại | **Không đổ chuông.** Gửi lời mời + thông báo, nhắc trước giờ họp; ai có link và có quyền thì vào |
| Vai trò | Ai cũng ngang nhau | **Host / Co-host / Người tham dự** |
| Trước khi vào | Không có, bấm Nghe là vào | **Màn chờ (pre-join lobby)** chọn mic/cam/loa + **phòng chờ** do host duyệt |
| Trong lúc gọi/họp | Mic, cam, loa, đổi cam, thu nhỏ, thêm người (nhóm) | Tất cả nút của Cuộc gọi, cộng thêm: **giơ tay**, **reaction**, **chat trong họp**, **ghi chú** (chung + riêng), **share màn hình**, đổi layout, panel người tham gia, quyền host (tắt mic tất cả, mời ra, khoá phòng, kết thúc cho mọi người) |
| AI | AI notetaker tuỳ chọn cho gọi nhóm (đã có — giữ nguyên) | **Phụ đề trực tiếp**, biên bản, **action items → nhắc việc** cho từng người, **hỏi trợ lý ngay trong họp** |
| Sau khi kết thúc | Dòng "cuộc gọi" trong hội thoại (đã có) | Trang **chi tiết cuộc họp**: biên bản AI, ghi chú, danh sách tham dự, transcript |
| Trần người | 25 (giữ quyết định 2026-08-28) | 25 |

Một số cuộc gọi nhóm sẽ "lớn lên" thành cuộc họp. Phase 1 **không** có nút chuyển đổi; ghi vào backlog.

## 2. Hiện trạng (đo từ code, 2026-10-05)

| Tầng | Hiện có |
|---|---|
| Cuộc gọi 1-1 | P2P qua STOMP relay (`/app/call.offer|answer|ice|end`, `ChatController`), **không lưu state** server. Nhánh `fix/call-1on1-reliability` (chưa merge, chờ test thiết bị) thêm chuông/rung/tút, `reason` khi kết thúc (`hangup|declined|busy|no_answer|media_error|failed`), giữ ICE tới sớm, xử lý quyền, nút mic/loa/cam trên mobile |
| Cuộc gọi nhóm | P2P **mesh** (`group-call-manager.ts`, `group_call_service.dart`), state ở `CallService` (`call_sessions` + Redis `call:active:*`), đổ chuông `call-ring`, AI notetaker qua client STT → `meeting_summary` |
| ICE | **Chỉ STUN** (`stun.l.google.com`) ⇒ fail sau NAT đối xứng (4G) / firewall công ty — **P1 đang tồn tại** |
| Phòng họp | **Chưa có gì** |
| Hạ tầng prod | Mac mini sau **Cloudflare Tunnel**, không mở cổng nào. Tunnel chỉ chuyển HTTP/WebSocket, **không chuyển UDP** |

## 3. Quyết định kiến trúc

| # | Quyết định | Lý do |
|---|---|---|
| D1 | **LiveKit self-hosted** là lớp media chung cho cả Cuộc gọi lẫn Phòng họp | Khớp mô hình self-host một công ty; có TURN nhúng, simulcast, data channel, server API (mute/kick), SDK JS + Flutter. Kế thừa từ spec 2026-08-22 |
| D4 | **Mọi cuộc gọi (kể cả 1-1) đi qua LiveKit** — một đường media duy nhất, **không coturn** | Owner chốt 2026-08-28, giữ nguyên. Tách sản phẩm (§1) là tách **UX và domain**, không tách đường media |
| D5 | Không breaking: server quyết định đường media mỗi cuộc gọi bằng `transport: 'mesh' \| 'sfu'` (env `CALL_TRANSPORT`, mặc định `mesh`) | Rollback = đổi env. Phòng họp là tính năng mới nên **luôn** `sfu`, không cần cờ |
| D6 | STT phía server để sau. AI trong họp dùng **client STT của từng người cho chính mic của mình** | Mỗi dòng transcript tự mang `userId` người nói ⇒ có phân biệt người nói mà không cần diarization; tái dùng `call_stt_service.dart` / `use-call-transcriber` |
| D7 | **Hai domain tách nhau trong chat-service:** `CallSession` (đã có) cho Cuộc gọi, `Meeting` (mới) cho Phòng họp. Dùng chung một lớp `rtc` (token, webhook, room API) | Cuộc gọi gắn với hội thoại và chuông; Phòng họp có lịch, mã phòng, vai trò, phòng chờ. Gộp chung một model sẽ đầy field nullable và if/else |
| D8 | Tên room LiveKit có tiền tố: `call_{callId}` và `meet_{meetingId}` | Webhook định tuyến sự kiện về đúng domain chỉ bằng tên room |
| D9 | Capability mới **`HOST_MEETING`** (tạo/lên lịch phòng họp). Preset: Owner/Admin/Manager/Member đều bật; admin tắt được theo role | Dùng hệ RBAC sẵn có; vào họp chỉ cần được mời hoặc có link + cùng workspace |
| D10 | **Host LiveKit phải có IP công khai nhận UDP.** Chọn máy chạy là việc của owner (§8). Mọi artefact (config, compose, runbook) viết **không phụ thuộc máy** | Cloudflare Tunnel không chuyển UDP; Docker Desktop trên macOS xử lý dải UDP kém |
| D11 | Ghi chú chung dùng **một tài liệu Markdown, lưu tự động, khoá lạc quan theo `version`** — không làm co-editing realtime (CRDT) ở phase này | Đủ cho biên bản họp; CRDT là việc lớn, để backlog |

## 4. Kiến trúc

```
                         ┌──────────────── chat-service (authority) ────────────────┐
Client ── STOMP/REST ──► │ CallService (call_*)        MeetingService (meet_*)       │
                         │        │                          │                      │
                         │        └──────► rtc/ ◄────────────┘                      │
                         │   LiveKitTokenService · LiveKitRoomClient · Webhook       │
                         └──────────▲──────────────────────────┬────────────────────┘
                                    │ webhook (JWT + sha256)    │ Twirp room API
Client ── wss + UDP/TCP/TURN ──► LiveKit SFU ◄──────────────────┘
```

- **chat-service không relay SDP/ICE nữa** (trên đường `sfu`). Nó cấp token theo quyền, giữ
  danh sách người trong phòng dựa trên webhook, và phát sự kiện STOMP như hiện nay.
- **Webhook là nguồn sự thật** cho việc ai đang ở trong phòng. Client crash/kill app không còn
  để lại người "ma" (lỗi hiện tại của `call.leave`).
- **Token** sống 10 phút, chỉ cấp cho người có quyền vào phòng, giữ nguyên block guard của
  `CallService.startCall`. Identity = `userId`, name = displayName, metadata = `{avatarUrl}`.
- Reaction và trạng thái "đang nói" đi qua LiveKit (data channel / `activeSpeakers`), **không**
  qua server. Giơ tay, chat trong họp, ghi chú và lệnh host đi qua chat-service vì cần lưu
  hoặc cần quyền.

### 4.1 Lớp `rtc` (dùng chung)

| Thành phần | Trách nhiệm |
|---|---|
| `LiveKitProperties` | `app.livekit.url` (wss, cho client), `api-url` (https, cho server API), `api-key`, `api-secret` (≥ 32 ký tự), `call-transport` |
| `LiveKitTokenService` | Ký access token HS256 với grant theo `RtcGrant` |
| `LiveKitWebhookVerifier` | Kiểm `Authorization` (JWT ký bằng api-secret, `iss` = api-key) và claim `sha256` = base64(SHA-256(body)) |
| `RtcWebhookController` | `POST /api/rtc/livekit/webhook` (permitAll, tự xác thực), chuyển sự kiện tới handler theo tiền tố room |
| `RtcRoomEventHandler` | Interface mà `CallService` và `MeetingService` cài: `supports(room)`, `onParticipantJoined`, `onParticipantLeft`, `onRoomFinished` |
| `LiveKitRoomClient` | Twirp JSON: `CreateRoom`, `DeleteRoom`, `ListParticipants`, `MutePublishedTrack`, `RemoveParticipant` |

### 4.2 Cuộc gọi trên LiveKit

- 1-1 chuyển sang `CallSession` như gọi nhóm (hiện 1-1 không lưu state). Luồng mới:
  `call.start` → `call-ring` → người nhận `call.accept` / `call.decline{reason}` → cả hai
  `POST /api/calls/{callId}/token` → `room.connect`.
- Giữ nguyên toàn bộ UX từ nhánh `fix/call-1on1-reliability`: chuông, rung, tút chờ, 6 giá trị
  `reason`, timeout 45s/50s, thông báo kết thúc. Thêm `answered_elsewhere`: B nghe trên máy
  này thì máy kia của B ngừng đổ chuông (ruling còn mở của nhánh đó).
- Gọi nhóm: như Zalo — đổ chuông mọi người, ai vào muộn thì bấm banner "Đang có cuộc gọi — Tham
  gia", lưới tối đa 25, không host, không phòng chờ, không giơ tay. AI notetaker giữ nguyên.
- Dọn mesh (`relaySignal`, `group-call-manager.ts`, `group_call_service.dart`, field mesh trong
  `WebRTCSignalDto`) **chỉ sau khi** `sfu` chạy ổn ở prod.

### 4.3 Phòng họp (domain mới)

**Model `meetings`** (chat-service, Mongo):

```
Meeting {
  id, code               // "abc-defg-hjk", unique, sinh ngẫu nhiên, không chứa ký tự dễ nhầm
  title, description?
  hostId, coHostIds[]
  inviteeIds[]           // người được mời đích danh (vào thẳng, không qua phòng chờ)
  departmentId?          // nếu tạo cho một phòng ban: mọi thành viên phòng ban coi như được mời
  scheduledStart?, scheduledEnd?
  status: SCHEDULED | LIVE | ENDED
  settings { waitingRoom: true, muteOnEntry: false, allowAttendeeScreenShare: true,
             locked: false, aiNotetaker: false }
  attendance[] { userId, displayName, role, joinedAt, leftAt }   // từ webhook
  createdAt, startedAt?, endedAt?, summaryId?
}
MeetingNote   { meetingId, scope: SHARED | PRIVATE, ownerId?, content (Markdown), version, updatedBy, updatedAt }
MeetingMessage{ meetingId, senderId, content, createdAt }        // chat trong họp, chỉ text
```

**Redis (tạm thời, xoá khi phòng kết thúc):** `meet:lobby:{id}` (hàng chờ duyệt),
`meet:hands:{id}` (sorted set theo thời điểm giơ tay ⇒ thứ tự phát biểu),
`meet:transcript:{id}` (tương tự `call:transcript:*`).

**Ai được vào:** host, co-host, người trong `inviteeIds`, thành viên `departmentId` → vào thẳng.
Người khác cùng workspace có link → vào **phòng chờ** nếu `waitingRoom = true`, vào thẳng nếu
`false`. Phòng `locked` → chỉ host/co-host/invitee. Người bị chặn bởi host không bị lộ gì thêm
(Phòng họp không phải hội thoại 1-1 nên block guard 1-1 không áp dụng).

**REST** (`/api/meetings`): tạo, sửa, huỷ, danh sách (sắp tới / đã qua), chi tiết theo id hoặc
code, `POST /{id}/join` (trả token **hoặc** `{waiting:true}`), `POST /{id}/admit|deny`,
`POST /{id}/end`, ghi chú `GET|PUT /{id}/notes/{shared|private}` (PUT kèm `version`, sai ⇒ 409),
chat `GET /{id}/messages`.

**STOMP:** client gửi `/app/meet.hand`, `/app/meet.chat`, `/app/meet.host` (lệnh host),
`/app/meet.transcript`. Server phát `/topic/meeting/{id}`: `meet.roster`, `meet.hands`,
`meet.chat`, `meet.notes.updated`, `meet.settings`, `meet.ended`, `meet.caption`; riêng host
nhận `/user/queue/meeting` `meet.lobby` (có người chờ), người chờ nhận `meet.admitted|denied`.

**Lệnh host:** tắt mic một người / tất cả (`MutePublishedTrack`; LiveKit không cho bật mic hộ
— đúng với Meet/Teams), mời ra (`RemoveParticipant` + chặn vào lại trong phiên), hạ tay tất cả,
khoá/mở phòng, bật/tắt phòng chờ, cho phép attendee share màn hình hay không (cấp lại token với
`canPublishSources`), phong co-host, kết thúc cho mọi người (`DeleteRoom`).

### 4.4 AI trong Phòng họp (Meeting phase 2)

- **Phụ đề trực tiếp:** client STT của mỗi người gửi `meet.transcript` (final segments) → server
  lưu Redis + phát `meet.caption` có `userId` ⇒ phụ đề có tên người nói. Bật/tắt phía người xem.
- **Biên bản khi kết thúc:** tái dùng luồng `call:summarize` → ai-service, mở rộng prompt nhận
  ghi chú chung + chat trong họp + transcript; kết quả lưu vào chi tiết cuộc họp (`summaryId`)
  và gửi vào hội thoại liên quan nếu có.
- **Action items:** ai-service trả danh sách `{assigneeId?, text, dueAt?}`; host duyệt trên
  trang chi tiết rồi tạo Reminder cho từng người (tái dùng tool `create_reminder`).
- **Hỏi trợ lý trong họp:** gõ `@AI` trong chat họp → ai-service trả lời với ngữ cảnh transcript
  gần nhất + ghi chú, theo quyền RBAC của **người hỏi**.
- Mọi đầu ra AI đi qua quy tắc `no-raw-system-data-in-ui` và i18n như phần còn lại.

## 5. Ràng buộc chung (áp dụng mọi plan)

- `.claude/rules/sync.md`: mọi tính năng có **cả** web và Flutter, cùng event, cùng hằng số.
- `.claude/rules/i18n.md`: 7 locale — web `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json`,
  Flutter `lib/l10n/app_*.arb` (thêm bằng `apps/client/tool/add_arb_keys.py` + `flutter gen-l10n`).
- `.claude/rules/no-raw-system-data-in-ui.md`: lỗi LiveKit / mã phòng nội bộ / userId không
  bao giờ hiện thô.
- `.claude/rules/dev-local-only.md`: LiveKit chế độ dev, key dev, URL localhost **chỉ ở `dev`**.
  Nhánh tính năng cắt từ `main`.
- `.claude/rules/clean-code.md`: UI ≤ 400 dòng, Java/Nest ≤ 500 dòng.
- chat-service: `mvn spotless:apply` sau mỗi lần sửa Java; Maven chạy JDK 21.
- Biến môi trường mới phải có trong file example tương ứng (CI `check-env-parity.sh`).
- Thiết kế theo `docs/design-system.md` (Warm Grey & Burgundy), web là chuẩn gốc.

## 6. Thứ tự thực hiện (mỗi dòng là một plan riêng)

| # | Plan | Phụ thuộc | Ghi chú |
|---|---|---|---|
| 0 | `2026-10-04-call-1on1-reliability.md` (đã code xong) | — | Merge vào `dev`, chạy ma trận test thiết bị (Task 9). UX của nó được mang sang LiveKit ở plan 2 |
| 1 | `2026-10-05-rtc-foundation-livekit.md` | — | Lớp `rtc` trong chat-service + cấu hình/compose/runbook LiveKit |
| 2 | `2026-10-05-calls-on-livekit.md` | 1 | 1-1 + nhóm qua LiveKit sau cờ `CALL_TRANSPORT`; fix P1 NAT |
| 3 | `2026-10-05-meetings-p1-core.md` | 1 | Phòng họp: tạo/lịch/link, lobby, phòng chờ, host, giơ tay, reaction, chat, ghi chú, share màn hình, layout |
| 4 | `2026-10-05-meetings-p2-ai.md` | 3 | Phụ đề, biên bản, action items → nhắc việc, hỏi AI trong họp |

Plan 2 và 3 **độc lập nhau** sau plan 1, chạy song song được. Cuộc gọi thuộc Module B
(Phạm Minh Trí) — báo trước khi đụng vào để tránh làm trùng.

## 7. Ngoài phạm vi (backlog)

- Chuyển cuộc gọi nhóm thành phòng họp; khách ngoài (không tài khoản) vào bằng link.
- Ghi hình (LiveKit Egress) + luồng xin đồng ý ghi hình.
- Đổ chuông khi app ở nền / bị kill (FCM ưu tiên cao + CallKit / ConnectionService).
- Share màn hình iOS (Broadcast Upload Extension) — owner chốt 2026-08-28 tách bản sau.
- Đồng bộ lịch họp với Google Calendar qua connector-service; breakout room; poll; whiteboard;
  co-editing ghi chú realtime (CRDT); làm mờ nền; STT phía server.

## 8. Việc owner phải quyết trước khi deploy prod (không chặn việc code)

**Chọn máy chạy LiveKit.** Cần IP công khai nhận UDP 50000–60000, TCP 7881, TURN/TLS.

| Phương án | Điều kiện | Đánh đổi |
|---|---|---|
| **VPS riêng ~4 vCPU** (khuyến nghị) | Không | Tốn tiền thuê; IP tĩnh; không lộ IP nhà; giống mô hình khách tự host |
| Mac mini | Mạng nhà **không** bị CGNAT (so IP WAN trên router với `curl -4 ifconfig.me` chạy trên mini); có DDNS; bật firewall IPv6 trên router | Miễn phí; lộ IP nhà; chạy LiveKit **native** (Homebrew + launchd), không qua Docker Desktop |

Dev local không cần quyết định này: LiveKit chạy trong compose của nhánh `dev`.

## 9. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| LiveKit là hạ tầng mới phải vận hành | Healthcheck + runbook; rollback cuộc gọi bằng `CALL_TRANSPORT=mesh` |
| Băng thông server khi 1-1 cũng qua SFU | Ở quy mô một công ty là nhỏ; bật dynacast; đo ở QC |
| Hai đường media trong giai đoạn chuyển tiếp | Server quyết định `transport` cho **cả** cuộc gọi, không trộn |
| Webhook giả mạo | Kiểm chữ ký JWT + `sha256` của body; endpoint không nhận JWT người dùng |
| Ghi chú bị ghi đè khi hai người cùng sửa | Khoá lạc quan `version` + 409 + UI báo "có bản mới hơn" |
| Client STT không có trên một số trình duyệt | Phụ đề là tính năng tuỳ chọn; người nói không có STT thì không có phụ đề, cuộc họp vẫn chạy |
