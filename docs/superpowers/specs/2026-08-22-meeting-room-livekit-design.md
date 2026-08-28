# Meeting Room — LiveKit SFU Migration (Design)

**Ngày:** 2026-08-22 · **Trạng thái:** ĐÃ CHỐT, chưa implement
**Thay thế phần media của:** `docs/superpowers/specs/2026-06-22-track-a-group-call-contracts.md`
(contract §1 CallSession, §3 call events, §4 Redis keys, §5 AI summary, §6 `meeting_summary`
**giữ nguyên** — chỉ §2 signaling và §7 client STT bị ảnh hưởng)

---

## 1. Mục tiêu

Nâng video call hiện tại thành **phòng họp** ngang Google Meet / Microsoft Teams, giữ đúng
định hướng PON: **self-hosted, một deployment một công ty**, không đẩy audio/video của khách
qua bên thứ ba.

## 2. Hiện trạng (đo từ code, 2026-08-22)

| Tầng | Hiện có | Vấn đề |
|---|---|---|
| Media | P2P **mesh**, 1 `RTCPeerConnection`/người | Mỗi người upload N−1 luồng → vỡ ở 4–6 người |
| ICE | **Chỉ STUN** (`stun.l.google.com`), `grep -ri "turn:"` = 0 kết quả | Call **fail** sau NAT đối xứng / firewall công ty (P1 đang tồn tại) |
| Signaling | STOMP relay SDP/ICE qua `CallService.relaySignal` | ~550 dòng mesh code phải maintain trên 2 client |
| State | Mongo `call_sessions` + Redis `call:active:*` | Roster leak khi client crash (không ai gửi `call.leave`) |
| AI | Client STT (`use-call-transcriber` / `call_stt_service.dart`) → Claude → `meeting_summary` | Phụ thuộc Web Speech API, không diarization |
| UI | 1 modal fullscreen, grid `aspect-video`, **3 nút** mic/cam/leave | Không share màn hình, không lobby, không layout, không active speaker |

## 3. Quyết định kiến trúc (đã chốt với owner)

| # | Quyết định | Lý do |
|---|---|---|
| D1 | **LiveKit self-hosted** làm SFU | Khớp mô hình self-hosted single-tenant; có simulcast/SVC, TURN nhúng, egress recording, SDK cả JS + Flutter; bỏ được toàn bộ mesh code |
| D2 | Deploy **1 VM (GCE) + docker compose** | Đủ cho quy mô 1 công ty/deployment, tái dùng pattern `infra/docker-compose/`; **Cloud Run không nhận UDP** nên không phải lựa chọn |
| D3 | **Phase 1 chỉ đổi đường media + screen share**, giữ nguyên UX "bấm gọi trong conversation" | Verify được SFU trước khi xây Meeting domain; rủi ro thấp nhất |
| D4 | **Cả 1-1 và group đều đi qua LiveKit** (một đường media duy nhất) | Hai đường media là nguồn bug lâu dài; TURN nhúng của LiveKit là room-scoped nên P2P 1-1 vẫn sẽ cần coturn riêng → gộp lại thì **không cần coturn**. Đánh đổi: 1-1 tốn băng thông server, không đáng kể ở quy mô một công ty. **Owner xác nhận 2026-08-28 — chốt, không override. Không thêm coturn.** |
| D5 | **Không breaking change**: server quyết định transport per-call qua field mới `transport: 'mesh' \| 'sfu'` trong `call.started` + env `CALL_TRANSPORT` | Client mobile đã release vẫn chạy mesh; client mới đọc `transport`. Mesh và SFU **không** trộn trong cùng một call vì server quyết định cho cả phòng |
| D6 | Server-side STT **để Phase 2** | Phase 1 giữ client STT nguyên trạng ⇒ contract `call:summarize` / `meeting_summary` không đổi, card 2 client không phải sửa |

## 4. Kiến trúc sau Phase 1

```
Client (web livekit-client / Flutter livekit_client)
   │  1. bấm gọi ─────────────► STOMP /app/call.start  (không đổi)
   │  2. ◄──── call.started { callId, transport:'sfu', livekitUrl }
   │  3. POST /api/calls/{callId}/token ──► chat-service mint JWT (grant theo RBAC)
   │  4. room.connect(livekitUrl, token) ──► LiveKit SFU (VM: 7880/7881/50000-60000udp)
   └─ 5. publish/subscribe track; screen share = 1 track riêng
                                    │
LiveKit webhook ──► POST /api/calls/livekit/webhook ──► chat-service
   participant_joined / participant_left / room_finished
        └─ nguồn sự thật cho CallSession roster + call:active + endCall + call:summarize
```

**chat-service không còn relay SDP/ICE.** Vai trò mới: *authority* — mint token, giữ roster
từ webhook, phát `call.started` / `call.roster` / `call.ended` như cũ.

### Token & quyền

- Room name = **`callId`** (UUID hiện có) ⇒ `call_sessions`, `call:active:*`,
  `call:transcript:*`, `meeting_summary` không phải đổi gì.
- Identity = `userId`, name = `displayName`, metadata = `{displayName, avatarUrl}`.
- Grants theo RBAC (`packages/database/rbac`): `roomJoin`, `canPublish`, `canSubscribe`,
  `canPublishData`; `roomAdmin` chỉ cho host/co-host (Phase 2 dùng để mute-all / kick).
- Token TTL ngắn (~10 phút), chỉ cấp cho member của conversation, **giữ nguyên block guard**
  đã có trong `CallService.startCall`.

### Robustness được lợi miễn phí
Webhook `participant_left` / `room_finished` khiến roster không còn leak khi client crash —
lỗi hiện tại của `call.leave`-only.

## 5. Phạm vi tính năng Phase 1 (áp dụng **cả** web và Flutter — `.claude/rules/sync.md`)

1. **Pre-join lobby** — chọn mic/camera/loa, preview, mức âm lượng, join muted.
2. **Screen share** — `getDisplayMedia` (web) / MediaProjection + foreground service (Android) /
   Broadcast Upload Extension (iOS); banner "X đang trình bày" + layout ưu tiên presentation.
3. **Active speaker** — viền sáng + audio level (LiveKit `activeSpeakers`).
4. **Layout** — grid / spotlight / pin một người.
5. **Trạng thái người khác** — icon mic tắt / camera tắt (LiveKit `TrackPublication.isMuted`).
6. **Panel participants** — roster, ai đang nói, ai đang share.
7. **Chỉ báo chất lượng mạng** — LiveKit `ConnectionQuality`.
8. **Reconnect** — LiveKit tự lo, UI hiện trạng thái "đang kết nối lại".
9. **i18n** — 8 locale web (`messages/*.json`) + 7 ARB Flutter, không hardcode string.

**Ngoài phạm vi Phase 1** (đưa vào backlog §7): Meeting domain (lịch họp, mã/link, phòng chờ,
host controls), recording, live caption, chat trong họp, raise hand, reaction, blur nền,
server-side STT, guest join.

## 6. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| SFU là hạ tầng mới phải vận hành | Docker compose + healthcheck; VM riêng, không dính Cloud Run |
| iOS screen share cần app extension (ký lại, provisioning) | Tách thành task riêng, có thể ship sau web/Android |
| Băng thông server tăng (D4 gộp 1-1) | Bật simulcast + dynacast; đo trước khi mở rộng |
| Client cũ trên store | D5 `transport` flag; mesh path chỉ xoá sau khi bản mới phủ hết |
| Env/secret local lẫn vào `main` | `.claude/rules/dev-local-only.md`: giá trị localhost chỉ ở nhánh `dev` |

## 7. Backlog các phase sau

- **Phase 2 — Meeting domain:** entity `Meeting` tách khỏi `CallSession`; lịch họp, mã phòng +
  join link, phòng chờ/knock, host & co-host theo Department RBAC, lock room, host controls
  (mute all, kick), route riêng `/meet/[code]` thay cho modal.
- **Phase 3 — AI (điểm khác biệt của PON):** server-side STT từ track của SFU (diarization),
  live caption + dịch, "hỏi trợ lý ngay trong họp" qua MCP connectors, action items → task.
- **Phase 4 — Collaboration:** chat trong họp (tái dùng chính conversation), raise hand,
  reaction, poll.
- **Phase 5 — Recording:** LiveKit Egress ra storage + luồng đồng thuận ghi âm (legal).
- **Phase 6 — Mobile/shell:** CallKit / ConnectionService, background audio, PiP, guest join
  bằng link.
