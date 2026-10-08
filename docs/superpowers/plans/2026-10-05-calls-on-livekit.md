# Cuộc gọi trên LiveKit (1-1 + nhóm, kiểu Messenger/Zalo) — Milestone Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Plan mức milestone.** Contract (wire, REST, hằng số, tên file) ở đây là **chốt**. Trước khi
> bắt đầu mỗi milestone, chạy `superpowers:writing-plans` để viết nó thành các bước TDD có code
> đầy đủ, dựa trên code thật của plan Foundation (khi đó mới có). Không bắt đầu C1 trước khi
> `2026-10-05-rtc-foundation-livekit.md` đã merge vào nhánh tính năng.

**Goal:** Cuộc gọi 1-1 và nhóm vẫn có trải nghiệm như Messenger/Zalo (đổ chuông, Nghe/Từ chối, lý do kết thúc, thu nhỏ, tham gia muộn), nhưng media đi qua LiveKit để gọi được qua 4G / NAT công ty (fix bug P1) và gọi nhóm không vỡ ở 4–6 người.

**Architecture:** `CallService` thành authority cho **cả** 1-1 (hiện 1-1 chỉ relay, không lưu state): tạo `CallSession`, đổ chuông, nhận accept/decline, cấp token qua `LiveKitTokenService`, cài `RtcRoomEventHandler` để giữ danh sách người trong phòng từ webhook. Đường cũ (mesh/P2P) giữ nguyên, server chọn đường cho cả cuộc gọi qua `CALL_TRANSPORT`. Hai client dùng chung một lớp `LiveKitSession` (cũng được Phòng họp dùng lại) và giữ nguyên chuông/rung/tút/thông báo kết thúc từ nhánh `fix/call-1on1-reliability`.

**Tech Stack:** Spring Boot 3 · `livekit-client` (web, npm) · `livekit_client` (Flutter, pub) · STOMP · Zustand · Riverpod.

**Spec:** `docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md` §1, §3 (D4, D5), §4.2.

## Global Constraints

- **Phụ thuộc:** plan `2026-10-04-call-1on1-reliability.md` đã merge (chuông, `reason`, `call-end-notice`, `call_rules.dart`) và plan Foundation đã merge.
- **Nhánh:** `feat/calls-livekit` cắt từ `origin/main`; test trên `dev` trước khi PR (`.claude/rules/dev-local-only.md`).
- **Chủ module:** cuộc gọi thuộc Module B (Phạm Minh Trí) — báo trước khi bắt đầu.
- **Đồng bộ:** web và Flutter cùng giá trị wire, cùng hằng số (`.claude/rules/sync.md`).
- `reason` trên wire nhận đúng **7** giá trị: `hangup` | `declined` | `busy` | `no_answer` | `media_error` | `failed` | `answered_elsewhere`. Thiếu `reason` ⇒ `hangup`.
- `RING_TIMEOUT` = 45s (người gọi), `INCOMING_RING_TIMEOUT` = 50s (người nhận), `DISCONNECT_GRACE` = 8s — giữ nguyên.
- Trần 25 người/cuộc gọi nhóm.
- `CALL_TRANSPORT=mesh` là mặc định; mesh và sfu **không** trộn trong một cuộc gọi.
- Client **không bao giờ** hiện lỗi LiveKit thô (`ConnectionError`, `NegotiationError`, …) — map về key i18n (`.claude/rules/no-raw-system-data-in-ui.md`).
- i18n 7 locale, web `messages/*.json` (namespace `call`), Flutter `app_*.arb` (prefix `call`).
- File UI ≤ 400 dòng, Java ≤ 500 dòng (`CallService.java` đang 322 dòng ⇒ phần sfu đặt ở class mới `SfuCallService`).

## Review Focus

1. **B nghe trên điện thoại khi đang mở cả web** — web phải ngừng chuông ngay (`answered_elsewhere`) và không hiện "cuộc gọi nhỡ".
2. **Kill app giữa cuộc gọi 1-1** — bên kia phải thấy cuộc gọi kết thúc (`failed`) trong ≤ 10s nhờ webhook `participant_left`, không treo "đang kết nối" mãi.
3. **Gọi người đang trong cuộc gọi khác (kể cả cuộc gọi nhóm hoặc đang họp)** — người gọi nhận `busy` ngay, cuộc gọi đang diễn ra không bị ảnh hưởng.
4. **Mất mạng 3s rồi có lại** — LiveKit tự reconnect, UI hiện "Đang kết nối lại…", không kết thúc cuộc gọi.
5. **Đổi `CALL_TRANSPORT` khi đang có cuộc gọi** — cuộc gọi đang chạy giữ đường cũ (`CallSession.transport`), chỉ cuộc gọi mới đi đường mới.

---

## Contract (chốt)

### REST (chat-service)

| Method | Path | Body | Trả về | Lỗi |
|---|---|---|---|---|
| GET | `/api/calls/config` | — | `{ "transport": "mesh"\|"sfu", "livekitUrl": string\|null }` | — |
| POST | `/api/calls/{callId}/token` | — | `{ "url": string, "token": string }` | 403 `CALL_FORBIDDEN` (không phải thành viên / bị chặn), 409 `CALL_ENDED`, 503 `CALLS_UNAVAILABLE` |

### STOMP client → server (`/app/...`)

| Destination | Payload | Ghi chú |
|---|---|---|
| `call.start` | `{ conversationId, media: "audio"\|"video", aiNotetaker? }` | Đã có. Trên `sfu` dùng cho **cả 1-1** |
| `call.accept` | `{ callId }` | Mới. Người nhận bấm Nghe |
| `call.decline` | `{ callId, reason }` | Mới. `reason` ∈ `declined` \| `busy` \| `media_error` |
| `call.cancel` | `{ callId, reason }` | Mới. Người gọi bỏ cuộc khi chưa ai nghe; `reason` ∈ `hangup` \| `no_answer` |
| `call.leave` | `{ callId }` | Đã có. Rời cuộc gọi |

### STOMP server → client

| Kênh | Event | Payload |
|---|---|---|
| `/topic/conversation/{id}` | `call.started` | như cũ **+** `transport`, `kind` (`direct`\|`group`), `livekitUrl` |
| `/topic/conversation/{id}` | `call.roster` | như cũ (nguồn: webhook) |
| `/topic/conversation/{id}` | `call.ended` | `{ callId, reason }` — mới, thay cho tín hiệu `end` trên đường sfu |
| `/user/queue/webrtc` | `call-ring` | như cũ **+** `transport`, `kind` |
| `/user/queue/webrtc` | `call-ring-cancel` | `{ callId, reason }` — mới; gửi tới **mọi phiên** của người nhận khi: người gọi huỷ (`hangup`/`no_answer`), người nhận nghe ở máy khác (`answered_elsewhere`), hoặc từ chối ở máy khác (`declined`) |
| `/user/queue/webrtc` | `call-declined` | `{ callId, conversationId, reason, senderId }` (`senderId` = người từ chối; `callId` null khi người nhận đang bận nên không tạo cuộc gọi) — mới; tới người gọi |
| `/user/queue/webrtc` | `call-merged` | `{ callId, conversationId, senderId, media, transport, kind }` (`senderId` = người đang gọi mình) — mới (2026-10-08); tới người vừa `call.start`: hai bên cùng bấm gọi nhau, server đã nhận cuộc gọi của người kia thay mình ⇒ join `callId` đó |

### Redis

- `call:active:{conversationId}` → callId (đã có).
- `call:user:{userId}` → callId, TTL 6h — mới; để trả `busy`. Xoá khi rời / cuộc gọi kết thúc.
  Phòng họp (plan Meetings) **ghi cùng key** ⇒ đang họp cũng là bận.

### Model

`CallSession` thêm `transport` (`"mesh"` | `"sfu"`, mặc định `"mesh"` cho bản ghi cũ) và `kind` (`"direct"` | `"group"`).

---

## Milestones

### C1 — chat-service: cuộc gọi sfu

> ✅ **Xong 2026-10-05** trên `feat/calls-livekit` — plan step-level `2026-10-05-calls-c1-server.md`; chat-service 277/277 test + spotless.

**Files:**
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/SfuCallService.java` — accept/decline/cancel, busy, cấp token, cài `RtcRoomEventHandler` cho `call_*`.
- Create: `.../controller/CallRestController.java` — `GET /api/calls/config`, `POST /api/calls/{callId}/token`.
- Modify: `.../controller/CallController.java` — thêm `@MessageMapping("/call.accept")`, `("/call.decline")`, `("/call.cancel")` (kiểm tra **không trùng** mapping với `ChatController`).
- Modify: `.../service/CallService.java` — `startCall` đọc `LiveKitProperties.callsUseSfu()`, ghi `transport`/`kind`, set `call:user:*`; `call.started`/`call-ring` thêm field; `endCall` phát `call.ended` và `LiveKitRoomClient.deleteRoom` khi sfu.
- Modify: `.../model/CallSession.java`, `.../dto/CallEventDto.java`, `.../dto/WebRTCSignalDto.java`.
- Test: `SfuCallServiceTest`, `CallRestControllerTest`, mở rộng `CallServiceTest` (nếu chưa có thì tạo).

**Hành vi phải có test:**
- 1-1 `call.start` khi sfu: tạo session `kind=direct`, ring người kia; người kia đang có `call:user:*` ⇒ `call-declined{reason:busy}` về người gọi, **không** ring.
- **Hai bên cùng gọi nhau (glare, 2026-10-08):** nếu `call:user:{người kia}` trỏ tới cuộc gọi 1-1 *của chính người kia tới mình* trong cùng hội thoại và chưa ai nghe ⇒ không trả busy: server nhận mình vào cuộc gọi đó (`acceptedAt`), gửi `call-ring-cancel{answered_elsewhere}` + `call-merged` cho mình. Hai `call.start` xử lý cùng lúc ⇒ claim nguyên tử `SETNX call:active:{conversationId}`; bên thua xoá session chưa công bố của mình và gộp vào bên thắng (`DirectCallGlare`). Mesh (P2P) xử lý ở client: offer chéo nhau ⇒ bên có userId nhỏ hơn bỏ offer của mình và trả lời offer kia.
- `call.accept` từ người nhận: thêm participant, gửi `call-ring-cancel{answered_elsewhere}` tới **mọi phiên** của chính người đó (client phiên đang nghe tự bỏ qua vì đã ở trạng thái `connecting`).
- `call.decline`: 1-1 ⇒ `call-declined` về người gọi + `endCall(reason)`; nhóm ⇒ chỉ ghi nhận, cuộc gọi tiếp tục.
- `call.cancel` từ người gọi trước khi ai nghe ⇒ `call-ring-cancel` tới mọi người được ring + `endCall`.
- Token: chỉ thành viên hội thoại; 1-1 giữ block guard; session đã kết thúc ⇒ 409; LiveKit tắt ⇒ 503. Token có `room=call_{callId}`, identity = userId, name = displayName, metadata `{avatarUrl}`.
- Webhook: `participant_joined` ⇒ participant + `call.roster`; `participant_left` ⇒ `leftAt` + roster, và 1-1 còn ≤ 1 người ⇒ `endCall(failed nếu chưa ai rời bằng call.leave, ngược lại hangup)`; `room_finished` ⇒ `endCall` (idempotent, đã gồm `call:summarize` khi `aiNotetaker`).
- Session `transport=mesh` không bị nhánh sfu đụng tới (Review Focus 5).

**Verify:** `mvn spotless:apply && mvn test` xanh; `AssistantMappingUniquenessTest` xanh.

### C2 — Web

> ✅ **Xong 2026-10-05** trên `feat/calls-livekit` — plan step-level `2026-10-05-calls-c2-web.md`; web tsc/lint/build sạch, vitest 234/234. Còn chờ test thiết bị thật (C4).

**Files:**
- `apps/web/package.json` — thêm `livekit-client` (không dùng `@livekit/components-react`: UI tự dựng theo `docs/design-system.md`).
- Create: `apps/web/lib/rtc/livekit-session.ts` — **dùng chung với Phòng họp**: `connect(url, token, {audio, video})`, `disconnect()`, `setMic/ setCamera/ setScreenShare`, `switchCamera()`, sự kiện → callback: `participants` (identity, name, isSpeaking, micMuted, camMuted, quality, tracks), `reconnecting`/`reconnected`, `disconnected(reason)`. Map lỗi LiveKit → `media_error` | `failed`.
- Create: `apps/web/lib/api/calls.ts` — `getCallConfig()`, `getCallToken(callId)` qua `chatApi`.
- Modify: `apps/web/lib/webrtc/call-manager.ts` — nhánh `transport==='sfu'`: không tạo `RTCPeerConnection`, gửi `call.start`/`accept`/`decline`/`cancel`, lấy token rồi `livekitSession.connect`. Giữ nguyên timer 45s/50s, `call-sounds.ts`, `call-end-notice.ts`. File đang 399 dòng ⇒ phần sfu đặt ở `apps/web/lib/webrtc/sfu-call.ts`.
- Modify: `apps/web/lib/webrtc/group-call-manager.ts` (hoặc file mới `sfu-group-call.ts`) — nhánh sfu cho gọi nhóm.
- Modify: `apps/web/lib/store/call.store.ts` — `transport`, `participants[]`, `reconnecting`.
- Modify: `apps/web/lib/hooks/use-realtime-notifications.ts` — xử lý `call-ring-cancel`, `call-declined`, `call.ended`.
- Modify: `apps/web/components/call/{VoiceCallModal,VideoCallModal,GroupCallModal,ParticipantTileGrid,CallOverlay}.tsx` — render track LiveKit; viền người đang nói; icon mic/cam tắt; nhãn "Đang kết nối lại…"; chỉ báo mạng yếu.
- i18n `call.*`: `answeredElsewhere`, `reconnecting`, `poorConnection`, `callUnavailable`.
- Test (Vitest): `sfu-call.test.ts` (luồng start→ring→accept→token→connect; decline; cancel; answered_elsewhere dừng chuông; busy), `livekit-session.test.ts` (map lỗi, map participant).

**Verify:** `pnpm --filter @platform/web exec tsc --noEmit && pnpm --filter @platform/web lint && pnpm --filter @platform/web test && pnpm --filter @platform/web build`.

### C3 — Flutter

> ✅ **Xong 2026-10-05** trên `feat/calls-livekit` — plan step-level `2026-10-05-calls-c3-flutter.md`; `flutter analyze` 0 issue, `flutter test` 215 pass, `pod install` + `flutter build apk --debug` OK. Còn chờ test thiết bị thật (C4).

**Files:**
- `apps/client/pubspec.yaml` — thêm `livekit_client` (tự kéo `flutter_webrtc`; giữ bản `flutter_webrtc` đang dùng cho mesh nếu tương thích, nếu không thì nâng cùng lúc và chạy lại test mesh). iOS deployment target hiện 13.0 — kiểm yêu cầu tối thiểu của bản `livekit_client` chọn trước khi thêm.
- Create: `apps/client/lib/core/rtc/livekit_session.dart` — mirror 1:1 `livekit-session.ts` (**dùng chung với Phòng họp**).
- Create: `apps/client/lib/features/chat/data/calls_repository.dart` — `getCallConfig`, `getCallToken` qua `chatDio`.
- Modify: `apps/client/lib/features/chat/domain/webrtc_service.dart` (460 dòng — **tách** phần sfu ra `sfu_call_service.dart`), `group_call_controller.dart`, `group_call_state.dart`, `call_rules.dart` (thêm `answered_elsewhere`), `conversations_realtime_handlers.dart` (3 event mới).
- Modify: `presentation/call_screen.dart`, `presentation/group_call_screen.dart` — render track LiveKit, người đang nói, icon mute, "Đang kết nối lại…".
- Audio session: giữ hành vi của nhánh reliability (tút chờ trong phiên voice-call; trả category mặc định sau chuông) — kiểm lại khi LiveKit cũng cấu hình AVAudioSession.
- i18n `callAnsweredElsewhere`, `callReconnecting`, `callPoorConnection`, `callUnavailable` qua `tool/add_arb_keys.py` + `flutter gen-l10n`.
- Test: `sfu_call_service_test.dart`, `livekit_session_test.dart` (map lỗi/participant), mở rộng `call_rules_test.dart`.

**Verify:** `flutter analyze` 0 issue, `flutter test` xanh; đo giật lag ở `--profile`.

### C4 — QC & rollout

- [ ] Skill `sync-check`: cùng event, cùng `reason`, cùng hằng số, cùng key i18n.
- [ ] Ma trận thiết bị (bật `CALL_TRANSPORT=sfu` trên `dev`): 13 kịch bản của plan reliability Task 9 **chạy lại trên sfu**, cộng:
  - 1-1 khác mạng: A Wi-Fi, B 4G → nghe 2 chiều ≤ 5s (mục tiêu chính — P1 NAT).
  - B mở web + điện thoại, nghe trên điện thoại → web ngừng chuông ngay.
  - Kill app B giữa cuộc gọi → A thấy kết thúc ≤ 10s.
  - Gọi nhóm 3 / 5 / 10 người; một người vào muộn qua banner; rời giữa chừng.
  - AI notetaker trong gọi nhóm vẫn ra `meeting_summary` như trước.
- [ ] Rollout: `dev` (sfu) → prod `CALL_TRANSPORT=sfu` sau khi máy media chạy (`docs/superpowers/runbooks/livekit.md`). Rollback = `mesh`.
- [ ] Cleanup (PR riêng, **chỉ sau** ≥ 2 tuần sfu ổn ở prod): xoá `relaySignal`, `/app/call.offer|answer|ice|end`, field mesh trong `WebRTCSignalDto`, `group-call-manager.ts`, `group_call_service.dart`, phần P2P của `call-manager.ts` / `webrtc_service.dart`, rồi bỏ cờ `CALL_TRANSPORT`.
- [ ] Cập nhật `docs/superpowers/plans/README.md` + `docs/api-spec.md` (contract mới).
