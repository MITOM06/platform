# Cuộc gọi 1-1 (thoại + video) — Reliability & UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuộc gọi 1-1 trên web và mobile hoạt động như các app nhắn tin phổ biến: có chuông, có rung, có tiếng tút chờ; kết nối được khi hai bên ở khác mạng; báo rõ lý do khi cuộc gọi kết thúc (từ chối / bận / không trả lời / lỗi thiết bị / mất kết nối); mobile có nút mic / loa / camera.

**Architecture:** chat-service tiếp tục chỉ là relay tín hiệu, không lưu trạng thái cuộc gọi. Thay đổi duy nhất ở server là thêm trường `reason` vào `WebRTCSignalDto`. Mọi logic còn lại nằm ở 2 client và đối xứng nhau:
- Web: `lib/webrtc/call-manager.ts`. Flutter: `features/chat/domain/webrtc_service.dart`.
- Nhận candidate sớm: lúc B đang đổ chuông, ICE candidate của A được giữ lại trong buffer thay vì bị bỏ.
- Lý do kết thúc được gửi kèm tín hiệu `end`.
- Âm thanh chuông là file WAV tự tổng hợp bằng script, không tải từ nguồn ngoài.

**Tech Stack:** Spring Boot 3 (Java 21, JUnit 5/Mockito, Spotless) · Next.js 16 + Zustand + next-intl + Vitest · Flutter 3.44 + Riverpod + flutter_webrtc 0.12 + audioplayers 6 · Python 3 (stdlib) để tổng hợp âm thanh.

**Spec:** Không có file spec riêng. Plan bám theo kết quả kiểm tra luồng gọi ngày 2026-10-04 (mục "Bối cảnh" bên dưới) và yêu cầu của owner:
- A gọi B thì có chuông, có rung, có xin quyền mic/camera.
- B nghe thì hai bên nói chuyện được.
- B từ chối thì A quay lại màn hình chat và nhận được thông báo.
- Thời gian chờ ngang các app nhắn tin.

## Bối cảnh — kết quả kiểm tra (2026-10-04, trên `origin/fix/call-stuck-ringing` = PR #163)

| Tiêu chí | Trạng thái | Vị trí lỗi |
|---|---|---|
| Đổ chuông có âm thanh | ❌ Cả web lẫn mobile không có nhạc chuông, không có tiếng tút chờ, mobile không rung | — |
| B nghe → nói chuyện được (khác mạng) | ❌ ICE candidate của A tới lúc B còn đổ chuông bị bỏ, vì B chưa có `RTCPeerConnection` | `call-manager.ts` `addCandidate` (`if (!this.pc) return`), `webrtc_service.dart` `handleIceCandidate` |
| B từ chối → A có thông báo | ❌ Từ chối và cúp máy dùng chung tín hiệu `end` không lý do, nên màn hình của A tắt im lặng | `handleSignal` case `'end'` |
| B đang bận | ❌ Offer mới bị bỏ im lặng, A đổ chuông 45s | `use-realtime-notifications.ts` (offer khi `status !== 'idle'`), Flutter `handleWebRtcSignal` |
| B nghe nhưng từ chối quyền mic/cam | ⚠️ Web: promise không được bắt, hộp gọi kẹt. Mobile: thoát màn hình nhưng không báo A | `CallOverlay.tsx` `acceptIncoming()`, `call_screen.dart` `catch` |
| A từ chối quyền (mobile) | ⚠️ Màn hình đóng nhưng `RTCPeerConnection` vẫn còn (`isActive` = true), nên mọi cuộc gọi đến sau bị coi là "đang bận" | `call_screen.dart` `catch` chỉ `pop()` |
| Tín hiệu `end` từ người không liên quan | ⚠️ Flutter `dispose()` cuộc gọi đang diễn ra với *bất kỳ* `end` nào | `conversations_realtime_handlers.dart` nhánh `end` |
| Mất kết nối | ⚠️ Web cúp ngay khi `disconnected` (kể cả rớt mạng thoáng qua) và không báo bên kia. Mobile không xử lý gì: đồng hồ chạy mãi, không có tiếng | `onconnectionstatechange` / không có `onConnectionState` |
| Tên người gọi (web) | ⚠️ Web gán `peerName: ''`, nên B thấy chữ "Người dùng" | `use-realtime-notifications.ts:168` |
| Nút trong cuộc gọi (mobile) | ⚠️ Chỉ có nút cúp máy | `call_screen.dart` |
| Thời gian chờ | ✅ 45s phía A, 50s phía B (PR #163) | — |

## Ngoài phạm vi (cần plan riêng)

- **Đổ chuông khi app ở nền / bị kill / khoá màn hình.** Cần push FCM ưu tiên cao (data message) kèm CallKit (iOS, cần VoIP push + APNs cert) và ConnectionService/full-screen intent (Android). Server phải gửi push khi relay offer. Đây là việc lớn, có tác động hạ tầng, nên tách thành plan riêng.
- **TURN server.** Thuộc `2026-08-22-meeting-room-livekit-phase1-plan.md` (owner chốt 1-1 cũng chạy qua LiveKit). Plan này giảm lỗi do mất candidate, nhưng không thay được TURN cho mạng NAT đối xứng / 4G.
- **Server kiểm tra A và B cùng hội thoại trước khi relay offer.** Đây là lỗ hổng bảo mật riêng, không phải UX.

## Global Constraints

- **Nhánh:** cắt `fix/call-1on1-reliability` từ `origin/fix/call-stuck-ringing`, vì plan xây trên PR #163. Khi PR #163 đã merge thì `git rebase --onto origin/main origin/fix/call-stuck-ringing fix/call-1on1-reliability` rồi mở PR vào `main`. Test trên `dev` trước theo `.claude/rules/dev-local-only.md`.
- **Chủ sở hữu module:** cuộc gọi thuộc Module B (Phạm Minh Trí). Báo Trí trước khi bắt đầu để tránh làm trùng.
- **Đồng bộ (`.claude/rules/sync.md`):** web và Flutter phải cùng hành vi, cùng giá trị wire, cùng hằng số.
  - `reason` trên wire chỉ nhận đúng 6 giá trị: `hangup` | `declined` | `busy` | `no_answer` | `media_error` | `failed`. Thiếu `reason` (client cũ) thì coi là `hangup`.
  - `RING_TIMEOUT` = 45s, `INCOMING_RING_TIMEOUT` = 50s (giữ nguyên), `DISCONNECT_GRACE` = 8s.
- **i18n:** mọi chuỗi mới phải có đủ 7 locale (en, vi, zh, ja, ko, es, fr): web `apps/web/messages/*.json` (namespace `call`), Flutter `apps/client/lib/l10n/app_*.arb`. Thêm ARB bằng `apps/client/tool/add_arb_keys.py`, sau đó chạy `flutter gen-l10n`. Không sửa tay file generated.
- **Không lộ dữ liệu thô (`.claude/rules/no-raw-system-data-in-ui.md`):** không bao giờ hiển thị userId. Chưa resolve được tên thì dùng `peerFallback` (web) / `callUnknownCaller` (Flutter).
- **Giới hạn độ dài file:** Flutter UI ≤ 400 dòng, web ≤ 400 dòng, Java ≤ 500 dòng.
- **chat-service:** chạy `mvn spotless:apply` sau mỗi lần sửa Java. Dùng JDK 21: `export JAVA_HOME=$(/usr/libexec/java_home -v 21)`, vì JDK mặc định của Homebrew làm hỏng Lombok.
- **Âm thanh:** chỉ dùng file do `apps/client/tool/gen_call_tones.py` sinh ra (WAV mono 16-bit 16 kHz). Không thêm file tải từ internet nếu chưa có đồng ý của owner và chưa ghi rõ license.
- **Không thêm dependency mới** cho Flutter (`audioplayers` đã có; rung dùng `HapticFeedback.vibrate()` của Flutter SDK) và cho web.

## Review Focus

1. **A và B ở khác mạng (qua NAT).** Candidate A gửi lúc B đang đổ chuông phải được áp dụng khi B bấm Nghe. Có test ở Task 3 (web) và Task 5 (`EarlyIceBuffer`). Thử thật bằng 2 thiết bị khác mạng ở Task 9.
2. **Tín hiệu `end` lạc** (từ một cuộc gọi khác, hoặc tới muộn) trong lúc đang gọi với người khác thì không được làm sập cuộc gọi hiện tại. Có test ở Task 3 (web) và Task 5 (`endTargetsCurrentCall`).
3. **Chuông còn kêu sau khi cuộc gọi đã kết thúc** (nghe, từ chối, hết giờ, A huỷ trước khi B nghe). Có test ở Task 4 (`toneFor`) và Task 6 (`IncomingCallNotifier.clear` dừng chuông).
4. **Trình duyệt chặn autoplay** (tab vừa mở, chưa có thao tác nào): không được crash, không có unhandled rejection, và vẫn hiện hộp gọi / Notification. Có test ở Task 4.
5. **Bấm Nghe 2 lần, hoặc A gửi lại offer** thì không được tạo 2 peer connection và không trả "bận" cho chính A. Có test ở Task 3 và Task 5.
6. *(Chỉ test tay được)* Trên iOS, tiếng tút chờ (audioplayers) phát cùng lúc WebRTC đang giữ AVAudioSession không được làm mất âm thanh cuộc gọi sau khi B nghe. Kiểm tra ở Task 9.

## File Structure

**chat-service**
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/WebRTCSignalDto.java` (thêm `reason`)
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/controller/ChatControllerTest.java`

**Âm thanh**
- Create: `apps/client/tool/gen_call_tones.py` (sinh `ringtone.wav` và `ringback.wav` vào 2 app)
- Create: `apps/client/assets/sounds/{ringtone,ringback}.wav`, `apps/web/public/sounds/{ringtone,ringback}.wav`
- Modify: `apps/client/pubspec.yaml` (khai báo `assets/sounds/`)

**Web**
- Create: `apps/web/lib/webrtc/call-end-notice.ts`: kiểu `CallEndReason` và hàm `endNoticeKey()` (pure)
- Modify: `apps/web/lib/webrtc/call-manager.ts`:
  - buffer candidate sớm
  - xử lý offer (đổ chuông / bận / trùng)
  - gửi `reason`
  - bắt lỗi khi nghe máy
  - theo dõi trạng thái kết nối
  - callback `onEndNotice`
- Modify: `apps/web/lib/hooks/use-realtime-notifications.ts`: đẩy cả offer sang `callManager.handleSignal`
- Create: `apps/web/lib/webrtc/call-sounds.ts`: `playTone` / `stopTone` / `toneFor`
- Create: `apps/web/lib/hooks/use-call-alerts.ts`: tên người gọi, chuông, Notification khi tab ẩn, toast báo lý do kết thúc
- Modify: `apps/web/lib/store/call.store.ts` (thêm `setPeerName`), `apps/web/components/call/CallOverlay.tsx`
- Modify: `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json`
- Test: `apps/web/lib/webrtc/__tests__/call-manager.test.ts`, `apps/web/lib/webrtc/__tests__/call-sounds.test.ts`, `apps/web/lib/webrtc/__tests__/call-end-notice.test.ts`

**Flutter**
- Create: `apps/client/lib/features/chat/domain/call_rules.dart` (pure):
  - `CallEndReason`
  - `decideIncomingOffer`
  - `endTargetsCurrentCall`
  - `EarlyIceBuffer`
- Create: `apps/client/lib/features/chat/domain/call_end_notice.dart`: `callEndNotice()`
- Modify: `apps/client/lib/features/chat/domain/webrtc_service.dart`
- Modify: `apps/client/lib/features/chat/domain/conversations_realtime_handlers.dart`
- Create: `apps/client/lib/features/chat/domain/call_sounds.dart`: `TonePlayer`, `CallSounds`, `callSoundsProvider`
- Modify: `apps/client/lib/features/chat/domain/incoming_call.dart` (chuông và rung theo trạng thái prompt)
- Modify: `apps/client/lib/features/chat/ui/widgets/incoming_call_prompt.dart`
- Create: `apps/client/lib/features/chat/ui/widgets/call_controls.dart`
- Modify: `apps/client/lib/features/chat/presentation/call_screen.dart`
- Modify: `apps/client/lib/l10n/app_*.arb` (qua script) và các file generated (qua `flutter gen-l10n`)
- Test: `apps/client/test/features/chat/call_rules_test.dart`, `call_sounds_test.dart`, `call_controls_test.dart`; cập nhật `incoming_call_test.dart`

---

### Task 0: Chuẩn bị nhánh

- [ ] **Step 1: Cắt nhánh từ PR #163**

```bash
git fetch origin
git checkout -b fix/call-1on1-reliability origin/fix/call-stuck-ringing
```

- [ ] **Step 2: Cài đặt cho worktree mới**

```bash
pnpm install
(cd apps/client && flutter pub get && dart run build_runner build --delete-conflicting-outputs)
```

Expected: không lỗi. `*.g.dart` được sinh ra (vì bị gitignore).

- [ ] **Step 3: Chạy baseline**

```bash
pnpm --filter @platform/web test -- call-manager
(cd apps/client && flutter test test/features/chat/incoming_call_test.dart)
```

Expected: PASS (3 test web, 4 test Flutter của PR #163).

---

### Task 1: chat-service relay trường `reason`

**Files:**
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/dto/WebRTCSignalDto.java`
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/controller/ChatControllerTest.java`

**Interfaces:**
- Produces: thuộc tính JSON `reason` (string, nullable) trên mọi tín hiệu `/user/queue/webrtc`. Server chỉ relay nguyên giá trị, không kiểm tra.

Vì sao cần sửa server: Jackson bỏ qua các thuộc tính không có trong DTO. Nếu thiếu trường này, `reason` mà client gửi sẽ biến mất trước khi tới bên kia.

- [ ] **Step 1: Viết test thất bại.** Thêm vào cuối class `ChatControllerTest`, trước dấu `}` cuối cùng:

```java
  /** The end reason (declined / busy / …) must reach the peer so it can explain the hang-up. */
  @Test
  void callEnd_RelaysTheEndReasonToThePeer() {
    com.platform.chatservice.dto.WebRTCSignalDto dto =
        new com.platform.chatservice.dto.WebRTCSignalDto();
    dto.setTargetId("user-789");
    dto.setConversationId("conv-999");
    dto.setType("end");
    dto.setReason("declined");

    chatController.callEnd(dto, principal);

    org.mockito.ArgumentCaptor<com.platform.chatservice.dto.WebRTCSignalDto> sent =
        org.mockito.ArgumentCaptor.forClass(com.platform.chatservice.dto.WebRTCSignalDto.class);
    verify(clusterBroker).convertAndSendToUser(eq("user-789"), eq("/queue/webrtc"), sent.capture());
    org.assertj.core.api.Assertions.assertThat(sent.getValue().getReason()).isEqualTo("declined");
    org.assertj.core.api.Assertions.assertThat(sent.getValue().getSenderId()).isEqualTo(SENDER_ID);
  }

  /** Jackson must bind `reason` from the inbound STOMP JSON (unknown props are silently dropped). */
  @Test
  void webRtcSignal_BindsReasonFromJson() throws Exception {
    com.platform.chatservice.dto.WebRTCSignalDto dto =
        new com.fasterxml.jackson.databind.ObjectMapper()
            .readValue(
                "{\"type\":\"end\",\"targetId\":\"u\",\"reason\":\"busy\"}",
                com.platform.chatservice.dto.WebRTCSignalDto.class);
    org.assertj.core.api.Assertions.assertThat(dto.getReason()).isEqualTo("busy");
  }
```

- [ ] **Step 2: Chạy để thấy test thất bại**

```bash
cd apps/server/chat-service
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
mvn -q -Dtest=ChatControllerTest test
```

Expected: COMPILATION ERROR `cannot find symbol: method setReason(String)`.

- [ ] **Step 3: Thêm trường vào DTO.** Trong `WebRTCSignalDto.java`, sau dòng `private Integer duration;`:

```java

  /**
   * Why a 1-on-1 call ended, on {@code type:"end"}: hangup | declined | busy | no_answer |
   * media_error | failed. Relayed verbatim; null from older clients means hangup.
   */
  private String reason;
```

- [ ] **Step 4: Format và chạy lại**

```bash
mvn -q spotless:apply
mvn -q -Dtest=ChatControllerTest test
```

Expected: PASS. Mọi test cũ trong class vẫn xanh.

- [ ] **Step 5: Commit**

```bash
git add apps/server/chat-service/src/main/java/com/platform/chatservice/dto/WebRTCSignalDto.java \
        apps/server/chat-service/src/test/java/com/platform/chatservice/controller/ChatControllerTest.java
git commit -m "feat(chat): relay the 1-on-1 call end reason to the peer"
```

---

### Task 2: Tổng hợp âm thanh chuông và tiếng tút chờ

**Files:**
- Create: `apps/client/tool/gen_call_tones.py`
- Create (generated, commit lên git): `apps/client/assets/sounds/ringtone.wav`, `apps/client/assets/sounds/ringback.wav`, `apps/web/public/sounds/ringtone.wav`, `apps/web/public/sounds/ringback.wav`
- Modify: `apps/client/pubspec.yaml`

**Interfaces:**
- Produces:
  - Flutter asset `sounds/ringtone.wav`, `sounds/ringback.wav` (dùng với `AssetSource`).
  - Web URL `/sounds/ringtone.wav`, `/sounds/ringback.wav`.

Vì sao tự tổng hợp: không phải theo dõi license, không phải tải file ngoài, và tái tạo được. Nếu owner muốn đổi sang file nhạc khác (CC0) thì chỉ cần thay file ở đúng 4 đường dẫn trên, không phải sửa code.

- [ ] **Step 1: Viết script**

```python
#!/usr/bin/env python3
"""Generate PON's call tones — original, synthesized audio (no third-party
files, no licence to track). Writes the SAME two WAVs into both apps:

  ringtone.wav  incoming-call ring: two-note chime twice, then a pause (3 s loop)
  ringback.wav  outgoing "tút… tút…": 425 Hz, 1 s on / 4 s off (VN/ITU ringback)

Re-run after changing a constant:  python3 apps/client/tool/gen_call_tones.py
"""
import math
import os
import struct
import wave

RATE = 16000  # mono 16-bit, plenty for tones and keeps files ~100-160 KB
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT_DIRS = [
    os.path.join(ROOT, "apps", "client", "assets", "sounds"),
    os.path.join(ROOT, "apps", "web", "public", "sounds"),
]


def tone(freq, secs, vol=0.35, fade=0.01):
    """Steady sine with short fade in/out (no clicks at loop boundaries)."""
    n = int(RATE * secs)
    f = int(RATE * fade)
    return [
        vol * min(1.0, i / f, (n - i) / f) * math.sin(2 * math.pi * freq * i / RATE)
        for i in range(n)
    ]


def chime(freq, secs, vol=0.45):
    """Bell-like note: fundamental + octave, exponential decay."""
    n = int(RATE * secs)
    out = []
    for i in range(n):
        t = i / RATE
        env = math.exp(-3.0 * t) * min(1.0, i / (RATE * 0.005))
        s = math.sin(2 * math.pi * freq * t) + 0.35 * math.sin(2 * math.pi * 2 * freq * t)
        out.append(vol * env * s / 1.35)
    return out


def silence(secs):
    return [0.0] * int(RATE * secs)


def write(name, samples):
    data = b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in samples
    )
    for d in OUT_DIRS:
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, name)
        with wave.open(path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(data)
        print("wrote", os.path.relpath(path, ROOT), f"{len(data) // 1024} KB")


RINGTONE = (
    chime(880.0, 0.35) + chime(659.25, 0.55) + chime(880.0, 0.35) + chime(659.25, 0.75)
    + silence(1.0)
)
RINGBACK = tone(425.0, 1.0) + silence(4.0)

if __name__ == "__main__":
    write("ringtone.wav", RINGTONE)
    write("ringback.wav", RINGBACK)
```

- [ ] **Step 2: Chạy script và kiểm tra đầu ra**

```bash
python3 apps/client/tool/gen_call_tones.py
python3 -c "import wave,sys;[print(p, round(wave.open(p).getnframes()/16000,2),'s') for p in sys.argv[1:]]" \
  apps/client/assets/sounds/ringtone.wav apps/client/assets/sounds/ringback.wav \
  apps/web/public/sounds/ringtone.wav apps/web/public/sounds/ringback.wav
```

Expected: 4 dòng `wrote …`. Thời lượng ringtone 3.0 s và ringback 5.0 s, ở cả 2 thư mục.

- [ ] **Step 3: Nghe thử** (máy macOS): `afplay apps/web/public/sounds/ringtone.wav && afplay apps/web/public/sounds/ringback.wav`. Phải nghe chuông 2 nốt rồi tiếng tút 425 Hz. Muốn đổi giai điệu thì sửa `RINGTONE` rồi chạy lại Step 2.

- [ ] **Step 4: Khai báo asset cho Flutter.** Trong `apps/client/pubspec.yaml`, dưới khối `flutter:` (cạnh `uses-material-design: true` / `generate: true`) thêm:

```yaml
  # Call ringtone / ringback — generated by tool/gen_call_tones.py (original audio).
  assets:
    - assets/sounds/
```

Chạy `cd apps/client && flutter pub get`. Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add apps/client/tool/gen_call_tones.py apps/client/assets/sounds apps/web/public/sounds apps/client/pubspec.yaml
git commit -m "feat(call): add synthesized ringtone and ringback tones"
```

---

### Task 3: Web — candidate sớm, bận, lý do kết thúc, lỗi khi nghe, mất kết nối

**Files:**
- Create: `apps/web/lib/webrtc/call-end-notice.ts`
- Modify (thay toàn bộ file): `apps/web/lib/webrtc/call-manager.ts`
- Modify: `apps/web/lib/hooks/use-realtime-notifications.ts`
- Test (thay toàn bộ file): `apps/web/lib/webrtc/__tests__/call-manager.test.ts`
- Test: `apps/web/lib/webrtc/__tests__/call-end-notice.test.ts`

**Interfaces:**
- Consumes: trường `reason` trên tín hiệu `end` (Task 1).
- Produces:
  - `export type CallEndReason = 'hangup' | 'declined' | 'busy' | 'no_answer' | 'media_error' | 'failed'` (từ `call-end-notice.ts`)
  - `export type CallNoticeKey = 'declined' | 'busy' | 'peerMediaError' | 'ended' | 'connectionLost' | 'noAnswer' | 'mediaError'`
  - `export function endNoticeKey(reason: CallEndReason, byPeer: boolean): CallNoticeKey | null`
  - `callManager.onEndNotice: ((reason: CallEndReason, byPeer: boolean, peerName: string) => void) | null`. Thay cho `onNoAnswer`.
  - `callManager.endCall(reason?: CallEndReason)` (mặc định `'hangup'`)
  - `callManager.dismissIncoming(): void`
  - `callManager.handleSignal(signal)` giờ xử lý cả `'offer'`.
  - `export const DISCONNECT_GRACE_MS = 8_000`

- [ ] **Step 1: Viết test cho `endNoticeKey`.** Tạo `apps/web/lib/webrtc/__tests__/call-end-notice.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { endNoticeKey } from '../call-end-notice'

describe('endNoticeKey', () => {
  it('explains a hang-up caused by the peer', () => {
    expect(endNoticeKey('declined', true)).toBe('declined')
    expect(endNoticeKey('busy', true)).toBe('busy')
    expect(endNoticeKey('media_error', true)).toBe('peerMediaError')
    expect(endNoticeKey('failed', true)).toBe('connectionLost')
    expect(endNoticeKey('hangup', true)).toBe('ended')
    // The caller giving up just makes the incoming prompt disappear.
    expect(endNoticeKey('no_answer', true)).toBeNull()
  })

  it('only explains local endings the user did not choose', () => {
    expect(endNoticeKey('no_answer', false)).toBe('noAnswer')
    expect(endNoticeKey('failed', false)).toBe('connectionLost')
    expect(endNoticeKey('media_error', false)).toBe('mediaError')
    expect(endNoticeKey('hangup', false)).toBeNull()
    expect(endNoticeKey('declined', false)).toBeNull()
  })
})
```

- [ ] **Step 2: Chạy để thấy test thất bại**

Run: `pnpm --filter @platform/web test -- call-end-notice`
Expected: FAIL `Failed to resolve import "../call-end-notice"`.

- [ ] **Step 3: Tạo `apps/web/lib/webrtc/call-end-notice.ts`**

```ts
/**
 * Why a 1-on-1 call ended. Sent as `reason` on the `end` signal and relayed
 * verbatim by chat-service. A missing reason (older client) means 'hangup'.
 * Mirrors Flutter `CallEndReason` (`features/chat/domain/call_rules.dart`).
 */
export type CallEndReason = 'hangup' | 'declined' | 'busy' | 'no_answer' | 'media_error' | 'failed'

/** Keys in the `call` i18n namespace used to explain an ended call. */
export type CallNoticeKey =
  | 'declined'
  | 'busy'
  | 'peerMediaError'
  | 'ended'
  | 'connectionLost'
  | 'noAnswer'
  | 'mediaError'

/**
 * Which message (if any) to show when a call ends. `byPeer` = the other side
 * ended it. Endings the local user chose themselves (hang up, decline) need no
 * explanation.
 */
export function endNoticeKey(reason: CallEndReason, byPeer: boolean): CallNoticeKey | null {
  if (byPeer) {
    switch (reason) {
      case 'declined':
        return 'declined'
      case 'busy':
        return 'busy'
      case 'media_error':
        return 'peerMediaError'
      case 'failed':
        return 'connectionLost'
      case 'hangup':
        return 'ended'
      case 'no_answer':
        return null
    }
  }
  switch (reason) {
    case 'no_answer':
      return 'noAnswer'
    case 'failed':
      return 'connectionLost'
    case 'media_error':
      return 'mediaError'
    default:
      return null
  }
}
```

Chạy lại: `pnpm --filter @platform/web test -- call-end-notice`. Expected: PASS.

- [ ] **Step 4: Viết test cho call manager (thay toàn bộ `apps/web/lib/webrtc/__tests__/call-manager.test.ts`)**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { publish, sendMessage } = vi.hoisted(() => ({
  publish: vi.fn(),
  sendMessage: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish } }))
vi.mock('@/lib/api/chat', () => ({ chatService: { sendMessage } }))

import { callManager, DISCONNECT_GRACE_MS, RING_TIMEOUT_MS } from '../call-manager'
import { useCallStore } from '@/lib/store/call.store'

class FakePeerConnection {
  static last: FakePeerConnection | null = null
  connectionState = 'new'
  onicecandidate: unknown = null
  ontrack: ((e: { streams: MediaStream[] }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  addTrack = vi.fn()
  close = vi.fn()
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'v=0' }))
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'v=0' }))
  setLocalDescription = vi.fn(async () => {})
  setRemoteDescription = vi.fn(async () => {})
  addIceCandidate = vi.fn(async () => {})
  constructor() {
    FakePeerConnection.last = this
  }
  /** Simulate an ICE/DTLS state change. */
  goTo(state: string) {
    this.connectionState = state
    this.onconnectionstatechange?.()
  }
}

const fakeStream = { getTracks: () => [], getAudioTracks: () => [], getVideoTracks: () => [] }
const getUserMedia = vi.fn()
const onEndNotice = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  publish.mockClear()
  sendMessage.mockClear()
  onEndNotice.mockClear()
  getUserMedia.mockReset().mockResolvedValue(fakeStream)
  FakePeerConnection.last = null
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  })
  callManager.onEndNotice = onEndNotice
  callManager.endCall() // reset any call left over from the previous test
  publish.mockClear()
  sendMessage.mockClear()
  onEndNotice.mockClear()
  useCallStore.getState().reset()
})

afterEach(() => {
  callManager.onEndNotice = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const endSignals = () => publish.mock.calls.filter(([dest]) => dest === '/app/call.end')
const offerFrom = (senderId: string, sdp = 'v=0\r\nm=audio 9') =>
  callManager.handleSignal({ type: 'offer', senderId, conversationId: 'conv-1', sdp })
const ice = (senderId: string, candidate: string) =>
  callManager.handleSignal({ type: 'ice', senderId, candidate: { candidate } })

describe('outgoing ring', () => {
  it('gives up after the ring timeout with reason no_answer', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    vi.advanceTimersByTime(RING_TIMEOUT_MS - 1)
    expect(useCallStore.getState().status).toBe('outgoing')

    vi.advanceTimersByTime(1)
    expect(useCallStore.getState().status).toBe('idle')
    expect(endSignals()).toHaveLength(1)
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'bob', type: 'end', reason: 'no_answer' })
    expect(sendMessage).toHaveBeenCalledWith('conv-1', 'system.call.missed:voice', 'system')
    expect(onEndNotice).toHaveBeenCalledWith('no_answer', false, 'Bob')
  })

  it('tells the caller the callee declined', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.handleSignal({ type: 'end', senderId: 'bob', reason: 'declined' })
    expect(useCallStore.getState().status).toBe('idle')
    expect(onEndNotice).toHaveBeenCalledWith('declined', true, 'Bob')
    vi.advanceTimersByTime(RING_TIMEOUT_MS)
    expect(endSignals()).toHaveLength(0)
  })

  it('treats an end without reason (older client) as hangup', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.handleSignal({ type: 'end', senderId: 'bob' })
    expect(onEndNotice).toHaveBeenCalledWith('hangup', true, 'Bob')
  })

  it('logs a missed call and explains a busy callee', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', true)
    callManager.handleSignal({ type: 'end', senderId: 'bob', reason: 'busy' })
    expect(sendMessage).toHaveBeenCalledWith('conv-1', 'system.call.missed:video', 'system')
    expect(onEndNotice).toHaveBeenCalledWith('busy', true, 'Bob')
  })

  it('ignores an end from someone who is not the current peer', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.handleSignal({ type: 'end', senderId: 'carol', reason: 'hangup' })
    expect(useCallStore.getState().status).toBe('outgoing')
    expect(onEndNotice).not.toHaveBeenCalled()
  })

  it('does not leave the caller on "Calling…" when the mic/camera cannot be opened', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'))
    await expect(callManager.startCall('bob', 'Bob', 'conv-1', true)).rejects.toThrow()
    expect(useCallStore.getState().status).toBe('idle')
    expect(publish).not.toHaveBeenCalled()
  })
})

describe('incoming call', () => {
  it('rings on an offer while idle', () => {
    offerFrom('alice', 'v=0\r\nm=audio 9\r\nm=video 9')
    const st = useCallStore.getState()
    expect(st.status).toBe('incoming')
    expect(st.peerId).toBe('alice')
    expect(st.video).toBe(true)
  })

  it('applies candidates that arrived while ringing once the call is answered', async () => {
    offerFrom('alice')
    ice('alice', 'cand-1')
    ice('alice', 'cand-2')
    ice('mallory', 'cand-x') // not the caller — must be dropped
    await callManager.acceptIncoming()
    const added = FakePeerConnection.last!.addIceCandidate.mock.calls.map(([c]) => c.candidate)
    expect(added).toEqual(['cand-1', 'cand-2'])
  })

  it('replies busy to a second caller and keeps the current call', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.handleSignal({ type: 'offer', senderId: 'carol', conversationId: 'conv-2', sdp: 'v=0' })
    expect(endSignals()).toHaveLength(1)
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'carol', conversationId: 'conv-2', reason: 'busy' })
    expect(useCallStore.getState().peerId).toBe('bob')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('ignores a repeated offer from the caller already ringing', () => {
    offerFrom('alice')
    offerFrom('alice')
    expect(endSignals()).toHaveLength(0)
    expect(useCallStore.getState().status).toBe('incoming')
  })

  it('declining tells the caller why', () => {
    offerFrom('alice')
    callManager.endCall('declined')
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'alice', reason: 'declined' })
    expect(useCallStore.getState().status).toBe('idle')
    expect(onEndNotice).toHaveBeenCalledWith('declined', false, '')
  })

  it('a caller cancelling before answer clears the prompt without a toast', () => {
    offerFrom('alice')
    callManager.handleSignal({ type: 'end', senderId: 'alice', reason: 'no_answer' })
    expect(useCallStore.getState().status).toBe('idle')
    expect(onEndNotice).not.toHaveBeenCalled()
  })

  it('answering without mic/camera permission tells the caller and resets', async () => {
    offerFrom('alice')
    getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'))
    await callManager.acceptIncoming()
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'alice', reason: 'media_error' })
    expect(useCallStore.getState().status).toBe('idle')
    expect(onEndNotice).toHaveBeenCalledWith('media_error', false, '')
  })

  it('a double click on Answer sets up only one connection', async () => {
    offerFrom('alice')
    await Promise.all([callManager.acceptIncoming(), callManager.acceptIncoming()])
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })
})

describe('connection health', () => {
  it('ends with reason failed when the connection fails', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    FakePeerConnection.last!.goTo('failed')
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'bob', reason: 'failed' })
    expect(onEndNotice).toHaveBeenCalledWith('failed', false, 'Bob')
  })

  it('survives a short disconnect and ends a long one', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    const pc = FakePeerConnection.last!
    pc.goTo('disconnected')
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS - 1)
    pc.goTo('connected')
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS)
    expect(endSignals()).toHaveLength(0)

    pc.goTo('disconnected')
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS)
    expect(endSignals()[0][1]).toMatchObject({ reason: 'failed' })
  })
})
```

- [ ] **Step 5: Chạy để thấy test thất bại**

Run: `pnpm --filter @platform/web test -- call-manager`
Expected: FAIL. Có `DISCONNECT_GRACE_MS` is not exported, và nhiều assertion fail (`reason` undefined, offer không được xử lý).

- [ ] **Step 6: Thay toàn bộ `apps/web/lib/webrtc/call-manager.ts`**

```ts
import { stompService } from '@/lib/stomp/client'
import { useCallStore } from '@/lib/store/call.store'
import { chatService } from '@/lib/api/chat'
import type { CallEndReason } from './call-end-notice'

export type { CallEndReason } from './call-end-notice'

/**
 * Web counterpart of the Flutter `WebRTCService`. Owns a single
 * `RTCPeerConnection` and drives the call lifecycle over the chat-service STOMP
 * signaling channel (`/app/call.*` → `/user/queue/webrtc`).
 *
 * Uses Unified Plan (`addTrack` / `ontrack`) — matches the mobile peer so SDP
 * negotiation is symmetric.
 */
export interface WebRTCSignal {
  senderId?: string
  targetId?: string
  conversationId?: string
  type: 'offer' | 'answer' | 'ice' | 'end' | 'call-ring' | 'call-blocked'
  sdp?: string
  candidate?: RTCIceCandidateInit
  /** On `end`: why the call ended. Absent from older clients (= 'hangup'). */
  reason?: CallEndReason
  // ── Group-call fields (Track A §3). Absent on legacy 1-on-1 signals. ───────
  /** Present on every mesh signal; routes the signal into the group manager. */
  callId?: string
  /** Mesh peer id the signal was relayed from (server-filled). */
  fromId?: string
  /** Ring metadata (`type:'call-ring'`). */
  startedByName?: string
  media?: 'audio' | 'video'
  aiNotetaker?: boolean
}

/**
 * How long an outgoing 1-on-1 call rings before it is given up as missed.
 * There is no server-side ring state, so without this the caller sat on
 * "Calling…" forever whenever the callee was offline, never saw the ring, or
 * ignored it. Mirrors Flutter `WebRTCService.ringTimeout`.
 */
export const RING_TIMEOUT_MS = 45_000
/** Callee-side safety net, slightly longer than the caller's ring. */
export const INCOMING_RING_TIMEOUT_MS = RING_TIMEOUT_MS + 5_000
/**
 * How long a `disconnected` connection may try to recover (Wi-Fi ↔ 4G hand-off,
 * short loss) before the call is ended. Mirrors Flutter `disconnectGrace`.
 */
export const DISCONNECT_GRACE_MS = 8_000

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
}

class CallManager {
  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private targetId: string | null = null
  private conversationId: string | null = null
  private remoteDescriptionSet = false
  private pendingCandidates: RTCIceCandidateInit[] = []
  private ringTimer: ReturnType<typeof setTimeout> | null = null
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null
  /**
   * The caller trickles ICE candidates right after its offer — while we are
   * still ringing and have no peer connection. They are kept here (only from
   * the caller that is ringing) and applied on answer; dropping them made
   * calls across NATs connect without audio.
   */
  private expectingFrom: string | null = null
  private earlyCandidates: RTCIceCandidateInit[] = []

  onLocalStream: ((s: MediaStream) => void) | null = null
  onRemoteStream: ((s: MediaStream) => void) | null = null
  onEnded: (() => void) | null = null
  /**
   * Fired after a call ended, so the UI can explain why (see `endNoticeKey`).
   * `byPeer` = the other side ended it. `peerName` is captured before the
   * store is reset.
   */
  onEndNotice: ((reason: CallEndReason, byPeer: boolean, peerName: string) => void) | null = null

  getLocalStream(): MediaStream | null {
    return this.localStream
  }
  getRemoteStream(): MediaStream | null {
    return this.remoteStream
  }

  /**
   * Start an outgoing call to `targetId`. `video=false` → audio-only voice call.
   * Rejects (after resetting the call UI) when the camera/mic can't be opened,
   * so the caller is never left on "Calling…" for a call that was never placed.
   */
  async startCall(
    targetId: string,
    targetName: string,
    conversationId: string,
    video = true,
  ): Promise<void> {
    useCallStore.getState().setOutgoing({ peerId: targetId, peerName: targetName, conversationId, video })
    try {
      await this.setup(targetId, conversationId, video)
      const offer = await this.pc!.createOffer()
      await this.pc!.setLocalDescription(offer)
      stompService.publish('/app/call.offer', {
        targetId,
        conversationId,
        type: 'offer',
        sdp: offer.sdp,
      })
    } catch (err) {
      this.teardown(true)
      throw err
    }
    this.ringTimer = setTimeout(() => {
      this.ringTimer = null
      if (useCallStore.getState().status !== 'outgoing') return
      this.endCall('no_answer')
    }, RING_TIMEOUT_MS)
  }

  /** Accept the incoming offer currently held in the store. */
  async acceptIncoming(): Promise<void> {
    const { peerId, conversationId, pendingOfferSdp } = useCallStore.getState()
    // `this.pc` is set synchronously at the start of setup(): a double click
    // on Answer must not build a second connection.
    if (!peerId || !conversationId || !pendingOfferSdp || this.pc) return
    // Match the caller's media: only enable local video if the offer has a video m-line.
    const video = pendingOfferSdp.includes('m=video')
    try {
      await this.setup(peerId, conversationId, video)
    } catch {
      // Mic/camera denied or missing: tell the caller instead of leaving
      // them ringing, and explain it locally.
      this.endCall('media_error')
      return
    }
    await this.pc!.setRemoteDescription({ type: 'offer', sdp: pendingOfferSdp })
    await this.flushPending()
    const answer = await this.pc!.createAnswer()
    await this.pc!.setLocalDescription(answer)
    stompService.publish('/app/call.answer', {
      targetId: peerId,
      conversationId,
      type: 'answer',
      sdp: answer.sdp,
    })
  }

  /** Route an inbound 1-on-1 signal (from `/user/queue/webrtc`). */
  handleSignal(signal: WebRTCSignal): void {
    switch (signal.type) {
      case 'offer':
        this.handleOffer(signal)
        break
      case 'answer':
        void this.handleAnswer(signal.sdp ?? '')
        break
      case 'ice':
        if (signal.candidate) void this.addCandidate(signal.candidate, signal.senderId)
        break
      case 'end':
        this.handleRemoteEnd(signal)
        break
    }
  }

  /** Hang up / decline / give up, notify the peer with `reason`, log the call. */
  endCall(reason: CallEndReason = 'hangup'): void {
    const store = useCallStore.getState()
    // Fall back to the store when rejecting an incoming call that was never
    // set up (peer connection not created yet) — the caller must still be told.
    const targetId = this.targetId ?? store.peerId
    const conversationId = this.conversationId ?? store.conversationId
    const peerName = store.peerName
    if (targetId && conversationId) {
      stompService.publish('/app/call.end', {
        targetId,
        conversationId,
        type: 'end',
        reason,
        duration: store.durationSeconds,
      })
    }
    // Emit a system message so both sides see the call log in the chat history.
    // Only the hang-up initiator sends this (the peer's teardown via 'end'
    // signal does not call endCall, preventing duplicate messages).
    if (conversationId) {
      const kind = store.video ? 'video' : 'voice'
      this.sendCallLog(
        conversationId,
        store.status === 'connected'
          ? `system.call.ended:${kind}:${store.durationSeconds}`
          : `system.call.missed:${kind}`,
      )
    }
    this.teardown(true)
    this.onEndNotice?.(reason, false, peerName)
  }

  /** The incoming prompt timed out locally (caller vanished without `end`). */
  dismissIncoming(): void {
    this.expectingFrom = null
    this.earlyCandidates = []
    if (useCallStore.getState().status === 'incoming') useCallStore.getState().reset()
  }

  toggleMic(on: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = on))
    useCallStore.getState().setMic(on)
  }

  toggleCamera(on: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = on))
    useCallStore.getState().setCamera(on)
  }

  private handleOffer(signal: WebRTCSignal): void {
    const from = signal.senderId
    const conversationId = signal.conversationId
    const sdp = signal.sdp
    if (!from || !conversationId || !sdp) return
    const st = useCallStore.getState()
    if (st.status !== 'idle' || st.groupCallId) {
      // Same caller re-sending (reconnect) → keep ringing; anyone else → busy.
      if (st.peerId === from) return
      stompService.publish('/app/call.end', {
        targetId: from,
        conversationId,
        type: 'end',
        reason: 'busy',
        duration: 0,
      })
      return
    }
    this.expectingFrom = from
    this.earlyCandidates = []
    st.setIncoming({
      peerId: from,
      peerName: '',
      conversationId,
      sdp,
      video: sdp.includes('m=video'),
    })
  }

  private handleRemoteEnd(signal: WebRTCSignal): void {
    const st = useCallStore.getState()
    if (st.status === 'idle') return
    // A late/stray `end` from someone else must never kill the current call.
    if (signal.senderId && st.peerId && signal.senderId !== st.peerId) return
    const reason = signal.reason ?? 'hangup'
    const wasIncoming = st.status === 'incoming'
    const peerName = st.peerName
    if (reason === 'busy' && st.conversationId) {
      // The callee never rang: log the attempt so it shows as a missed call.
      this.sendCallLog(st.conversationId, `system.call.missed:${st.video ? 'video' : 'voice'}`)
    }
    this.teardown(true)
    // A caller cancelling before we answered just makes the prompt go away.
    if (!wasIncoming) this.onEndNotice?.(reason, true, peerName)
  }

  private sendCallLog(conversationId: string, content: string): void {
    chatService.sendMessage(conversationId, content, 'system').catch(() => {
      // best-effort — a failed system message must not block hangup
    })
  }

  private async setup(targetId: string, conversationId: string, video: boolean): Promise<void> {
    this.targetId = targetId
    this.conversationId = conversationId
    this.remoteDescriptionSet = false
    this.pendingCandidates = []

    const pc = new RTCPeerConnection(ICE_SERVERS)
    this.pc = pc
    // Candidates the caller sent while we were ringing (see earlyCandidates).
    if (this.expectingFrom === targetId) this.pendingCandidates.push(...this.earlyCandidates)
    this.expectingFrom = null
    this.earlyCandidates = []

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        stompService.publish('/app/call.ice', {
          targetId,
          conversationId,
          type: 'ice',
          candidate: e.candidate.toJSON(),
        })
      }
    }
    pc.ontrack = (e) => {
      if (e.streams[0]) {
        this.remoteStream = e.streams[0]
        this.onRemoteStream?.(e.streams[0])
        this.clearRingTimer()
        useCallStore.getState().setConnected()
      }
    }
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return
      switch (pc.connectionState) {
        case 'connected':
          this.clearDisconnectTimer()
          break
        case 'disconnected':
          // Often transient (network hand-off): give it a chance to recover.
          this.disconnectTimer ??= setTimeout(() => {
            this.disconnectTimer = null
            if (this.pc === pc) this.endCall('failed')
          }, DISCONNECT_GRACE_MS)
          break
        case 'failed':
          this.endCall('failed')
          break
      }
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video })
    this.onLocalStream?.(this.localStream)
    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream)
    }
  }

  private async handleAnswer(sdp: string): Promise<void> {
    if (!this.pc) return
    await this.pc.setRemoteDescription({ type: 'answer', sdp })
    await this.flushPending()
  }

  private async addCandidate(candidate: RTCIceCandidateInit, from?: string): Promise<void> {
    if (!this.pc) {
      if (from && from === this.expectingFrom) this.earlyCandidates.push(candidate)
      return
    }
    if (!this.remoteDescriptionSet) {
      this.pendingCandidates.push(candidate)
      return
    }
    await this.pc.addIceCandidate(candidate)
  }

  private async flushPending(): Promise<void> {
    this.remoteDescriptionSet = true
    for (const c of this.pendingCandidates) {
      try {
        await this.pc?.addIceCandidate(c)
      } catch {
        // ignore malformed late candidates
      }
    }
    this.pendingCandidates = []
  }

  private clearRingTimer(): void {
    if (this.ringTimer) clearTimeout(this.ringTimer)
    this.ringTimer = null
  }

  private clearDisconnectTimer(): void {
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer)
    this.disconnectTimer = null
  }

  /** Tear down media + connection. `notifyUi` resets the store/overlay. */
  private teardown(notifyUi: boolean): void {
    this.clearRingTimer()
    this.clearDisconnectTimer()
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.remoteStream = null
    const pc = this.pc
    this.pc = null // before close(): a 'closed' state change must not re-enter endCall
    pc?.close()
    this.targetId = null
    this.conversationId = null
    this.remoteDescriptionSet = false
    this.pendingCandidates = []
    this.expectingFrom = null
    this.earlyCandidates = []
    if (notifyUi) {
      this.onEnded?.()
      useCallStore.getState().reset()
    }
  }
}

export const callManager = new CallManager()
```

- [ ] **Step 7: Đẩy offer qua callManager.** Trong `apps/web/lib/hooks/use-realtime-notifications.ts`, thay khối `// ── Legacy 1-on-1 ──…` (từ `if (signal.type === 'offer') {` đến hết `else { … }`) bằng:

```ts
          // ── Legacy 1-on-1 (offer / answer / ice / end) ──────────────────────
          // callManager owns ringing, busy replies and the early-ICE buffer.
          // Lazy-load the WebRTC module only when a call signal arrives — keeps
          // RTCPeerConnection code out of the initial layout bundle. Successive
          // signals stay in order: they all chain on the same import() promise.
          void import('@/lib/webrtc/call-manager').then((m) =>
            m.callManager.handleSignal(signal),
          )
```

Bỏ import `useCallStore` nếu file không còn dùng (khối `call-blocked` / `call-ring` vẫn dùng thì giữ). Chạy `pnpm --filter @platform/web exec tsc --noEmit` để kiểm tra.

- [ ] **Step 8: Chạy test**

Run: `pnpm --filter @platform/web test -- call-manager call-end-notice`
Expected: PASS toàn bộ (17 + 2 test).

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/webrtc apps/web/lib/hooks/use-realtime-notifications.ts
git commit -m "fix(web/call): keep early ICE, reply busy, send end reasons, survive short disconnects"
```

---

### Task 4: Web — chuông, tên người gọi, Notification khi tab ẩn, toast lý do kết thúc

**Files:**
- Create: `apps/web/lib/webrtc/call-sounds.ts`
- Create: `apps/web/lib/hooks/use-call-alerts.ts`
- Modify: `apps/web/lib/store/call.store.ts`
- Modify: `apps/web/components/call/CallOverlay.tsx`
- Modify: `apps/web/messages/{en,vi,zh,ja,ko,es,fr}.json`
- Test: `apps/web/lib/webrtc/__tests__/call-sounds.test.ts`

**Interfaces:**
- Consumes: `callManager.onEndNotice`, `callManager.dismissIncoming()`, `callManager.endCall(reason)`, `endNoticeKey` (Task 3); file `/sounds/*.wav` (Task 2).
- Produces:
  - `export type Tone = 'ringtone' | 'ringback'`
  - `playTone(tone: Tone): void`, `stopTone(): void`, `toneFor(status: CallStatus, incomingGroupRing: boolean): Tone | null`
  - `useCallStore.getState().setPeerName(name: string)`
  - `useCallAlerts(): void`

- [ ] **Step 1: Viết test.** Tạo `apps/web/lib/webrtc/__tests__/call-sounds.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playTone, stopTone, toneFor } from '../call-sounds'

class FakeAudio {
  static created: FakeAudio[] = []
  static playResult: () => Promise<void> = () => Promise.resolve()
  loop = false
  src: string
  play = vi.fn(() => FakeAudio.playResult())
  pause = vi.fn()
  constructor(src: string) {
    this.src = src
    FakeAudio.created.push(this)
  }
}

beforeEach(() => {
  FakeAudio.created = []
  FakeAudio.playResult = () => Promise.resolve()
  vi.stubGlobal('Audio', FakeAudio)
})

afterEach(() => {
  stopTone()
  vi.unstubAllGlobals()
})

describe('playTone / stopTone', () => {
  it('loops the requested tone', () => {
    playTone('ringtone')
    expect(FakeAudio.created).toHaveLength(1)
    expect(FakeAudio.created[0].src).toBe('/sounds/ringtone.wav')
    expect(FakeAudio.created[0].loop).toBe(true)
    expect(FakeAudio.created[0].play).toHaveBeenCalledOnce()
  })

  it('does not restart a tone that is already playing', () => {
    playTone('ringback')
    playTone('ringback')
    expect(FakeAudio.created).toHaveLength(1)
  })

  it('switching tones stops the previous one', () => {
    playTone('ringtone')
    playTone('ringback')
    expect(FakeAudio.created[0].pause).toHaveBeenCalled()
    expect(FakeAudio.created[1].src).toBe('/sounds/ringback.wav')
  })

  it('stopTone silences the current tone', () => {
    playTone('ringtone')
    stopTone()
    expect(FakeAudio.created[0].pause).toHaveBeenCalled()
  })

  it('swallows an autoplay rejection (tab never interacted with)', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    FakeAudio.playResult = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'))
    playTone('ringtone')
    await new Promise((r) => setTimeout(r, 0))
    process.off('unhandledRejection', unhandled)
    expect(unhandled).not.toHaveBeenCalled()
  })
})

describe('toneFor', () => {
  it('rings the callee and plays ringback to the caller only', () => {
    expect(toneFor('incoming', false)).toBe('ringtone')
    expect(toneFor('outgoing', false)).toBe('ringback')
    expect(toneFor('connected', false)).toBeNull()
    expect(toneFor('idle', false)).toBeNull()
    expect(toneFor('idle', true)).toBe('ringtone') // group-call ring
    expect(toneFor('connected', true)).toBeNull() // never over an active call
  })
})
```

- [ ] **Step 2: Chạy để thấy test thất bại**

Run: `pnpm --filter @platform/web test -- call-sounds`
Expected: FAIL `Failed to resolve import "../call-sounds"`.

- [ ] **Step 3: Tạo `apps/web/lib/webrtc/call-sounds.ts`**

```ts
import type { CallStatus } from '@/lib/store/call.store'

/** Call tones in `public/sounds/` (generated by apps/client/tool/gen_call_tones.py). */
export type Tone = 'ringtone' | 'ringback'

let audio: HTMLAudioElement | null = null
let current: Tone | null = null

/** Loop `tone` until stopTone() or another tone. No-op if it already plays. */
export function playTone(tone: Tone): void {
  if (current === tone) return
  stopTone()
  const a = new Audio(`/sounds/${tone}.wav`)
  a.loop = true
  audio = a
  current = tone
  a.play().catch(() => {
    // Autoplay is blocked until the user has interacted with the page; the
    // on-screen prompt (and the OS notification when hidden) still shows.
  })
}

export function stopTone(): void {
  audio?.pause()
  audio = null
  current = null
}

/** Which tone the current call state calls for. */
export function toneFor(status: CallStatus, incomingGroupRing: boolean): Tone | null {
  if (status === 'incoming') return 'ringtone'
  if (status === 'outgoing') return 'ringback'
  if (status === 'idle' && incomingGroupRing) return 'ringtone'
  return null
}
```

Chạy lại: `pnpm --filter @platform/web test -- call-sounds`. Expected: PASS.

- [ ] **Step 4: Thêm `setPeerName` vào store.** Trong `apps/web/lib/store/call.store.ts`:
  - Trong interface `CallState`, dưới `setOutgoing: …` thêm `setPeerName: (name: string) => void`.
  - Trong `create(...)`, dưới `setOutgoing: …` thêm `setPeerName: (peerName) => set({ peerName }),`.

- [ ] **Step 5: Thêm i18n.** Thêm vào namespace `"call"` của từng file (giữ đúng thứ tự key, chèn sau `"noAnswer"`):

| key | en | vi | zh | ja | ko | es | fr |
|---|---|---|---|---|---|---|---|
| `declined` | `{name} declined the call` | `{name} đã từ chối cuộc gọi` | `{name} 拒绝了通话` | `{name}さんが通話を拒否しました` | `{name}님이 통화를 거절했습니다` | `{name} rechazó la llamada` | `{name} a refusé l'appel` |
| `busy` | `{name} is on another call` | `{name} đang bận cuộc gọi khác` | `{name} 正在通话中` | `{name}さんは別の通話中です` | `{name}님이 다른 통화 중입니다` | `{name} está en otra llamada` | `{name} est déjà en appel` |
| `peerMediaError` | `{name} couldn't turn on their microphone or camera` | `{name} không bật được micro hoặc camera` | `{name} 无法开启麦克风或摄像头` | `{name}さんのマイクまたはカメラを起動できませんでした` | `{name}님의 마이크 또는 카메라를 켤 수 없습니다` | `{name} no pudo activar su micrófono o cámara` | `{name} n'a pas pu activer son micro ou sa caméra` |
| `ended` | `Call ended` | `Cuộc gọi đã kết thúc` | `通话已结束` | `通話が終了しました` | `통화가 종료되었습니다` | `Llamada finalizada` | `Appel terminé` |
| `connectionLost` | `Call dropped — connection lost` | `Cuộc gọi bị ngắt do mất kết nối` | `连接中断，通话已结束` | `接続が切れたため通話が終了しました` | `연결이 끊겨 통화가 종료되었습니다` | `La llamada se cortó por pérdida de conexión` | `Appel interrompu : connexion perdue` |

Kiểm tra parity: `pnpm --filter @platform/web test -- i18n-parity`. Expected: PASS.

- [ ] **Step 6: Tạo `apps/web/lib/hooks/use-call-alerts.ts`**

```ts
'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useCallStore } from '@/lib/store/call.store'
import { useUser } from '@/lib/hooks/use-user'
import { useNickname } from '@/lib/nicknames'
import { callManager } from '@/lib/webrtc/call-manager'
import { endNoticeKey } from '@/lib/webrtc/call-end-notice'
import { playTone, stopTone, toneFor } from '@/lib/webrtc/call-sounds'

/**
 * Everything a 1-on-1 call needs to get the user's attention and explain
 * itself: the caller's name (the offer only carries a userId), ringtone /
 * ringback, an OS notification while the tab is hidden, and a toast saying why
 * a call ended. Mounted once by CallOverlay.
 */
export function useCallAlerts(): void {
  const t = useTranslations('call')
  const status = useCallStore((s) => s.status)
  const peerId = useCallStore((s) => s.peerId)
  const conversationId = useCallStore((s) => s.conversationId)
  const peerName = useCallStore((s) => s.peerName)
  const video = useCallStore((s) => s.video)
  const incomingGroupRing = useCallStore((s) => s.incomingGroupCall !== null)

  const { data: peerUser } = useUser(peerId ?? undefined)
  const nickname = useNickname(conversationId ?? '', peerId ?? undefined)
  const resolvedName = nickname || peerUser?.displayName || ''

  // Name the caller as soon as it resolves (never show a raw userId).
  useEffect(() => {
    if (status !== 'idle' && !peerName && resolvedName) {
      useCallStore.getState().setPeerName(resolvedName)
    }
  }, [status, peerName, resolvedName])

  // Ringtone for the callee, ringback for the caller; silence otherwise.
  const tone = toneFor(status, incomingGroupRing)
  useEffect(() => {
    if (tone) playTone(tone)
    else stopTone()
  }, [tone])
  useEffect(() => () => stopTone(), [])

  // Background tab: an OS notification so the ring is not missed.
  useEffect(() => {
    if (status !== 'incoming') return
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const n = new Notification(video ? t('incomingVideo') : t('incomingVoice'), {
      body: resolvedName || t('peerFallback'),
      tag: 'pon-incoming-call',
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
    return () => n.close()
  }, [status, video, resolvedName, t])

  // Explain why a call closed (declined, busy, no answer, connection lost…).
  useEffect(() => {
    callManager.onEndNotice = (reason, byPeer, name) => {
      const key = endNoticeKey(reason, byPeer)
      if (!key) return
      const message = t(key, { name: name || t('peerFallback') })
      if (key === 'connectionLost' || key === 'mediaError') toast.error(message)
      else toast(message)
    }
    return () => {
      callManager.onEndNotice = null
    }
  }, [t])
}
```

- [ ] **Step 7: Nối vào `CallOverlay.tsx`**
  - Thêm `import { useCallAlerts } from '@/lib/hooks/use-call-alerts'`. Bỏ import `toast` và `INCOMING_RING_TIMEOUT_MS` nếu không còn dùng, nhưng vẫn cần `INCOMING_RING_TIMEOUT_MS` cho effect bên dưới, nên giữ import của nó.
  - Gọi `useCallAlerts()` ngay sau các dòng `useCallStore(...)`, **trước** mọi `return` (quy tắc của hook).
  - Xoá effect `callManager.onNoAnswer = …`.
  - Effect safety net phía B đổi thành:

```tsx
  useEffect(() => {
    if (status !== 'incoming') return
    const id = setTimeout(() => callManager.dismissIncoming(), INCOMING_RING_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [status])
```

  - Nút Từ chối: `onClick={() => callManager.endCall('declined')}`.
  - Nút Nghe: `onClick={() => void callManager.acceptIncoming()}`. Lỗi đã được bắt bên trong.

- [ ] **Step 8: Kiểm tra web**

```bash
pnpm --filter @platform/web test
pnpm --filter @platform/web exec tsc --noEmit
pnpm --filter @platform/web lint
```

Expected: tất cả PASS, không lỗi type hay lint. `grep -rn onNoAnswer apps/web` trả về rỗng.

- [ ] **Step 9: Commit**

```bash
git add apps/web
git commit -m "feat(web/call): ringtone, ringback, caller name, background notification and end-reason toasts"
```

---

### Task 5: Flutter — luật cuộc gọi (pure) và WebRTCService

**Files:**
- Create: `apps/client/lib/features/chat/domain/call_rules.dart`
- Create: `apps/client/lib/features/chat/domain/call_end_notice.dart`
- Modify (thay toàn bộ file): `apps/client/lib/features/chat/domain/webrtc_service.dart`
- Modify: `apps/client/lib/l10n/app_*.arb` (qua script) và các file generated
- Test: `apps/client/test/features/chat/call_rules_test.dart`

**Interfaces:**
- Consumes: wire `reason` (Task 1).
- Produces:
  - `enum CallEndReason { hangup, declined, busy, noAnswer, mediaError, failed }` với `String wire` và `static CallEndReason fromWire(String?)`
  - `enum IncomingOfferAction { ring, ignore, replyBusy }` và `IncomingOfferAction decideIncomingOffer({required String from, String? ringingFrom, String? inCallWith})`
  - `bool endTargetsCurrentCall({required String? from, required String? peerId})`
  - `class EarlyIceBuffer { void expect(String from); bool add(String? from, Map<String, dynamic> c); List<Map<String, dynamic>> takeFor(String peerId); void reset(); }`
  - `String? callEndNotice(AppLocalizations l10n, CallEndReason reason, {required bool byPeer, required String peerName})`
  - Các thành phần mới của `WebRTCService`:
    - getter: `String? get peerId`, `bool get micOn`, `bool get cameraOn`, `bool get speakerOn`
    - callback: `onEndNotice: void Function(CallEndReason reason, bool byPeer)?`
    - cuộc gọi đến và candidate sớm: `expectCallFrom(String)`, `handleIceCandidate(Map, {String? senderId})`
    - kết thúc cuộc gọi: `handleRemoteEnd({String? from, String? reasonWire})`, `endCall({int? duration, CallEndReason reason})`, `sendEnd({…, CallEndReason reason})`, `failLocally(CallEndReason)`
    - điều khiển: `setMicOn(bool)`, `setCameraOn(bool)`, `setSpeakerOn(bool)`, `switchCamera()`
    - hằng số `static const disconnectGrace = Duration(seconds: 8)`
  - ARB: `callDeclined(name)`, `callBusy(name)`, `callPeerMediaError(name)`, `callEnded`, `callConnectionLost`, `callSpeaker`, `callSwitchCamera`, `callHangUp`

- [ ] **Step 1: Thêm ARB keys**

```bash
cd apps/client
python3 tool/add_arb_keys.py <<'JSON'
{
  "callDeclined": {"placeholders": {"name": "String"}, "translations": {
    "en": "{name} declined the call", "vi": "{name} đã từ chối cuộc gọi", "zh": "{name} 拒绝了通话",
    "ja": "{name}さんが通話を拒否しました", "ko": "{name}님이 통화를 거절했습니다",
    "es": "{name} rechazó la llamada", "fr": "{name} a refusé l'appel"}},
  "callBusy": {"placeholders": {"name": "String"}, "translations": {
    "en": "{name} is on another call", "vi": "{name} đang bận cuộc gọi khác", "zh": "{name} 正在通话中",
    "ja": "{name}さんは別の通話中です", "ko": "{name}님이 다른 통화 중입니다",
    "es": "{name} está en otra llamada", "fr": "{name} est déjà en appel"}},
  "callPeerMediaError": {"placeholders": {"name": "String"}, "translations": {
    "en": "{name} couldn't turn on their microphone or camera", "vi": "{name} không bật được micro hoặc camera",
    "zh": "{name} 无法开启麦克风或摄像头", "ja": "{name}さんのマイクまたはカメラを起動できませんでした",
    "ko": "{name}님의 마이크 또는 카메라를 켤 수 없습니다", "es": "{name} no pudo activar su micrófono o cámara",
    "fr": "{name} n'a pas pu activer son micro ou sa caméra"}},
  "callEnded": {"translations": {
    "en": "Call ended", "vi": "Cuộc gọi đã kết thúc", "zh": "通话已结束", "ja": "通話が終了しました",
    "ko": "통화가 종료되었습니다", "es": "Llamada finalizada", "fr": "Appel terminé"}},
  "callConnectionLost": {"translations": {
    "en": "Call dropped — connection lost", "vi": "Cuộc gọi bị ngắt do mất kết nối", "zh": "连接中断，通话已结束",
    "ja": "接続が切れたため通話が終了しました", "ko": "연결이 끊겨 통화가 종료되었습니다",
    "es": "La llamada se cortó por pérdida de conexión", "fr": "Appel interrompu : connexion perdue"}},
  "callSpeaker": {"translations": {
    "en": "Speaker", "vi": "Loa ngoài", "zh": "扬声器", "ja": "スピーカー", "ko": "스피커",
    "es": "Altavoz", "fr": "Haut-parleur"}},
  "callSwitchCamera": {"translations": {
    "en": "Switch camera", "vi": "Đổi camera", "zh": "切换摄像头", "ja": "カメラを切り替え",
    "ko": "카메라 전환", "es": "Cambiar cámara", "fr": "Changer de caméra"}},
  "callHangUp": {"translations": {
    "en": "End call", "vi": "Kết thúc", "zh": "挂断", "ja": "通話を終了", "ko": "통화 종료",
    "es": "Colgar", "fr": "Raccrocher"}}
}
JSON
flutter gen-l10n
flutter test test/l10n/arb_parity_test.dart
```

Expected: script báo thêm key vào 7 file. `gen-l10n` không lỗi. Test parity PASS.

- [ ] **Step 2: Viết test.** Tạo `apps/client/test/features/chat/call_rules_test.dart`:

```dart
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/call_end_notice.dart';
import 'package:platform_client/features/chat/domain/call_rules.dart';
import 'package:platform_client/l10n/app_localizations.dart';

void main() {
  group('CallEndReason', () {
    test('round-trips the wire values shared with web', () {
      expect(CallEndReason.values.map((r) => r.wire), [
        'hangup', 'declined', 'busy', 'no_answer', 'media_error', 'failed',
      ]);
      for (final r in CallEndReason.values) {
        expect(CallEndReason.fromWire(r.wire), r);
      }
    });

    test('a missing or unknown reason (older client) is a hangup', () {
      expect(CallEndReason.fromWire(null), CallEndReason.hangup);
      expect(CallEndReason.fromWire('something-new'), CallEndReason.hangup);
    });
  });

  group('decideIncomingOffer', () {
    test('rings when idle', () {
      expect(decideIncomingOffer(from: 'a'), IncomingOfferAction.ring);
    });
    test('ignores a repeated offer from the same caller', () {
      expect(decideIncomingOffer(from: 'a', ringingFrom: 'a'), IncomingOfferAction.ignore);
      expect(decideIncomingOffer(from: 'a', inCallWith: 'a'), IncomingOfferAction.ignore);
    });
    test('replies busy to anyone else while ringing or in a call', () {
      expect(decideIncomingOffer(from: 'b', ringingFrom: 'a'), IncomingOfferAction.replyBusy);
      expect(decideIncomingOffer(from: 'b', inCallWith: 'a'), IncomingOfferAction.replyBusy);
    });
  });

  group('endTargetsCurrentCall', () {
    test('only the current peer can end the call', () {
      expect(endTargetsCurrentCall(from: 'a', peerId: 'a'), isTrue);
      expect(endTargetsCurrentCall(from: 'b', peerId: 'a'), isFalse);
      expect(endTargetsCurrentCall(from: 'a', peerId: null), isFalse);
    });
  });

  group('EarlyIceBuffer', () {
    test('keeps candidates from the ringing caller and hands them over once', () {
      final buf = EarlyIceBuffer()..expect('alice');
      expect(buf.add('alice', {'candidate': 'c1'}), isTrue);
      expect(buf.add('mallory', {'candidate': 'x'}), isFalse);
      expect(buf.add(null, {'candidate': 'y'}), isFalse);
      buf.add('alice', {'candidate': 'c2'});
      expect(buf.takeFor('alice').map((c) => c['candidate']), ['c1', 'c2']);
      expect(buf.takeFor('alice'), isEmpty);
    });

    test('drops everything when the call goes to someone else', () {
      final buf = EarlyIceBuffer()..expect('alice');
      buf.add('alice', {'candidate': 'c1'});
      expect(buf.takeFor('bob'), isEmpty);
      expect(buf.add('alice', {'candidate': 'c2'}), isFalse);
    });

    test('a new ring starts from an empty buffer', () {
      final buf = EarlyIceBuffer()..expect('alice');
      buf.add('alice', {'candidate': 'old'});
      buf.expect('alice');
      expect(buf.takeFor('alice'), isEmpty);
    });
  });

  group('callEndNotice', () {
    final l10n = lookupAppLocalizations(const Locale('en'));

    test('explains a hang-up caused by the peer', () {
      String? n(CallEndReason r) => callEndNotice(l10n, r, byPeer: true, peerName: 'Bob');
      expect(n(CallEndReason.declined), 'Bob declined the call');
      expect(n(CallEndReason.busy), 'Bob is on another call');
      expect(n(CallEndReason.mediaError), "Bob couldn't turn on their microphone or camera");
      expect(n(CallEndReason.failed), l10n.callConnectionLost);
      expect(n(CallEndReason.hangup), l10n.callEnded);
      expect(n(CallEndReason.noAnswer), isNull);
    });

    test('only explains local endings the user did not choose', () {
      String? n(CallEndReason r) => callEndNotice(l10n, r, byPeer: false, peerName: 'Bob');
      expect(n(CallEndReason.noAnswer), l10n.callNoAnswer);
      expect(n(CallEndReason.failed), l10n.callConnectionLost);
      expect(n(CallEndReason.mediaError), l10n.callMediaError);
      expect(n(CallEndReason.hangup), isNull);
      expect(n(CallEndReason.declined), isNull);
    });
  });
}
```

- [ ] **Step 3: Chạy để thấy test thất bại**

Run: `cd apps/client && flutter test test/features/chat/call_rules_test.dart`
Expected: FAIL. Compile error, không tìm thấy `call_rules.dart`.

- [ ] **Step 4: Tạo `apps/client/lib/features/chat/domain/call_rules.dart`**

```dart
/// Pure 1-on-1 call rules, shared by the signal handler and WebRTCService.
/// Mirrors web `lib/webrtc/call-manager.ts` / `call-end-notice.ts`.
library;

/// Why a call ended. Sent as `reason` on the `end` signal (relayed verbatim
/// by chat-service). A missing reason (older client) means [hangup].
enum CallEndReason {
  hangup('hangup'),
  declined('declined'),
  busy('busy'),
  noAnswer('no_answer'),
  mediaError('media_error'),
  failed('failed');

  const CallEndReason(this.wire);
  final String wire;

  static CallEndReason fromWire(String? value) => CallEndReason.values
      .firstWhere((r) => r.wire == value, orElse: () => CallEndReason.hangup);
}

enum IncomingOfferAction { ring, ignore, replyBusy }

/// What to do with an incoming offer from [from] while possibly already
/// ringing ([ringingFrom]) or in a call ([inCallWith]).
IncomingOfferAction decideIncomingOffer({
  required String from,
  String? ringingFrom,
  String? inCallWith,
}) {
  if (ringingFrom == from || inCallWith == from) return IncomingOfferAction.ignore;
  if (ringingFrom != null || inCallWith != null) return IncomingOfferAction.replyBusy;
  return IncomingOfferAction.ring;
}

/// A stray/late `end` from anyone but the current peer must not end the call.
bool endTargetsCurrentCall({required String? from, required String? peerId}) =>
    from != null && peerId != null && from == peerId;

/// ICE candidates the caller trickles right after its offer, while we are
/// still ringing and have no peer connection. Dropping them made calls across
/// NATs connect without audio; they are applied once the call is answered.
class EarlyIceBuffer {
  String? _from;
  final List<Map<String, dynamic>> _items = [];

  /// A new ring from [from]: start an empty buffer for it.
  void expect(String from) {
    _from = from;
    _items.clear();
  }

  /// Keeps [candidate] if it comes from the caller being expected.
  bool add(String? from, Map<String, dynamic> candidate) {
    if (from == null || from != _from) return false;
    _items.add(candidate);
    return true;
  }

  /// Hands over the buffered candidates if the call is with [peerId], then
  /// resets. A call to anyone else gets nothing.
  List<Map<String, dynamic>> takeFor(String peerId) {
    final out = peerId == _from ? List.of(_items) : <Map<String, dynamic>>[];
    reset();
    return out;
  }

  void reset() {
    _from = null;
    _items.clear();
  }
}
```

- [ ] **Step 5: Tạo `apps/client/lib/features/chat/domain/call_end_notice.dart`**

```dart
import '../../../l10n/app_localizations.dart';
import 'call_rules.dart';

/// The message (if any) explaining why a call ended. [byPeer] = the other side
/// ended it. Endings the user chose themselves need no explanation. Mirrors
/// web `endNoticeKey` (`lib/webrtc/call-end-notice.ts`).
String? callEndNotice(
  AppLocalizations l10n,
  CallEndReason reason, {
  required bool byPeer,
  required String peerName,
}) {
  if (byPeer) {
    return switch (reason) {
      CallEndReason.declined => l10n.callDeclined(peerName),
      CallEndReason.busy => l10n.callBusy(peerName),
      CallEndReason.mediaError => l10n.callPeerMediaError(peerName),
      CallEndReason.failed => l10n.callConnectionLost,
      CallEndReason.hangup => l10n.callEnded,
      CallEndReason.noAnswer => null,
    };
  }
  return switch (reason) {
    CallEndReason.noAnswer => l10n.callNoAnswer,
    CallEndReason.failed => l10n.callConnectionLost,
    CallEndReason.mediaError => l10n.callMediaError,
    _ => null,
  };
}
```

Chạy lại: `flutter test test/features/chat/call_rules_test.dart`. Expected: PASS.

- [ ] **Step 6: Thay toàn bộ `apps/client/lib/features/chat/domain/webrtc_service.dart`**

```dart
import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../data/stomp_service.dart';
import 'call_rules.dart';

/// 1-1 WebRTC (audio + video) over the chat-service STOMP signaling channel.
///
/// Uses the modern **Unified Plan** API (`addTrack` / `onTrack`) — the legacy
/// Plan-B `addStream` / `onAddStream` does NOT fire on flutter_webrtc 0.12+,
/// which is why remote video never showed before.
class WebRTCService {
  final StompService _stompService;
  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;

  Function(MediaStream)? onLocalStream;
  Function(MediaStream)? onRemoteStream;
  Function()? onCallEnded;

  /// Fired when a call ends, so the UI can explain why (see `callEndNotice`).
  /// `byPeer` = the other side ended it.
  void Function(CallEndReason reason, bool byPeer)? onEndNotice;

  String? _targetId;
  String? _conversationId;

  /// Whether this call uses video. Set from [initialize]. For incoming calls
  /// it is derived from whether the remote offer SDP contains an `m=video`
  /// section, so we don't needlessly open the camera on a voice-only call.
  bool _isVideo = true;

  /// Whether the call ever reached the connected state (remote SDP applied).
  /// Used to decide between an "ended" vs "missed" call system message.
  bool _connected = false;

  /// When remote media first arrived — the call duration is measured from it.
  DateTime? _mediaSince;

  /// Send the chat system message that logs the call in history. Returns
  /// `system.call.ended:{kind}:{secs}` or `system.call.missed:{kind}`.
  /// Mirrors web `call-manager.ts` so both platforms render identically.
  /// Only the hang-up initiator should invoke this (see [endCall]).
  Function(String content)? onSendCallLog;

  /// ICE candidates that arrive before the remote description is set must be
  /// buffered, otherwise `addCandidate` throws. Flushed once remote SDP applied.
  final List<RTCIceCandidate> _pendingCandidates = [];
  bool _remoteDescriptionSet = false;

  /// Candidates the caller sent while we were still ringing (no peer
  /// connection yet). See [EarlyIceBuffer].
  final EarlyIceBuffer _early = EarlyIceBuffer();

  Timer? _disconnectTimer;
  bool _micOn = true;
  bool _cameraOn = true;
  bool _speakerOn = false;

  WebRTCService(this._stompService);

  /// True while a 1-on-1 call holds a peer connection (ringing or connected).
  bool get isActive => _peerConnection != null;

  /// The other party of the active call, or null.
  String? get peerId => isActive ? _targetId : null;

  bool get micOn => _micOn;
  bool get cameraOn => _cameraOn;
  bool get speakerOn => _speakerOn;

  /// How long an outgoing call rings before it is given up as missed. There
  /// is no server-side ring state, so without this the caller sat on
  /// "Calling…" forever whenever the callee was offline or never answered.
  /// Mirrors web `RING_TIMEOUT_MS` in `call-manager.ts`.
  static const ringTimeout = Duration(seconds: 45);

  /// Callee-side safety net, slightly longer than the caller's ring.
  static const incomingRingTimeout = Duration(seconds: 50);

  /// How long a `disconnected` connection may recover before the call ends.
  /// Mirrors web `DISCONNECT_GRACE_MS`.
  static const disconnectGrace = Duration(seconds: 8);

  /// The `system.call.missed:{kind}` call-log content (see [endCall]).
  static String missedCallLog({required bool isVideo}) =>
      'system.call.missed:${isVideo ? 'video' : 'voice'}';

  /// Tell [targetId] the call is over and why. Used directly when declining
  /// or rejecting (busy) a call that never got a peer connection.
  void sendEnd({
    required String targetId,
    required String conversationId,
    int duration = 0,
    CallEndReason reason = CallEndReason.hangup,
  }) {
    _stompService.sendRawMessage(
      destination: '/app/call.end',
      body: jsonEncode({
        'targetId': targetId,
        'conversationId': conversationId,
        'type': 'end',
        'reason': reason.wire,
        'duration': duration,
      }),
    );
  }

  /// True when the SDP advertises a video media section (`m=video`). Used to
  /// decide whether an incoming call should open the camera.
  static bool sdpHasVideo(String? sdp) =>
      sdp != null && sdp.contains('m=video');

  /// A call from [senderId] is ringing: keep its early ICE candidates.
  void expectCallFrom(String senderId) => _early.expect(senderId);

  Future<void> initialize(
    String targetId,
    String conversationId, {
    bool isVideo = true,
  }) async {
    _targetId = targetId;
    _conversationId = conversationId;
    _isVideo = isVideo;
    _remoteDescriptionSet = false;
    _connected = false;
    _mediaSince = null;
    _micOn = true;
    _cameraOn = isVideo;
    _pendingCandidates.clear();

    final pc = await createPeerConnection({
      'iceServers': [
        {
          'urls': [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
          ],
        },
      ],
      'sdpSemantics': 'unified-plan',
    });
    _peerConnection = pc;
    // Candidates the caller sent while we were ringing.
    _pendingCandidates.addAll(_early.takeFor(targetId).map(_toCandidate));

    pc.onIceCandidate = (RTCIceCandidate candidate) {
      _stompService.sendRawMessage(
        destination: '/app/call.ice',
        body: jsonEncode({
          'targetId': _targetId,
          'conversationId': _conversationId,
          'type': 'ice',
          'candidate': {
            'candidate': candidate.candidate,
            'sdpMid': candidate.sdpMid,
            'sdpMLineIndex': candidate.sdpMLineIndex,
          }
        }),
      );
    };

    // Unified Plan: remote media arrives track-by-track via onTrack.
    pc.onTrack = (RTCTrackEvent event) {
      if (event.streams.isNotEmpty) {
        _mediaSince ??= DateTime.now();
        onRemoteStream?.call(event.streams.first);
      }
    };

    pc.onConnectionState = (RTCPeerConnectionState state) {
      if (_peerConnection != pc) return;
      switch (state) {
        case RTCPeerConnectionState.RTCPeerConnectionStateConnected:
          _disconnectTimer?.cancel();
          _disconnectTimer = null;
        case RTCPeerConnectionState.RTCPeerConnectionStateDisconnected:
          // Often transient (Wi-Fi ↔ 4G): give it a chance to recover.
          _disconnectTimer ??= Timer(disconnectGrace, () {
            _disconnectTimer = null;
            if (_peerConnection == pc) endCall(reason: CallEndReason.failed);
          });
        case RTCPeerConnectionState.RTCPeerConnectionStateFailed:
          endCall(reason: CallEndReason.failed);
        default:
          break;
      }
    };

    _localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': _isVideo,
    });
    onLocalStream?.call(_localStream!);

    // Unified Plan: add each track individually (not the whole stream).
    for (final track in _localStream!.getTracks()) {
      await pc.addTrack(track, _localStream!);
    }

    // Video calls are held at arm's length → loudspeaker; voice → earpiece.
    await setSpeakerOn(_isVideo);
  }

  Future<void> makeCall() async {
    RTCSessionDescription offer = await _peerConnection!.createOffer();
    await _peerConnection!.setLocalDescription(offer);

    _stompService.sendRawMessage(
      destination: '/app/call.offer',
      body: jsonEncode({
        'targetId': _targetId,
        'conversationId': _conversationId,
        'type': 'offer',
        'sdp': offer.sdp,
      }),
    );
  }

  Future<void> handleOffer(String sdp) async {
    _connected = true;
    await _peerConnection!
        .setRemoteDescription(RTCSessionDescription(sdp, 'offer'));
    await _flushPendingCandidates();

    RTCSessionDescription answer = await _peerConnection!.createAnswer();
    await _peerConnection!.setLocalDescription(answer);

    _stompService.sendRawMessage(
      destination: '/app/call.answer',
      body: jsonEncode({
        'targetId': _targetId,
        'conversationId': _conversationId,
        'type': 'answer',
        'sdp': answer.sdp,
      }),
    );
  }

  Future<void> handleAnswer(String sdp) async {
    if (_peerConnection == null) return;
    _connected = true;
    await _peerConnection!
        .setRemoteDescription(RTCSessionDescription(sdp, 'answer'));
    await _flushPendingCandidates();
  }

  Future<void> handleIceCandidate(
    Map<String, dynamic> candidateMap, {
    String? senderId,
  }) async {
    if (_peerConnection == null) {
      _early.add(senderId, candidateMap);
      return;
    }
    final candidate = _toCandidate(candidateMap);
    // Buffer until the remote description exists, else addCandidate throws.
    if (!_remoteDescriptionSet) {
      _pendingCandidates.add(candidate);
      return;
    }
    await _peerConnection!.addCandidate(candidate);
  }

  static RTCIceCandidate _toCandidate(Map<String, dynamic> m) => RTCIceCandidate(
        m['candidate'] as String?,
        m['sdpMid'] as String?,
        m['sdpMLineIndex'] as int?,
      );

  Future<void> _flushPendingCandidates() async {
    _remoteDescriptionSet = true;
    for (final c in _pendingCandidates) {
      await _peerConnection?.addCandidate(c);
    }
    _pendingCandidates.clear();
  }

  /// The peer sent `end`. Only the current peer can end the active call;
  /// a ringing caller cancelling just drops its early candidates.
  void handleRemoteEnd({String? from, String? reasonWire}) {
    if (!isActive) {
      _early.reset();
      return;
    }
    if (!endTargetsCurrentCall(from: from, peerId: peerId)) return;
    final reason = CallEndReason.fromWire(reasonWire);
    if (reason == CallEndReason.busy) {
      // The callee never rang: log the attempt as a missed call.
      onSendCallLog?.call(missedCallLog(isVideo: _isVideo));
    }
    onEndNotice?.call(reason, true);
    dispose();
  }

  /// Hang up / give up: tell the peer why, log the call, tear down.
  /// [duration] defaults to the time since remote media arrived.
  Future<void> endCall({
    int? duration,
    CallEndReason reason = CallEndReason.hangup,
  }) async {
    final secs = duration ??
        (_mediaSince == null
            ? 0
            : DateTime.now().difference(_mediaSince!).inSeconds);
    final targetId = _targetId;
    final conversationId = _conversationId;
    if (targetId != null && conversationId != null) {
      sendEnd(
        targetId: targetId,
        conversationId: conversationId,
        duration: secs,
        reason: reason,
      );
    }

    // Emit a system message so both sides see the call log in chat history.
    // Only the hang-up initiator runs this (the peer tears down via dispose()),
    // so the call is logged exactly once. Mirrors web call-manager.ts format
    // `system.call.ended:{kind}:{secs}` / `system.call.missed:{kind}`.
    final content = _connected
        ? 'system.call.ended:${_isVideo ? 'video' : 'voice'}:$secs'
        : missedCallLog(isVideo: _isVideo);
    onSendCallLog?.call(content);

    onEndNotice?.call(reason, false);
    dispose();
  }

  /// Tear down a call that never reached the peer (e.g. our own mic/camera
  /// failed before the offer was sent): no signal, no call log.
  void failLocally(CallEndReason reason) {
    onEndNotice?.call(reason, false);
    dispose();
  }

  Future<void> setMicOn(bool on) async {
    _micOn = on;
    for (final t in _localStream?.getAudioTracks() ?? <MediaStreamTrack>[]) {
      t.enabled = on;
    }
  }

  Future<void> setCameraOn(bool on) async {
    _cameraOn = on;
    for (final t in _localStream?.getVideoTracks() ?? <MediaStreamTrack>[]) {
      t.enabled = on;
    }
  }

  Future<void> setSpeakerOn(bool on) async {
    _speakerOn = on;
    await Helper.setSpeakerphoneOn(on);
  }

  Future<void> switchCamera() async {
    final tracks = _localStream?.getVideoTracks() ?? <MediaStreamTrack>[];
    if (tracks.isNotEmpty) await Helper.switchCamera(tracks.first);
  }

  void dispose() {
    _disconnectTimer?.cancel();
    _disconnectTimer = null;
    for (final track in _localStream?.getTracks() ?? <MediaStreamTrack>[]) {
      track.stop();
    }
    _localStream?.dispose();
    _localStream = null;
    final pc = _peerConnection;
    _peerConnection = null; // before close(): no re-entry from onConnectionState
    pc?.close();
    pc?.dispose();
    _pendingCandidates.clear();
    _remoteDescriptionSet = false;
    _early.reset();
    _mediaSince = null;
    onCallEnded?.call();
  }
}

final webRtcServiceProvider = Provider<WebRTCService>((ref) {
  return WebRTCService(ref.watch(stompServiceProvider.notifier));
});
```

- [ ] **Step 7: Analyze và test**

```bash
cd apps/client
flutter analyze lib/features/chat/domain
flutter test test/features/chat
```

Expected: `No issues found!`. Test PASS. `call_screen.dart` có thể báo lỗi analyze ở chỗ gọi `endCall(duration: …)`: chữ ký vẫn tương thích, nên nếu có lỗi thì sửa ở Task 7.

- [ ] **Step 8: Commit**

```bash
git add apps/client/lib/features/chat/domain apps/client/lib/l10n apps/client/test/features/chat/call_rules_test.dart
git commit -m "fix(mobile/call): keep early ICE, end reasons, connection health and media controls in WebRTCService"
```

---

### Task 6: Flutter — xử lý tín hiệu, bận, chuông và rung phía B

**Files:**
- Create: `apps/client/lib/features/chat/domain/call_sounds.dart`
- Modify: `apps/client/lib/features/chat/domain/conversations_realtime_handlers.dart`
- Modify: `apps/client/lib/features/chat/domain/incoming_call.dart`
- Modify: `apps/client/lib/features/chat/ui/widgets/incoming_call_prompt.dart`
- Test: `apps/client/test/features/chat/call_sounds_test.dart`; cập nhật `apps/client/test/features/chat/incoming_call_test.dart`

**Interfaces:**
- Consumes: `decideIncomingOffer`, `CallEndReason`, các method của `WebRTCService` (Task 5); asset `sounds/*.wav` (Task 2).
- Produces:
  - `enum CallTone { ringtone, ringback }`
  - `abstract class TonePlayer { Future<void> loop(CallTone tone, {bool speaker}); Future<void> stop(); }`
  - `class CallSounds { CallSounds(TonePlayer player, {void Function()? vibrate, Duration vibrateEvery}); Future<void> play(CallTone tone, {bool speaker = false}); Future<void> stop(); }`
  - `final callSoundsProvider = Provider<CallSounds>`

- [ ] **Step 1: Viết test.** Tạo `apps/client/test/features/chat/call_sounds_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/call_sounds.dart';

class FakeTonePlayer implements TonePlayer {
  final calls = <String>[];
  @override
  Future<void> loop(CallTone tone, {bool speaker = false}) async =>
      calls.add('loop:${tone.name}:$speaker');
  @override
  Future<void> stop() async => calls.add('stop');
}

void main() {
  late FakeTonePlayer player;
  late int vibrations;
  late CallSounds sounds;

  setUp(() {
    player = FakeTonePlayer();
    vibrations = 0;
    sounds = CallSounds(player,
        vibrate: () => vibrations++,
        vibrateEvery: const Duration(milliseconds: 1500));
  });

  testWidgets('the ringtone loops and vibrates until stopped', (tester) async {
    await sounds.play(CallTone.ringtone);
    expect(player.calls, ['loop:ringtone:false']);
    expect(vibrations, 1);

    await tester.pump(const Duration(milliseconds: 3000));
    expect(vibrations, 3);

    await sounds.stop();
    await tester.pump(const Duration(milliseconds: 3000));
    expect(vibrations, 3);
    expect(player.calls.last, 'stop');
  });

  testWidgets('ringback does not vibrate and honours the speaker route',
      (tester) async {
    await sounds.play(CallTone.ringback, speaker: true);
    await tester.pump(const Duration(seconds: 5));
    expect(vibrations, 0);
    expect(player.calls, ['loop:ringback:true']);
    await sounds.stop();
  });

  testWidgets('playing the same tone twice does not restart it', (tester) async {
    await sounds.play(CallTone.ringtone);
    await sounds.play(CallTone.ringtone);
    expect(player.calls, ['loop:ringtone:false']);
    await sounds.stop();
  });

  testWidgets('stop without a tone does nothing', (tester) async {
    await sounds.stop();
    expect(player.calls, isEmpty);
  });
}
```

- [ ] **Step 2: Chạy để thấy test thất bại**

Run: `cd apps/client && flutter test test/features/chat/call_sounds_test.dart`
Expected: FAIL. Không tìm thấy `call_sounds.dart`.

- [ ] **Step 3: Tạo `apps/client/lib/features/chat/domain/call_sounds.dart`**

```dart
import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Call tones in `assets/sounds/` (generated by tool/gen_call_tones.py).
enum CallTone { ringtone, ringback }

/// Plays a looping tone. Abstracted so [CallSounds] is testable without the
/// audio platform channel.
abstract class TonePlayer {
  Future<void> loop(CallTone tone, {bool speaker = false});
  Future<void> stop();
}

class AudioplayersTonePlayer implements TonePlayer {
  final AudioPlayer _player = AudioPlayer();

  @override
  Future<void> loop(CallTone tone, {bool speaker = false}) async {
    await _player.stop();
    await _player.setAudioContext(tone == CallTone.ringtone
        // Ringtone obeys the iPhone silent switch (vibration still runs).
        ? AudioContextConfig(respectSilence: true).build()
        // Ringback plays while WebRTC holds the mic: mix, don't steal focus.
        : AudioContextConfig(
            route: speaker
                ? AudioContextConfigRoute.speaker
                : AudioContextConfigRoute.earpiece,
            focus: AudioContextConfigFocus.mixWithOthers,
          ).build());
    await _player.setReleaseMode(ReleaseMode.loop);
    await _player.play(AssetSource('sounds/${tone.name}.wav'));
  }

  @override
  Future<void> stop() => _player.stop();
}

/// Ringtone (+ vibration) for the callee, ringback for the caller.
class CallSounds {
  CallSounds(
    this._player, {
    void Function()? vibrate,
    this.vibrateEvery = const Duration(milliseconds: 1500),
  }) : _vibrate = vibrate ?? HapticFeedback.vibrate;

  final TonePlayer _player;
  final void Function() _vibrate;
  final Duration vibrateEvery;
  CallTone? _current;
  Timer? _vibrateTimer;

  Future<void> play(CallTone tone, {bool speaker = false}) async {
    if (_current == tone) return;
    await stop();
    _current = tone;
    if (tone == CallTone.ringtone) {
      _vibrate();
      _vibrateTimer = Timer.periodic(vibrateEvery, (_) => _vibrate());
    }
    try {
      await _player.loop(tone, speaker: speaker);
      // stop() may have run while loop() was starting the player.
      if (_current != tone) await _player.stop();
    } catch (e) {
      debugPrint('call tone failed: $e');
    }
  }

  Future<void> stop() async {
    _vibrateTimer?.cancel();
    _vibrateTimer = null;
    if (_current == null) return;
    _current = null;
    try {
      await _player.stop();
    } catch (_) {
      // best-effort
    }
  }
}

final callSoundsProvider = Provider<CallSounds>((ref) {
  final sounds = CallSounds(AudioplayersTonePlayer());
  ref.onDispose(sounds.stop);
  return sounds;
});
```

Chạy lại: `flutter test test/features/chat/call_sounds_test.dart`. Expected: PASS.

- [ ] **Step 4: Chuông và rung theo prompt.** Trong `apps/client/lib/features/chat/domain/incoming_call.dart`:
  - Thêm `import 'call_sounds.dart';`
  - Trong `set(IncomingCall call)`: sau `state = call;` thêm `unawaited(ref.read(callSoundsProvider).play(CallTone.ringtone));` (file đã import `dart:async`)
  - Trong `clear()`: sau `state = null;` thêm `unawaited(ref.read(callSoundsProvider).stop());`

- [ ] **Step 5: Cập nhật `incoming_call_test.dart` để không đụng tới audio thật.** Thêm import:

```dart
import 'package:platform_client/features/chat/domain/call_sounds.dart';
```

Thêm vào đầu file (sau `_call`):

```dart
class _SilentPlayer implements TonePlayer {
  int loops = 0;
  int stops = 0;
  @override
  Future<void> loop(CallTone tone, {bool speaker = false}) async => loops++;
  @override
  Future<void> stop() async => stops++;
}

ProviderContainer _container(_SilentPlayer player) => ProviderContainer(overrides: [
      callSoundsProvider.overrideWithValue(CallSounds(player, vibrate: () {})),
    ]);
```

Thay mọi `ProviderContainer()` bằng `_container(_SilentPlayer())`, rồi thêm test:

```dart
  testWidgets('ringing starts with the prompt and stops when it clears',
      (tester) async {
    final player = _SilentPlayer();
    final container = _container(player);
    addTearDown(container.dispose);
    final notifier = container.read(incomingCallProvider.notifier);

    notifier.set(_call);
    await tester.pump();
    expect(player.loops, 1);

    notifier.clearFrom('caller');
    await tester.pump();
    expect(player.stops, 1);
  });
```

Chạy: `flutter test test/features/chat/incoming_call_test.dart`. Expected: PASS (5 test).

- [ ] **Step 6: Handler tín hiệu.** Trong `conversations_realtime_handlers.dart`:
  - Thêm `import 'call_rules.dart';`
  - Khai báo `final webrtc = ref.read(webRtcServiceProvider);` ngay sau dòng `if (type == 'call-ring' || signal['callId'] != null) return;`. Trong nhánh `else` cũ thì bỏ dòng `final webrtc = …` bị trùng.
  - Thay khối kiểm tra trong `if (type == 'offer')`. Đây là khối bắt đầu bằng `// Already ringing or in a call → ignore…` và kết thúc ở `.set(IncomingCall(…));`. Thay bằng:

```dart
      switch (decideIncomingOffer(
        from: senderId,
        ringingFrom: ref.read(incomingCallProvider)?.senderId,
        inCallWith: webrtc.peerId,
      )) {
        case IncomingOfferAction.ignore:
          return; // the same caller re-sent its offer
        case IncomingOfferAction.replyBusy:
          webrtc.sendEnd(
            targetId: senderId,
            conversationId: convId,
            reason: CallEndReason.busy,
          );
          return;
        case IncomingOfferAction.ring:
          // Keep the caller's early ICE until the call is answered.
          webrtc.expectCallFrom(senderId);
          ref.read(incomingCallProvider.notifier).set(IncomingCall(
                senderId: senderId,
                conversationId: convId,
                sdp: sdp,
                isVideo: WebRTCService.sdpHasVideo(sdp),
              ));
      }
```

  - Nhánh `ice`: `webrtc.handleIceCandidate(Map<String, dynamic>.from(candidate), senderId: signal['senderId'] as String?);`
  - Nhánh `end`: thay `webrtc.dispose();` bằng `webrtc.handleRemoteEnd(from: signal['senderId'] as String?, reasonWire: signal['reason'] as String?);`. Giữ nguyên dòng `clearFrom(...)`.

- [ ] **Step 7: Từ chối có lý do.** Trong `incoming_call_prompt.dart`:
  - Thêm `import '../../domain/call_rules.dart';`
  - Trong `_decline`, đổi lời gọi `sendEnd(...)` thành:

```dart
    ref.read(webRtcServiceProvider).sendEnd(
          targetId: call.senderId,
          conversationId: call.conversationId,
          reason: CallEndReason.declined,
        );
```

- [ ] **Step 8: Analyze và test**

```bash
cd apps/client
flutter analyze
flutter test test/features/chat
```

Expected: `No issues found!` (nếu `call_screen.dart` còn lỗi thì để Task 7 xử lý). Test PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/client/lib/features/chat apps/client/test/features/chat
git commit -m "feat(mobile/call): ring and vibrate for incoming calls, reply busy, decline with a reason"
```

---

### Task 7: Flutter — màn hình gọi: tút chờ, thông báo kết thúc, lỗi quyền, nút điều khiển

**Files:**
- Create: `apps/client/lib/features/chat/ui/widgets/call_controls.dart`
- Modify: `apps/client/lib/features/chat/presentation/call_screen.dart`
- Test: `apps/client/test/features/chat/call_controls_test.dart`

**Interfaces:**
- Consumes: `WebRTCService.onEndNotice / endCall(reason:) / failLocally / setMicOn / setCameraOn / setSpeakerOn / switchCamera`, `callEndNotice`, `CallSounds` (Task 5–6), `showInfoSnackBar` / `showErrorSnackBar` (`core/utils/global_messenger.dart`).
- Produces: `class CallControls extends StatelessWidget` với các tham số `isVideo, micOn, cameraOn, speakerOn, onToggleMic, onToggleCamera, onSwitchCamera, onToggleSpeaker, onHangUp`.

- [ ] **Step 1: Viết test widget.** Tạo `apps/client/test/features/chat/call_controls_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/ui/widgets/call_controls.dart';
import 'package:platform_client/l10n/app_localizations.dart';

Widget _wrap(Widget child) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

void main() {
  testWidgets('voice call: mic, speaker and hang-up', (tester) async {
    final taps = <String>[];
    await tester.pumpWidget(_wrap(CallControls(
      isVideo: false,
      micOn: true,
      cameraOn: false,
      speakerOn: false,
      onToggleMic: () => taps.add('mic'),
      onToggleCamera: () => taps.add('cam'),
      onSwitchCamera: () => taps.add('switch'),
      onToggleSpeaker: () => taps.add('speaker'),
      onHangUp: () => taps.add('hangup'),
    )));
    expect(find.byTooltip('Toggle microphone'), findsOneWidget);
    expect(find.byTooltip('Speaker'), findsOneWidget);
    expect(find.byTooltip('Toggle camera'), findsNothing);
    expect(find.byTooltip('Switch camera'), findsNothing);

    await tester.tap(find.byTooltip('Toggle microphone'));
    await tester.tap(find.byTooltip('Speaker'));
    await tester.tap(find.byTooltip('End call'));
    expect(taps, ['mic', 'speaker', 'hangup']);
  });

  testWidgets('video call: mic, camera, switch camera and hang-up',
      (tester) async {
    final taps = <String>[];
    await tester.pumpWidget(_wrap(CallControls(
      isVideo: true,
      micOn: false,
      cameraOn: true,
      speakerOn: true,
      onToggleMic: () => taps.add('mic'),
      onToggleCamera: () => taps.add('cam'),
      onSwitchCamera: () => taps.add('switch'),
      onToggleSpeaker: () => taps.add('speaker'),
      onHangUp: () => taps.add('hangup'),
    )));
    expect(find.byTooltip('Speaker'), findsNothing);
    expect(find.byIcon(Icons.mic_off_rounded), findsOneWidget); // mic is off

    await tester.tap(find.byTooltip('Toggle camera'));
    await tester.tap(find.byTooltip('Switch camera'));
    expect(taps, ['cam', 'switch']);
  });
}
```

- [ ] **Step 2: Chạy để thấy test thất bại**

Run: `cd apps/client && flutter test test/features/chat/call_controls_test.dart`
Expected: FAIL. Không tìm thấy `call_controls.dart`.

- [ ] **Step 3: Tạo `apps/client/lib/features/chat/ui/widgets/call_controls.dart`**

```dart
import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n_ext.dart';

/// Bottom controls of the 1-on-1 call screen. Voice: mic · speaker · hang up.
/// Video: mic · camera · switch camera · hang up (video uses the loudspeaker).
/// Mirrors the web VoiceCallModal / VideoCallModal controls.
class CallControls extends StatelessWidget {
  const CallControls({
    super.key,
    required this.isVideo,
    required this.micOn,
    required this.cameraOn,
    required this.speakerOn,
    required this.onToggleMic,
    required this.onToggleCamera,
    required this.onSwitchCamera,
    required this.onToggleSpeaker,
    required this.onHangUp,
  });

  final bool isVideo;
  final bool micOn;
  final bool cameraOn;
  final bool speakerOn;
  final VoidCallback onToggleMic;
  final VoidCallback onToggleCamera;
  final VoidCallback onSwitchCamera;
  final VoidCallback onToggleSpeaker;
  final VoidCallback onHangUp;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _RoundButton(
          tooltip: l10n.callToggleMic,
          icon: micOn ? Icons.mic_rounded : Icons.mic_off_rounded,
          active: !micOn,
          onPressed: onToggleMic,
        ),
        if (isVideo) ...[
          _RoundButton(
            tooltip: l10n.callToggleCam,
            icon: cameraOn ? Icons.videocam_rounded : Icons.videocam_off_rounded,
            active: !cameraOn,
            onPressed: onToggleCamera,
          ),
          _RoundButton(
            tooltip: l10n.callSwitchCamera,
            icon: Icons.cameraswitch_rounded,
            active: false,
            onPressed: onSwitchCamera,
          ),
        ] else
          _RoundButton(
            tooltip: l10n.callSpeaker,
            icon: speakerOn ? Icons.volume_up_rounded : Icons.hearing_rounded,
            active: speakerOn,
            onPressed: onToggleSpeaker,
          ),
        Tooltip(
          message: l10n.callHangUp,
          child: FloatingActionButton(
            heroTag: 'end_call',
            backgroundColor: Theme.of(context).colorScheme.error,
            onPressed: onHangUp,
            child: const Icon(Icons.call_end_rounded, color: Colors.white, size: 32),
          ),
        ),
      ],
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.tooltip,
    required this.icon,
    required this.active,
    required this.onPressed,
  });

  final String tooltip;
  final IconData icon;

  /// Highlighted (white disc, dark icon) when the toggle is in its
  /// non-default state — e.g. mic muted, speaker on. White-on-media is the
  /// call screen's deliberate exception to theme tokens.
  final bool active;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: active ? Colors.white : Colors.white.withValues(alpha: 0.15),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: SizedBox(
            width: 56,
            height: 56,
            child: Icon(icon, color: active ? Colors.black : Colors.white, size: 26),
          ),
        ),
      ),
    );
  }
}
```

Chạy lại: `flutter test test/features/chat/call_controls_test.dart`. Expected: PASS.

- [ ] **Step 4: Sửa `call_screen.dart`**
  - Thêm import:

```dart
import '../../../core/utils/global_messenger.dart';
import '../domain/call_end_notice.dart';
import '../domain/call_rules.dart';
import '../domain/call_sounds.dart';
import '../ui/widgets/call_controls.dart';
```

  - Trong `_initWebRTC()`, ngay sau `final webrtc = ref.read(webRtcServiceProvider);` thêm:

```dart
    final sounds = _sounds; // read in initState (see below)
    // Resolve strings now: the screen may be gone when the notice fires.
    final l10n = context.l10n;
    final peerName = widget.targetName;
    webrtc.onEndNotice = (reason, byPeer) {
      unawaited(sounds.stop());
      final msg = callEndNotice(l10n, reason,
          byPeer: byPeer, peerName: peerName);
      if (msg == null) return;
      if (reason == CallEndReason.failed || reason == CallEndReason.mediaError) {
        showErrorSnackBar(msg);
      } else {
        showInfoSnackBar(msg);
      }
    };
```

  - Trong `webrtc.onRemoteStream`, trước `_startTimer();` thêm `unawaited(sounds.stop());` (file đã import `dart:async`).
  - Trong khối `if (widget.isCaller)`, sau `await webrtc.makeCall();` thêm:

```dart
        unawaited(sounds.play(CallTone.ringback, speaker: effectiveVideo));
```

  - Thay toàn bộ khối `catch (e) { … }` của `_initWebRTC` bằng:

```dart
    } catch (e) {
      // Mic/camera denied or missing. The callee tells the caller (and logs a
      // missed call); a caller whose offer never left just tears down.
      if (widget.isCaller) {
        webrtc.failLocally(CallEndReason.mediaError);
      } else {
        webrtc.endCall(reason: CallEndReason.mediaError);
      }
    }
```

  `failLocally` / `endCall` gọi `dispose()`, `dispose()` kích hoạt `onCallEnded`, và `onCallEnded` sẽ pop màn hình. `onEndNotice` hiện thông báo lỗi bằng `showErrorSnackBar`. Vì vậy **không** pop thủ công ở đây.

  - Thay `_onRingTimeout`:

```dart
  /// Nobody picked up within [WebRTCService.ringTimeout]: give up (which tells
  /// the callee, logs a missed call and shows "No answer" via onEndNotice).
  void _onRingTimeout() {
    if (!mounted || _isConnected) return;
    ref.read(webRtcServiceProvider).endCall(reason: CallEndReason.noAnswer);
  }
```

  - `_endCall()` giữ nguyên lời gọi `endCall(duration: _durationSeconds)` (reason mặc định là `hangup`).
  - Khai báo field `late final CallSounds _sounds;`, gán `_sounds = ref.read(callSoundsProvider);` trong `initState()` (trước `_initWebRTC()`), và trong `dispose()` của state, trước `super.dispose();` thêm `unawaited(_sounds.stop());` (không dùng `ref` trong `dispose`).
  - Thay khối `// Controls` (Positioned chứa `FloatingActionButton` cũ) bằng:

```dart
          // Controls
          Positioned(
            bottom: 40,
            left: 16,
            right: 16,
            child: Builder(builder: (context) {
              final webrtc = ref.read(webRtcServiceProvider);
              return CallControls(
                isVideo: _isVideoCall,
                micOn: webrtc.micOn,
                cameraOn: webrtc.cameraOn,
                speakerOn: webrtc.speakerOn,
                onToggleMic: () async {
                  await webrtc.setMicOn(!webrtc.micOn);
                  setState(() {});
                },
                onToggleCamera: () async {
                  await webrtc.setCameraOn(!webrtc.cameraOn);
                  setState(() {});
                },
                onSwitchCamera: webrtc.switchCamera,
                onToggleSpeaker: () async {
                  await webrtc.setSpeakerOn(!webrtc.speakerOn);
                  setState(() {});
                },
                onHangUp: _endCall,
              );
            }),
          ),
```

- [ ] **Step 5: Kiểm tra số dòng và analyze**

```bash
cd apps/client
wc -l lib/features/chat/presentation/call_screen.dart lib/features/chat/domain/webrtc_service.dart lib/features/chat/ui/widgets/call_controls.dart
flutter analyze
flutter test
```

Expected: mọi file ≤ 400 dòng, `No issues found!`, toàn bộ test PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/client/lib/features/chat apps/client/test/features/chat
git commit -m "feat(mobile/call): ringback, end-reason notices, permission failure handling and in-call controls"
```

---

### Task 8: Kiểm tra toàn bộ và cập nhật tài liệu

**Files:**
- Modify: `docs/superpowers/plans/README.md`: chuyển dòng của plan này từ mục PENDING sang mục Done, ghi commit cuối và kết quả Task 9

- [ ] **Step 1: Chạy toàn bộ bộ kiểm tra**

```bash
(cd apps/server/chat-service && export JAVA_HOME=$(/usr/libexec/java_home -v 21) && mvn -q spotless:check && mvn -q test)
pnpm --filter @platform/web exec tsc --noEmit
pnpm --filter @platform/web lint
pnpm --filter @platform/web test
pnpm --filter @platform/web build
(cd apps/client && flutter analyze && flutter test)
```

Expected: tất cả PASS. `mvn test` cần Docker cho Testcontainers.

- [ ] **Step 2: Kiểm tra wire contract giữa 2 client**

```bash
grep -rn "'hangup'\|'declined'\|'busy'\|'no_answer'\|'media_error'\|'failed'" apps/web/lib/webrtc/call-end-notice.ts apps/client/lib/features/chat/domain/call_rules.dart
grep -rn "45_000\|seconds: 45\|8_000\|seconds: 8" apps/web/lib/webrtc/call-manager.ts apps/client/lib/features/chat/domain/webrtc_service.dart
```

Expected: 6 giá trị reason xuất hiện ở cả 2 file. Hằng số 45s và 8s khớp nhau.

- [ ] **Step 3: Commit tài liệu**

```bash
git add docs/superpowers/plans/README.md
git commit -m "docs: mark the 1-on-1 call reliability plan done"
```

---

### Task 9: Test tay trên thiết bị thật (bắt buộc trước khi mở PR vào `main`)

Không tự động hoá được: âm thanh, rung, quyền hệ điều hành, NAT thật, AVAudioSession của iOS. Chạy trên nhánh `dev` sau khi merge `fix/call-1on1-reliability` vào `dev` (`.claude/rules/dev-local-only.md`). Nếu muốn 2 máy khác mạng gọi nhau thì cần backend có thể truy cập công khai (mini/tunnel).

Ma trận test, đánh dấu ✅/❌ và ghi chú:

| # | Kịch bản | Web→Web | Web→iOS | iOS→Android | Kỳ vọng |
|---|---|---|---|---|---|
| 1 | A gọi thoại, B đang mở app | | | | B: chuông + rung (mobile) + hộp Nghe/Từ chối có **tên A**. A: tiếng tút |
| 2 | A gọi video | | | | Lần đầu hệ điều hành / trình duyệt xin quyền camera + mic. Thoại thì chỉ xin mic |
| 3 | B bấm Nghe, **khác mạng** (B dùng 4G, A dùng Wi-Fi) | | | | Nghe được 2 chiều trong ≤ 5s. Chuông / tút tắt ngay |
| 4 | B bấm Từ chối | | | | A quay lại màn hình chat, thấy "B đã từ chối cuộc gọi". Chat có dòng cuộc gọi nhỡ |
| 5 | B không làm gì 45s | | | | A thấy "Không có người trả lời". Chuông của B tắt |
| 6 | B đang trong cuộc gọi khác | | | | A thấy "B đang bận cuộc gọi khác". Cuộc gọi đang diễn ra của B không bị ảnh hưởng |
| 7 | B từ chối quyền mic sau khi bấm Nghe | | | | B thấy lỗi quyền. A thấy "B không bật được micro hoặc camera" |
| 8 | Đang nói chuyện, tắt Wi-Fi của B 3s rồi bật lại | | | | Cuộc gọi tiếp tục |
| 9 | Đang nói chuyện, tắt mạng của B > 10s | | | | Cả hai thấy "Cuộc gọi bị ngắt do mất kết nối" |
| 10 | iPhone bật gạt im lặng, có cuộc gọi đến | | | | Không có tiếng chuông nhưng vẫn rung |
| 11 | iOS: A gọi thoại, nghe tút ở loa trong; B nghe máy | | | | Sau khi B nghe, hai bên nghe nhau bình thường (Review Focus #6) |
| 12 | Mobile trong cuộc gọi: tắt mic / loa ngoài / tắt cam / đổi cam | | | | Mỗi nút hoạt động, bên kia thấy hoặc nghe đúng |
| 13 | Web: tab vừa mở, chưa click gì, có cuộc gọi đến | | | | Có thể không có tiếng (trình duyệt chặn autoplay) nhưng vẫn có hộp gọi. Tab ẩn thì có Notification |

Nếu kịch bản 3 vẫn fail khi hai máy khác mạng mà các kịch bản khác đều đạt, thì nguyên nhân gần như chắc chắn là thiếu TURN. Ghi vào báo cáo và chuyển sang plan LiveKit.

- [ ] **Step 1:** Chạy đủ ma trận và lưu kết quả vào mô tả PR.
- [ ] **Step 2:** Mở PR `fix/call-1on1-reliability` → `main` (sau khi #163 đã merge và nhánh đã rebase). `git diff origin/main...fix/call-1on1-reliability --stat` chỉ được chứa file của plan này.
