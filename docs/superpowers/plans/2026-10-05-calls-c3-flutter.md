# Calls C3 — Flutter: cuộc gọi qua LiveKit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flutter gọi 1-1 và gọi nhóm trên đường `sfu` (LiveKit) với cùng trải nghiệm và cùng wire như web (C2), khi server bật `CALL_TRANSPORT=sfu`; đường `mesh` giữ nguyên.

**Architecture:** `CallScreen` và `GroupCallController` giữ nguyên vai trò điều khiển, nhưng làm việc với một **engine** chọn theo từng cuộc gọi: 1-1 qua interface `DirectCallEngine` (cài bởi `WebRTCService` hiện có và `SfuCallService` mới), nhóm qua interface `GroupMediaEngine` (cài bởi `GroupCallService` hiện có và `SfuGroupMedia` mới). Phần nói chuyện với LiveKit nằm trong `LiveKitSession` (core/rtc), đứng sau interface `RtcSession` để logic engine test được bằng fake. Các bài học từ final review C2 áp dụng ngay từ đầu: không adaptiveStream, `ROOM_DELETED`/`PARTICIPANT_REMOVED` = bên kia kết thúc, tự giữ subscription topic của hội thoại trong suốt cuộc gọi (ref-count trong `StompService`), grace 8s khi bên kia biến khỏi phòng, giao stream cho UI một lần, cúp khi đang đổ chuông thì gửi cả cancel lẫn leave, probe mic trước khi nghe, chống bấm Nghe hai lần.

**Tech Stack:** Flutter 3.44 · Riverpod · `livekit_client` 2.3.1 (tương thích `flutter_webrtc` 0.12.12 hiện có) · stomp_dart_client · flutter_test.

**Spec:** `docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md` §4.2; contract `2026-10-05-calls-on-livekit.md`; web tham chiếu `2026-10-05-calls-c2-web.md` + ledger final review của nó.

## Global Constraints

- Giống C2: hằng số 45s / 50s / 8s; 7 giá trị `reason`; `answered_elsewhere` không thông báo; không hiện lỗi thô; call log do người kết thúc gửi; i18n đủ 7 ARB (`tool/add_arb_keys.py` + `flutter gen-l10n`); file UI ≤ 400 dòng.
- `livekit_client` giữ ở dòng 2.3.x: bản mới hơn đòi `flutter_webrtc` 0.14+, đụng vào toàn bộ đường mesh vừa được sửa ở plan reliability.
- Test hiện có của mesh (`flutter test`) phải xanh không sửa nội dung.
- `flutter analyze` 0 issue.

## Review Focus

1. Người nhận nghe: echo `call-ring-cancel{answered_elsewhere}` của chính mình bị bỏ qua.
2. Cúp trước khi `call.started` về ⇒ cancel + leave khi id tới, không vào phòng.
3. Mở chat khác rồi đóng trong lúc gọi không làm mất subscription topic của cuộc gọi (ref-count).
4. Phòng bị server đóng ⇒ "cuộc gọi đã kết thúc", không "mất kết nối", không leave, không log thứ hai.
5. Server vẫn `mesh` ⇒ mọi luồng như trước.

## Ruling khi viết plan

Như C1/C2: hành vi + tên test chốt ở đây, code viết test-first lúc thực thi. `LiveKitSession` (gọi plugin native) không unit-test được trong `flutter test`; logic nằm ở engine, test với `FakeRtcSession`.

---

### Task 1: API, transport, ref-count topic

- Create `lib/features/chat/data/calls_repository.dart` (`getConfig`, `getToken` qua `chatDio`), `lib/features/chat/domain/call_transport.dart` (cache đồng bộ, mặc định mesh, `refresh()`), sửa `StompService.subscribeConversation/unsubscribeConversation` thành **đếm số người dùng** (unsubscribe thật khi về 0).
- Test: `call_transport_test.dart` (mặc định mesh / sfu / lỗi ⇒ mesh); `stomp_service_refcount_test.dart` nếu `StompService` dựng được không cần socket, nếu không thì test lớp đếm tách riêng `ConversationSubscriptionCounter`.

### Task 2: `RtcSession` + `LiveKitSession`

- Create `lib/core/rtc/rtc_session.dart` (interface + `RtcPeer` + `RtcEnd { ended, failed }` + `MediaAccessException`), `lib/core/rtc/livekit_session.dart` (Room `adaptiveStream: false, dynacast: true`; events → peers; `ROOM_DELETED`/`PARTICIPANT_REMOVED` ⇒ `ended`; disconnect chủ động ⇒ không callback; lỗi quyền ⇒ `MediaAccessException`).
- Verify: `flutter analyze` (không unit test — plugin native).

### Task 3: `DirectCallEngine` + `SfuCallService`

- Create `lib/features/chat/domain/direct_call_engine.dart`; `WebRTCService implements DirectCallEngine` (không đổi hành vi); Create `lib/features/chat/domain/sfu_call_service.dart`.
- Test `sfu_call_service_test.dart` (FakeRtcSession, fake stomp/repo): start → `call.start`; `call.started` sfu ⇒ token + connect; `call.started` mesh ⇒ leave + failed; peer vào ⇒ `onRemoteStream` một lần; peer biến 8s ⇒ failed, quay lại kịp ⇒ giữ; hết chuông ⇒ cancel + leave + log missed; cúp trước id ⇒ cancel + leave khi id tới; `call-declined{busy}` ⇒ notice busy + log; answer: probe fail ⇒ decline media_error, probe ok ⇒ accept + connect, echo answered_elsewhere bị bỏ qua, bấm hai lần ⇒ một accept; `ended` ⇒ notice hangup byPeer, không leave/log; đang nói cúp ⇒ leave + log ended; `call.ended` từ topic ⇒ notice; reconnecting cờ.

### Task 4: Nối 1-1 vào app

- `IncomingCall` thêm `callId`, `transport` (sdp tuỳ chọn); `incoming_call_prompt.dart`: accept/decline theo transport; `conversations_realtime_handlers.dart`: `call-ring` sfu direct ⇒ prompt (bận ⇒ decline busy), `call-ring-cancel` ⇒ tắt prompt (hoặc prompt nhóm), `call-declined` ⇒ `SfuCallService`, ring mesh "direct" ⇒ bỏ qua; `CallScreen` chọn engine (`callId != null` hoặc gọi đi khi transport sfu), nhãn "Đang kết nối lại…"/"Kết nối yếu"; route `/call` nhận `callId`; refresh transport mỗi lần STOMP kết nối.
- i18n `callReconnecting`, `callPoorConnection` (7 ARB).

### Task 5: `GroupMediaEngine` + `SfuGroupMedia` + nối vào controller

- `GroupCallService implements GroupMediaEngine`; Create `sfu_group_media.dart`; `GroupCallController.join` chọn engine theo transport (ring/`call.started`), sfu ⇒ `call.accept` thay `call.join` (starter không gửi gì), roster vẫn từ server; `IncomingGroupCall` thêm `transport`, decline sfu ⇒ `call.decline`; `ROOM_DELETED` ⇒ teardown không leave.
- Test `sfu_group_media_test.dart`: connect với token; peer stream ⇒ `onRemoteStream(peerId, stream)`; peer rời ⇒ `onPeerRemoved`; dispose ⇒ disconnect.

### Task 6: Kiểm tra + tài liệu

- `flutter analyze` 0 issue, `flutter test` xanh; Android: kiểm `minSdk`/quyền đủ cho `livekit_client`; iOS: `pod install` (nhớ memory CocoaPods: lỗi "higher minimum deployment version" = cache CDN cũ ⇒ `pod install --repo-update`).
- Đánh dấu C3 trong `2026-10-05-calls-on-livekit.md`.
