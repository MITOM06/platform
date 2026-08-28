# Plan — Meeting Room Phase 1: LiveKit SFU + Screen Share

**Ngày:** 2026-08-22 · **Trạng thái: PENDING (chưa bắt đầu)**
**Spec:** `docs/superpowers/specs/2026-08-22-meeting-room-livekit-design.md`
**Nhánh đề nghị:** `feat/meeting-livekit` cắt từ `dev` (cần local stack)

> Quy tắc bắt buộc khi thực thi:
> - `.claude/rules/sync.md` — mọi tính năng phải có **cả** web và Flutter, không lệch nhau.
> - `.claude/rules/dev-local-only.md` — giá trị `localhost`/LAN, compose dev, seed **chỉ ở `dev`**;
>   promote lên `main` bằng `git rebase --onto origin/main dev feat/meeting-livekit`.
> - `.claude/rules/i18n.md` — 8 locale web + 7 ARB Flutter, không hardcode string.
> - `.claude/rules/no-raw-system-data-in-ui.md` — lỗi LiveKit **không** được hiện raw ra UI.
> - Sau mỗi lần sửa Java: `mvn spotless:apply` (spotless bind vào test-compile, `mvn compile` không bắt).

---

## M0 — Hạ tầng LiveKit (1 VM + docker compose)

- [ ] **M0.1** Thêm service `livekit` vào compose dev: image `livekit/livekit-server`, ports
      `7880` (ws/http), `7881` (TCP ICE), `50000-60000/udp` (RTC), `--dev` cho local.
      File: `infra/docker-compose/compose.yml` (hoặc `compose.dev.yml`) — **chỉ nhánh `dev`**.
- [ ] **M0.2** `infra/livekit/livekit.yaml`: keys, `rtc.use_external_ip`, `rtc.port_range`,
      `turn.enabled: true` + TLS, `room.auto_create: false`, `webhook.urls` → chat-service,
      `webhook.api_key`.
- [ ] **M0.3** Env var mới, **không default localhost** trên `main`:
      chat-service `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` /
      `LIVEKIT_WEBHOOK_KEY` / `CALL_TRANSPORT` (`mesh|sfu`, default `mesh`);
      web `NEXT_PUBLIC_LIVEKIT_URL`; Flutter dart-define `LIVEKIT_URL`.
- [ ] **M0.4** Runbook deploy VM GCE: firewall (7880/tcp, 7881/tcp, 50000-60000/udp, 3478/udp),
      TLS cho ws, systemd/compose autostart, healthcheck.
      File: `infra/README.md` (mục mới) — **được lên `main`** (không chứa giá trị local).
- [ ] **M0.5** Cập nhật bảng Ports trong `CLAUDE.md` + `infra/README.md`.
- [ ] **M0.6** Verify: 2 tab web join room test qua LiveKit CLI/`--dev`, thấy được nhau.

## M1 — chat-service: authority thay vì relay

- [ ] **M1.1** `LiveKitTokenService` — mint JWT HS256 (`roomJoin`, `room=callId`, `identity=userId`,
      `name=displayName`, `metadata`, `canPublish/canSubscribe/canPublishData`, TTL 10 phút).
      Grant `roomAdmin` để dành cho host (Phase 2, chưa dùng).
      File mới: `apps/server/chat-service/src/main/java/.../service/LiveKitTokenService.java`
- [ ] **M1.2** `POST /api/calls/{callId}/token` — kiểm tra caller là participant của conversation,
      **giữ nguyên block guard** đang có trong `CallService.startCall`, trả `{ url, token }`.
      File mới: `.../controller/CallTokenController.java`
      ⚠️ Không tạo route trùng mapping với controller khác (xem memory: ambiguous mapping làm
      Spring context crash lúc boot, `mvn test` hiện tại không bắt).
- [ ] **M1.3** `POST /api/calls/livekit/webhook` — verify `Authorization` bằng
      `LIVEKIT_WEBHOOK_KEY`; xử lý `participant_joined` → append participant,
      `participant_left` → set `leftAt` + broadcast `call.roster`, `room_finished` → `endCall`
      (đã bao gồm `call:summarize`). Idempotent.
      File mới: `.../controller/LiveKitWebhookController.java` + `.../service/LiveKitWebhookService.java`
- [ ] **M1.4** `call.started` (CallEventDto) thêm 2 field **optional**: `transport` + `livekitUrl`.
      Client cũ bỏ qua field lạ ⇒ không breaking. File: `.../dto/CallEventDto.java`
- [ ] **M1.5** `CallService.startCall` đọc `CALL_TRANSPORT`; nếu `sfu` thì **không** ring mesh path,
      vẫn ring `call-ring` như cũ (ring không đổi). Mesh relay (`relaySignal`) giữ nguyên,
      đánh `@Deprecated` + comment "xoá sau khi client mesh hết dùng".
- [ ] **M1.6** `CallSession` thêm `transport` để biết phòng nào chạy đường nào.
      File: `.../model/CallSession.java`
- [ ] **M1.7** Test: unit cho token grant + webhook idempotency; **thêm `contextLoads` test**
      (hiện chưa có → deploy từng crash vì ambiguous mapping mà `mvn test` vẫn PASS).
- [ ] **M1.8** `mvn spotless:apply && mvn test` xanh.

## M2 — Web (Next.js): LiveKit room + Phase 1 features

- [ ] **M2.1** `pnpm add livekit-client` (không dùng `@livekit/components-react` — tự dựng UI theo
      PON design). File: `apps/web/package.json`
- [ ] **M2.2** `apps/web/lib/webrtc/livekit-room.ts` — connect/disconnect, publish mic+cam,
      screen share, `activeSpeakersChanged`, `connectionQualityChanged`, `trackSubscribed`,
      `participantConnected/Disconnected`, reconnect events → đẩy vào `call.store`.
- [ ] **M2.3** `call.store` thêm: `transport`, `participants` (mute/cam/share/quality/speaking),
      `screenShareTrack`, `layout` (`grid|spotlight|pin`), `pinnedId`, `lobbyOpen`, `devices`.
      File: `apps/web/lib/store/call.store.ts`
- [ ] **M2.4** `components/call/PreJoinLobby.tsx` (mới) — chọn mic/cam/loa + preview + mức âm
      lượng + "join muted", `enumerateDevices` + nhớ lựa chọn.
- [ ] **M2.5** `components/call/GroupCallModal.tsx` — thay `groupCallManager` bằng `livekitRoom`;
      thêm nút **Share screen**, **Participants**, **Layout**; giữ mic/cam/leave.
- [ ] **M2.6** `components/call/ParticipantTileGrid.tsx` — active-speaker ring, icon mic/cam tắt
      của người khác, chỉ báo mạng, layout spotlight/pin, tile screen-share ưu tiên.
- [ ] **M2.7** `components/call/ParticipantsPanel.tsx` (mới) — roster + trạng thái.
- [ ] **M2.8** `components/call/CallOverlay.tsx` — route theo `transport`: `sfu` → LiveKit,
      `mesh` → giữ `groupCallManager` cũ (fallback trong thời gian chuyển tiếp).
- [ ] **M2.9** `use-call-transcriber` giữ nguyên (client STT, Phase 1 không đổi).
- [ ] **M2.10** i18n: key mới vào **cả 8** file `apps/web/messages/*.json`.
- [ ] **M2.11** `pnpm tsc --noEmit && pnpm build` sạch; file ≤ 400 dòng (`.claude/rules/clean-code.md`).

## M3 — Flutter: LiveKit room + Phase 1 features

- [ ] **M3.1** `livekit_client` vào `apps/client/pubspec.yaml` (nó tự kéo `flutter_webrtc`,
      giữ `flutter_webrtc` cho nhánh mesh 1-1 legacy trong lúc chuyển tiếp).
- [ ] **M3.2** `lib/features/chat/domain/livekit_room_service.dart` (mới) — mirror M2.2 1:1.
- [ ] **M3.3** `group_call_state.dart` mở rộng đúng các field như M2.3 (parity bắt buộc).
- [ ] **M3.4** `group_call_controller.dart` — chọn đường theo `transport`; nhánh `sfu` dùng
      `LiveKitRoomService`, nhánh `mesh` giữ `GroupCallService` cũ.
- [ ] **M3.5** `presentation/prejoin_screen.dart` (mới) — lobby chọn thiết bị + preview.
- [ ] **M3.6** `presentation/group_call_screen.dart` — nút share screen / participants / layout,
      active speaker, icon mute người khác, chỉ báo mạng. Tách widget cho ≤ 400 dòng/file.
- [ ] **M3.7** Android screen share: `MediaProjection` + foreground service +
      `FOREGROUND_SERVICE_MEDIA_PROJECTION` trong `AndroidManifest.xml`.
- [ ] **M3.8** iOS screen share: Broadcast Upload Extension + App Group (task riêng, có thể ship
      sau web/Android). Ghi rõ vào release note nếu chưa xong.
- [ ] **M3.9** i18n: key mới vào **cả 7** file `lib/l10n/app_*.arb` + `flutter gen-l10n`.
- [ ] **M3.10** `flutter analyze` sạch + `flutter test` xanh. Đo lag ở `--profile`, **không** debug.

## M4 — QC & rollout

- [ ] **M4.1** Sync check web ↔ mobile (skill `sync-check`): cùng tính năng, cùng event, cùng key.
- [ ] **M4.2** Test thủ công: 2 / 5 / 10 / 25 người; screen share; rời giữa call; **kill app**
      (webhook phải dọn roster); mạng 4G ↔ wifi; join lại.
- [ ] **M4.3** Test sau NAT đối xứng / firewall doanh nghiệp — mục tiêu chính, bug P1 hiện tại.
- [ ] **M4.4** Verify AI notetaker vẫn ra `meeting_summary` đúng như trước (contract không đổi).
- [ ] **M4.5** Rollout: `CALL_TRANSPORT=mesh` → bật `sfu` staging → bật prod; rollback = đổi env.
- [ ] **M4.6** Task cleanup (sau khi client mesh hết dùng): xoá `relaySignal`, mesh field trong
      `WebRTCSignalDto`, `group-call-manager.ts`, `group_call_service.dart`.

---

## Việc chưa quyết, cần hỏi owner khi tới

- [ ] D4 xác nhận lại: **1-1 cũng đi qua LiveKit**? Nếu owner muốn giữ 1-1 P2P → phải thêm
      **coturn** vào M0 (TURN nhúng của LiveKit là room-scoped, không phục vụ P2P ngoài room).
- [ ] iOS screen share có nằm trong Phase 1 hay tách bản sau (ảnh hưởng provisioning/ký app).
- [ ] Trần số người cần đạt ở Phase 1 để chốt sizing VM (25? 50?).
