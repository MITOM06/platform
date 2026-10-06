# Calls C1 — chat-service: cuộc gọi qua LiveKit (sfu) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chat-service điều phối cuộc gọi 1-1 và nhóm trên đường `sfu` (LiveKit): đổ chuông, nghe/từ chối/huỷ, bận, cấp token, danh sách người trong phòng từ webhook — đường `mesh` giữ nguyên.

**Architecture:** `CallService` (đã có) giữ vòng đời `CallSession`, thêm nhánh `sfu` ở `startCall`/`leaveCall`/`endCall`. Logic chỉ có trên `sfu` nằm ở class mới `SfuCallService` (accept/decline/cancel, token, cài `RtcRoomEventHandler` cho room `call_*`). Trạng thái "đang bận" là key Redis `call:user:{userId}` qua `CallBusyRegistry`. Lỗi REST trả `{error, code, statusCode}` qua `ApiException` mới.

**Tech Stack:** Spring Boot 3.3, Java 21, JUnit 5 + Mockito + AssertJ, Spotless.

**Spec:** `docs/superpowers/specs/2026-10-05-calls-and-meetings-design.md` §4.2; contract chốt ở `docs/superpowers/plans/2026-10-05-calls-on-livekit.md` (mục Contract) — plan này hiện thực milestone C1 của plan đó.

## Global Constraints

- Nhánh `feat/calls-livekit` (= `feat/rtc-foundation` + merge `fix/call-1on1-reliability`).
- Đường `mesh` **không đổi hành vi**: khi `LiveKitProperties.callsUseSfu()` là false, `startCall`/`leaveCall`/`endCall` làm đúng như trước (chỉ ghi thêm `transport="mesh"`, `kind`).
- `reason` hợp lệ: `hangup | declined | busy | no_answer | media_error | failed | answered_elsewhere`. `call.decline` chỉ nhận `declined | busy | media_error` (khác ⇒ `declined`); `call.cancel` chỉ nhận `hangup | no_answer` (khác ⇒ `hangup`).
- `call:user:{userId}` TTL 6h; chỉ xoá khi giá trị đúng là callId đang kết thúc (không xoá nhầm cuộc gọi khác).
- Token: room `call_{callId}`, identity = userId, name = `displayName` trong collection `users` (thiếu ⇒ bỏ trống, **không** dùng userId làm tên), metadata `{"avatarUrl": "..."}` khi có.
- Lỗi REST: 403 `CALL_FORBIDDEN`, 404 `CALL_NOT_FOUND`, 409 `CALL_ENDED`, 409 `CALL_NOT_SFU`, 503 `CALLS_UNAVAILABLE` — body `{error, code, statusCode}`, không có message nội bộ.
- Java ≤ 500 dòng/file; `mvn spotless:apply` sau mỗi lần sửa; JDK 21.
- Handler webhook bỏ qua sự kiện `left` có `participantSid` khác `sid` đã lưu của người đó (phiên cũ bị đá khi vào lại từ máy khác — ruling final review plan Foundation).

## Review Focus

1. **Gọi người đang bận (đang trong cuộc gọi sfu khác)** — người gọi nhận `call-declined{busy}` ngay, không tạo session, không đổ chuông. Test Task 2.
2. **Người nhận nghe trên máy A khi máy B cũng đang đổ chuông** — mọi phiên của người nhận nhận `call-ring-cancel{answered_elsewhere}`. Test Task 3.
3. **Kill app giữa cuộc gọi 1-1** — webhook `participant_left` (leftAt chưa có) ⇒ `call.ended{failed}`. Rời bằng `call.leave` ⇒ `hangup`, và webhook đến sau bị bỏ qua. Test Task 5.
4. **Vào lại từ máy khác** — `left` của sid cũ tới sau `joined` của sid mới không làm mất người đó khỏi danh sách. Test Task 5.
5. **Session `mesh` đang chạy khi đổi cờ sang `sfu`** — accept/decline/cancel/token/webhook không đụng vào nó. Test Task 3, 4.

---

## Ruling khi viết plan

Plan này ghi **đầy đủ code test** (test là đặc tả) và mô tả code hiện thực bằng chữ ký + hành vi chính xác thay vì chép sẵn toàn bộ code hiện thực — người viết plan cũng là người thực thi ngay trong cùng phiên (executing-plans, native), chép code hai lần chỉ tốn thêm mà không thêm thông tin. Nếu giao cho người khác thực thi, viết bổ sung code hiện thực trước.

---

### Task 1: Field mới, DTO và `CallBusyRegistry`

**Files:**
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/model/CallSession.java` — thêm `@Builder.Default private String transport = "mesh";`, `private String kind;` (`"direct" | "group"`), và trong `Participant`: `private String sid;`
- Modify: `.../dto/CallEventDto.java` — thêm `private String transport; private String livekitUrl; private String reason;`
- Modify: `.../dto/WebRTCSignalDto.java` — thêm `private String transport;` (ring payload), cập nhật javadoc `reason` (thêm `answered_elsewhere`)
- Create: `.../service/CallBusyRegistry.java`
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/service/CallBusyRegistryTest.java`

**Interfaces — Produces:** `CallBusyRegistry`: `void markBusy(String userId, String callId)`, `String busyCallOf(String userId)` (null nếu rảnh), `void clear(String userId, String callId)`; hằng `KEY_PREFIX = "call:user:"`, `TTL = Duration.ofHours(6)`.

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

class CallBusyRegistryTest {

  private StringRedisTemplate redis;
  private ValueOperations<String, String> values;
  private CallBusyRegistry registry;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    redis = mock(StringRedisTemplate.class);
    values = mock(ValueOperations.class);
    when(redis.opsForValue()).thenReturn(values);
    registry = new CallBusyRegistry(redis);
  }

  @Test
  void markBusyStoresTheCallWithASixHourTtl() {
    registry.markBusy("u1", "c1");
    verify(values).set("call:user:u1", "c1", Duration.ofHours(6));
  }

  @Test
  void busyCallOfReadsTheKey() {
    when(values.get("call:user:u1")).thenReturn("c1");
    assertThat(registry.busyCallOf("u1")).isEqualTo("c1");
    assertThat(registry.busyCallOf("u2")).isNull();
  }

  @Test
  void clearOnlyRemovesTheSameCall() {
    when(values.get("call:user:u1")).thenReturn("c-other");
    registry.clear("u1", "c1");
    verify(redis, never()).delete(anyString());

    when(values.get("call:user:u1")).thenReturn("c1");
    registry.clear("u1", "c1");
    verify(redis).delete("call:user:u1");
  }

  @Test
  void nullArgumentsAreIgnored() {
    registry.markBusy(null, "c1");
    registry.clear("u1", null);
    verify(values, never()).set(anyString(), anyString(), org.mockito.ArgumentMatchers.any());
    verify(redis, never()).delete(anyString());
  }
}
```

- [ ] **Step 2: RED** — `-Dtest=CallBusyRegistryTest` ⇒ compile error `CallBusyRegistry`.
- [ ] **Step 3: Hiện thực** `@Component @RequiredArgsConstructor class CallBusyRegistry` theo test (get-then-delete là đủ: cùng một callId chỉ bị xoá bởi chính cuộc gọi đó). Thêm field vào model/DTO.
- [ ] **Step 4: GREEN** + `-Dtest='CallBusyRegistryTest,ChatControllerTest'` (DTO đổi không vỡ test cũ).
- [ ] **Step 5: Commit** `feat(chat): call transport fields and busy registry`

---

### Task 2: `CallService` — nhánh sfu khi bắt đầu, rời và kết thúc

**Files:**
- Modify: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/CallService.java`
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/service/CallServiceSfuTest.java`

**Interfaces:**
- Consumes: `LiveKitProperties.callsUseSfu()/getUrl()`, `LiveKitRoomClient.deleteRoom`, `RtcRooms.forCall`, `CallBusyRegistry` (Task 1).
- Produces (dùng ở Task 3–5): `public void endCall(String callId, String reason)` (giữ `endCall(String callId)` = `hangup`); package-private `Optional<CallSession> activeSession(String callId)` (chưa kết thúc), `void save(CallSession)`, `void broadcastRoster(CallSession)`, `List<String> membersOf(String conversationId)`, `void sendToUser(String userId, WebRTCSignalDto dto)` (queue `/queue/webrtc`).

Hành vi:
- `startCall` khi `callsUseSfu()`: `kind = members.size() == 2 ? "direct" : "group"`; `direct` mà người kia `busyCallOf != null` ⇒ gửi caller `call-declined{callId:null, conversationId, reason:"busy", senderId:<callee>}`, **không** lưu session, return. `group` ⇒ bỏ qua không đổ chuông thành viên đang bận. Lưu session `transport="sfu"`; `markBusy(caller)`; `call.started` thêm `transport` + `livekitUrl`; `call-ring` thêm `transport`.
- `startCall` khi mesh: như cũ + `transport="mesh"`, `kind`.
- `leaveCall` trên session `sfu`: như cũ + `clear(userId, callId)`; nếu `kind=direct` ⇒ `endCall(callId, "hangup")` ngay.
- `endCall(callId, reason)`: như cũ + `call.ended` mang `reason`; `clear` cho mọi participant và `startedBy`; session `sfu` ⇒ `deleteRoom(call_{callId})`, lỗi `RuntimeException` chỉ log (room có thể đã tự đóng).

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.LiveKitProperties;
import com.platform.chatservice.dto.CallEventDto;
import com.platform.chatservice.dto.WebRTCSignalDto;
import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.CallSessionRepository;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.UserBlockRepository;
import com.platform.chatservice.service.rtc.LiveKitApiException;
import com.platform.chatservice.service.rtc.LiveKitRoomClient;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CallServiceSfuTest {

  @Mock private CallSessionRepository sessions;
  @Mock private ConversationRepository conversations;
  @Mock private UserBlockRepository blocks;
  @Mock private ClusterMessageBroker broker;
  @Mock private StringRedisTemplate redis;
  @Mock private ValueOperations<String, String> values;
  @Mock private LiveKitRoomClient roomClient;
  @Mock private CallBusyRegistry busy;
  private LiveKitProperties props;
  private CallService service;

  @BeforeEach
  void setUp() {
    props = new LiveKitProperties();
    props.setUrl("wss://rtc.example.com");
    props.setApiKey("APIkey1");
    props.setApiSecret("0123456789abcdef0123456789abcdef");
    props.setCallTransport("sfu");
    when(redis.opsForValue()).thenReturn(values);
    service =
        new CallService(
            sessions, conversations, blocks, broker, redis, new ObjectMapper(), props, roomClient,
            busy);
  }

  private void conversation(String id, String... members) {
    Conversation c = new Conversation();
    c.setId(id);
    c.setParticipants(new ArrayList<>(List.of(members)));
    when(conversations.findById(id)).thenReturn(Optional.of(c));
  }

  private CallSession saved() {
    ArgumentCaptor<CallSession> captor = ArgumentCaptor.forClass(CallSession.class);
    verify(sessions).save(captor.capture());
    return captor.getValue();
  }

  private List<WebRTCSignalDto> sentTo(String userId) {
    ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
    verify(broker, org.mockito.Mockito.atLeast(0))
        .convertAndSendToUser(eq(userId), eq("/queue/webrtc"), captor.capture());
    return captor.getAllValues().stream().map(WebRTCSignalDto.class::cast).toList();
  }

  private List<CallEventDto> broadcast(String conversationId) {
    ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
    verify(broker, org.mockito.Mockito.atLeast(0))
        .convertAndSend(eq("/topic/conversation/" + conversationId), captor.capture());
    return captor.getAllValues().stream().map(CallEventDto.class::cast).toList();
  }

  @Test
  void directCallOnSfuRingsTheOtherMemberWithTheTransport() {
    conversation("conv", "alice", "bob");

    service.startCall("alice", "conv", "video", false);

    CallSession s = saved();
    assertThat(s.getTransport()).isEqualTo("sfu");
    assertThat(s.getKind()).isEqualTo("direct");
    verify(busy).markBusy("alice", s.getCallId());
    assertThat(sentTo("bob")).singleElement().satisfies(r -> {
      assertThat(r.getType()).isEqualTo("call-ring");
      assertThat(r.getTransport()).isEqualTo("sfu");
      assertThat(r.getCallId()).isEqualTo(s.getCallId());
    });
    assertThat(broadcast("conv")).singleElement().satisfies(e -> {
      assertThat(e.getEvent()).isEqualTo("call.started");
      assertThat(e.getTransport()).isEqualTo("sfu");
      assertThat(e.getLivekitUrl()).isEqualTo("wss://rtc.example.com");
    });
  }

  @Test
  void busyCalleeIsReportedAndNothingRings() {
    conversation("conv", "alice", "bob");
    when(busy.busyCallOf("bob")).thenReturn("other-call");

    service.startCall("alice", "conv", "audio", false);

    verify(sessions, never()).save(any());
    assertThat(sentTo("bob")).isEmpty();
    assertThat(sentTo("alice")).singleElement().satisfies(d -> {
      assertThat(d.getType()).isEqualTo("call-declined");
      assertThat(d.getReason()).isEqualTo("busy");
      assertThat(d.getSenderId()).isEqualTo("bob");
      assertThat(d.getConversationId()).isEqualTo("conv");
    });
  }

  @Test
  void groupCallSkipsBusyMembersButStillStarts() {
    conversation("grp", "alice", "bob", "carol");
    when(busy.busyCallOf("carol")).thenReturn("other-call");

    service.startCall("alice", "grp", "audio", false);

    assertThat(saved().getKind()).isEqualTo("group");
    assertThat(sentTo("bob")).hasSize(1);
    assertThat(sentTo("carol")).isEmpty();
  }

  @Test
  void meshStaysAsBeforeWhenTheFlagIsOff() {
    props.setCallTransport("mesh");
    conversation("grp", "alice", "bob", "carol");
    when(busy.busyCallOf("carol")).thenReturn("other-call");

    service.startCall("alice", "grp", "audio", false);

    CallSession s = saved();
    assertThat(s.getTransport()).isEqualTo("mesh");
    assertThat(sentTo("carol")).hasSize(1); // no busy logic on mesh
    assertThat(broadcast("grp").get(0).getTransport()).isEqualTo("mesh");
    assertThat(broadcast("grp").get(0).getLivekitUrl()).isNull();
  }

  private CallSession activeSfu(String kind, String... participants) {
    List<CallSession.Participant> list = new ArrayList<>();
    for (String p : participants) {
      list.add(CallSession.Participant.builder().userId(p).joinedAt(Instant.now()).build());
    }
    CallSession s =
        CallSession.builder()
            .callId("c1")
            .conversationId("conv")
            .startedBy(participants[0])
            .transport("sfu")
            .kind(kind)
            .participants(list)
            .build();
    when(sessions.findByCallId("c1")).thenReturn(Optional.of(s));
    return s;
  }

  @Test
  void leavingADirectSfuCallEndsItForBoth() {
    activeSfu("direct", "alice", "bob");

    service.leaveCall("alice", "c1");

    verify(busy).clear("alice", "c1");
    verify(busy).clear("bob", "c1");
    verify(roomClient).deleteRoom("call_c1");
    assertThat(broadcast("conv"))
        .anySatisfy(e -> {
          assertThat(e.getEvent()).isEqualTo("call.ended");
          assertThat(e.getReason()).isEqualTo("hangup");
        });
  }

  @Test
  void endCallSurvivesARoomThatIsAlreadyGone() {
    activeSfu("group", "alice", "bob", "carol");
    doThrow(new LiveKitApiException("DeleteRoom", 404, null))
        .when(roomClient)
        .deleteRoom(anyString());

    service.endCall("c1", "failed");

    assertThat(broadcast("conv")).singleElement().satisfies(e -> {
      assertThat(e.getEvent()).isEqualTo("call.ended");
      assertThat(e.getReason()).isEqualTo("failed");
    });
  }

  @Test
  void endingAMeshCallNeverTouchesLiveKit() {
    CallSession s = activeSfu("group", "alice", "bob");
    s.setTransport("mesh");

    service.endCall("c1");

    verify(roomClient, never()).deleteRoom(anyString());
  }
}
```

- [ ] **Step 2: RED** — compile error (constructor chưa nhận `LiveKitProperties`, `LiveKitRoomClient`, `CallBusyRegistry`; DTO chưa có getter mới nếu Task 1 chưa xong).
- [ ] **Step 3: Hiện thực** theo "Hành vi" ở trên. `Conversation` đã có `@Data`/setter — kiểm trước, nếu không có setter thì dựng bằng builder có sẵn.
- [ ] **Step 4: GREEN** `-Dtest=CallServiceSfuTest` rồi cả suite (`CallService` có test khác dùng constructor không — sửa nếu có).
- [ ] **Step 5: Commit** `feat(chat): sfu branch for starting, leaving and ending calls`

---

### Task 3: `SfuCallService` — nghe, từ chối, huỷ + route STOMP

**Files:**
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/service/SfuCallService.java`
- Modify: `.../controller/CallController.java` — `@MessageMapping("/call.accept")`, `("/call.decline")`, `("/call.cancel")` (payload `WebRTCSignalDto`: `callId`, `reason`)
- Test: `apps/server/chat-service/src/test/java/com/platform/chatservice/service/SfuCallServiceTest.java`

**Interfaces — Produces:** `void accept(String userId, String callId)`, `void decline(String userId, String callId, String reason)`, `void cancel(String userId, String callId, String reason)`.

Hành vi (mọi method: session không tồn tại / đã kết thúc / `transport != "sfu"` / user không phải thành viên hội thoại ⇒ bỏ qua im lặng):
- `accept`: `markBusy(userId)`; gửi `call-ring-cancel{callId, reason:"answered_elsewhere"}` tới **chính userId** (mọi phiên; phiên đang nghe tự bỏ qua vì đã ở trạng thái connecting). Không đổi roster (roster đến từ webhook).
- `decline`: chuẩn hoá reason; gửi `call-ring-cancel{callId, reason:"declined"}` tới chính userId (dừng chuông ở máy khác của người đó); `direct` ⇒ gửi `call-declined{callId, reason, senderId:userId}` tới `startedBy` rồi `endCall(callId, reason)`; `group` ⇒ chỉ vậy, cuộc gọi tiếp tục.
- `cancel`: chỉ `startedBy`; chỉ khi **chưa ai khác** từng có `joinedAt` (người gọi bỏ cuộc trước khi có người nghe). Chuẩn hoá reason; gửi `call-ring-cancel{callId, reason}` tới mọi thành viên trừ người gọi; `endCall(callId, reason)`.

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.WebRTCSignalDto;
import com.platform.chatservice.model.CallSession;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SfuCallServiceTest {

  @Mock private CallService calls;
  @Mock private CallBusyRegistry busy;
  private SfuCallService service;
  private CallSession session;

  @BeforeEach
  void setUp() {
    service = new SfuCallService(calls, busy, null, null, null, null);
    session = session("direct", "alice", "bob");
  }

  private CallSession session(String kind, String startedBy, String... others) {
    List<CallSession.Participant> list = new ArrayList<>();
    list.add(CallSession.Participant.builder().userId(startedBy).joinedAt(Instant.now()).build());
    CallSession s =
        CallSession.builder()
            .callId("c1")
            .conversationId("conv")
            .startedBy(startedBy)
            .transport("sfu")
            .kind(kind)
            .participants(list)
            .build();
    List<String> members = new ArrayList<>(List.of(startedBy));
    members.addAll(List.of(others));
    when(calls.activeSession("c1")).thenReturn(Optional.of(s));
    when(calls.membersOf("conv")).thenReturn(members);
    return s;
  }

  private List<WebRTCSignalDto> sentTo(String userId) {
    ArgumentCaptor<WebRTCSignalDto> captor = ArgumentCaptor.forClass(WebRTCSignalDto.class);
    verify(calls, org.mockito.Mockito.atLeast(0)).sendToUser(eq(userId), captor.capture());
    return captor.getAllValues();
  }

  @Test
  void acceptMarksBusyAndStopsTheRingOnTheCalleesOtherDevices() {
    service.accept("bob", "c1");

    verify(busy).markBusy("bob", "c1");
    assertThat(sentTo("bob")).singleElement().satisfies(s -> {
      assertThat(s.getType()).isEqualTo("call-ring-cancel");
      assertThat(s.getReason()).isEqualTo("answered_elsewhere");
      assertThat(s.getCallId()).isEqualTo("c1");
    });
    verify(calls, never()).endCall(anyString(), anyString());
  }

  @Test
  void declineOfADirectCallTellsTheCallerAndEndsIt() {
    service.decline("bob", "c1", "busy");

    assertThat(sentTo("alice")).singleElement().satisfies(s -> {
      assertThat(s.getType()).isEqualTo("call-declined");
      assertThat(s.getReason()).isEqualTo("busy");
      assertThat(s.getSenderId()).isEqualTo("bob");
    });
    assertThat(sentTo("bob")).singleElement().satisfies(s ->
        assertThat(s.getType()).isEqualTo("call-ring-cancel"));
    verify(calls).endCall("c1", "busy");
  }

  @Test
  void unknownDeclineReasonBecomesDeclined() {
    service.decline("bob", "c1", "whatever");
    verify(calls).endCall("c1", "declined");
  }

  @Test
  void declineOfAGroupCallLeavesItRunning() {
    session("group", "alice", "bob", "carol");

    service.decline("bob", "c1", "declined");

    assertThat(sentTo("alice")).isEmpty();
    verify(calls, never()).endCall(anyString(), anyString());
  }

  @Test
  void callerCancelBeforeAnswerStopsEveryRing() {
    session("group", "alice", "bob", "carol");

    service.cancel("alice", "c1", "no_answer");

    assertThat(sentTo("bob")).singleElement().satisfies(s -> {
      assertThat(s.getType()).isEqualTo("call-ring-cancel");
      assertThat(s.getReason()).isEqualTo("no_answer");
    });
    assertThat(sentTo("carol")).hasSize(1);
    assertThat(sentTo("alice")).isEmpty();
    verify(calls).endCall("c1", "no_answer");
  }

  @Test
  void cancelAfterSomeoneJoinedIsIgnored() {
    session.getParticipants()
        .add(CallSession.Participant.builder().userId("bob").joinedAt(Instant.now()).build());

    service.cancel("alice", "c1", "hangup");

    verify(calls, never()).endCall(anyString(), anyString());
  }

  @Test
  void onlyTheCallerCanCancel() {
    service.cancel("bob", "c1", "hangup");
    verify(calls, never()).endCall(anyString(), anyString());
  }

  @Test
  void strangersAndMeshSessionsAreIgnored() {
    service.accept("mallory", "c1");
    service.decline("mallory", "c1", "declined");
    session.setTransport("mesh");
    service.accept("bob", "c1");
    service.decline("bob", "c1", "declined");

    verify(busy, never()).markBusy(anyString(), anyString());
    verify(calls, never()).sendToUser(anyString(), any());
    verify(calls, never()).endCall(anyString(), anyString());
  }
}
```

Constructor `SfuCallService(CallService, CallBusyRegistry, LiveKitProperties, LiveKitTokenService, UserBlockRepository, MongoTemplate)` — 4 tham số cuối dùng ở Task 4 (token).

- [ ] **Step 2: RED** — compile error.
- [ ] **Step 3: Hiện thực** + 3 route STOMP trong `CallController`.
- [ ] **Step 4: GREEN** `-Dtest='SfuCallServiceTest,CallServiceSfuTest,AssistantMappingUniquenessTest'`.
- [ ] **Step 5: Commit** `feat(chat): accept, decline and cancel for sfu calls`

---

### Task 4: Token và cấu hình qua REST

**Files:**
- Create: `apps/server/chat-service/src/main/java/com/platform/chatservice/exception/ApiException.java` — `ApiException(HttpStatus status, String code)`; getter `status()`, `code()`
- Modify: `.../exception/GlobalExceptionHandler.java` — handler `ApiException` ⇒ `{error: status.getReasonPhrase(), code, statusCode}` (đặt **trước** handler `RuntimeException`)
- Modify: `.../service/SfuCallService.java` — `CallToken issueToken(String userId, String callId)`; record `CallToken(String url, String token)`
- Create: `.../controller/CallRestController.java` — `GET /api/calls/config` ⇒ `{transport, livekitUrl}` (`livekitUrl` null khi mesh); `POST /api/calls/{callId}/token` ⇒ `CallToken`
- Test: `.../service/SfuCallServiceTokenTest.java`, `.../controller/CallRestControllerTest.java`

Hành vi `issueToken` (thứ tự kiểm): LiveKit chưa cấu hình ⇒ 503 `CALLS_UNAVAILABLE`; session không có ⇒ 404 `CALL_NOT_FOUND`; đã kết thúc ⇒ 409 `CALL_ENDED`; `transport != sfu` ⇒ 409 `CALL_NOT_SFU`; user không phải thành viên hội thoại ⇒ 403 `CALL_FORBIDDEN`; `direct` mà một trong hai bên chặn bên kia (`existsByBlockerIdAndBlockedId` hai chiều) ⇒ 403 `CALL_FORBIDDEN`. Thành công: `participantToken(userId, displayName, metadata, RtcGrant.participant("call_" + callId))` với displayName/avatarUrl đọc từ collection `users` (`_id` = ObjectId(userId); id không hợp lệ ⇒ bỏ trống).

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.platform.chatservice.config.LiveKitProperties;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.repository.CallSessionRepository;
import com.platform.chatservice.repository.UserBlockRepository;
import com.platform.chatservice.service.rtc.LiveKitTokenService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SfuCallServiceTokenTest {

  private static final String ALICE = "64b000000000000000000001";
  private static final String BOB = "64b000000000000000000002";

  @Mock private CallService calls;
  @Mock private CallBusyRegistry busy;
  @Mock private CallSessionRepository sessions;
  @Mock private UserBlockRepository blocks;
  @Mock private MongoTemplate mongo;
  private LiveKitProperties props;
  private SfuCallService service;
  private CallSession session;

  @BeforeEach
  void setUp() {
    props = new LiveKitProperties();
    props.setUrl("wss://rtc.example.com");
    props.setApiKey("APIkey1");
    props.setApiSecret("0123456789abcdef0123456789abcdef");
    service =
        new SfuCallService(calls, busy, props, new LiveKitTokenService(props), blocks, mongo);
    session =
        CallSession.builder()
            .callId("c1")
            .conversationId("conv")
            .startedBy(ALICE)
            .transport("sfu")
            .kind("direct")
            .participants(new ArrayList<>())
            .build();
    when(calls.findSession("c1")).thenReturn(Optional.of(session));
    when(calls.membersOf("conv")).thenReturn(List.of(ALICE, BOB));
    when(mongo.findOne(any(Query.class), eq(Document.class), eq("users")))
        .thenReturn(new Document("displayName", "Alice").append("avatarUrl", "/a.png"));
  }

  private static HttpStatus statusOf(Runnable r) {
    try {
      r.run();
    } catch (ApiException e) {
      return e.status();
    }
    throw new AssertionError("expected ApiException");
  }

  @Test
  void memberGetsARoomTokenWithTheirNameAndAvatar() {
    SfuCallService.CallToken t = service.issueToken(ALICE, "c1");

    assertThat(t.url()).isEqualTo("wss://rtc.example.com");
    Claims c =
        Jwts.parserBuilder().setSigningKey(props.signingKey()).build()
            .parseClaimsJws(t.token()).getBody();
    assertThat(c.getSubject()).isEqualTo(ALICE);
    assertThat(c.get("name")).isEqualTo("Alice");
    assertThat(c.get("metadata")).isEqualTo("{\"avatarUrl\":\"/a.png\"}");
    assertThat(((Map<?, ?>) c.get("video", Map.class)).get("room")).isEqualTo("call_c1");
  }

  @Test
  void unknownUserNameIsLeftOutNotReplacedByTheId() {
    when(mongo.findOne(any(Query.class), eq(Document.class), eq("users"))).thenReturn(null);
    Claims c =
        Jwts.parserBuilder().setSigningKey(props.signingKey()).build()
            .parseClaimsJws(service.issueToken(ALICE, "c1").token()).getBody();
    assertThat(c.containsKey("name")).isFalse();
  }

  @Test
  void errorsMapToTheContractCodes() {
    assertThatThrownBy(() -> service.issueToken("stranger", "c1"))
        .isInstanceOf(ApiException.class)
        .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("CALL_FORBIDDEN"));
    assertThat(statusOf(() -> service.issueToken("stranger", "c1")))
        .isEqualTo(HttpStatus.FORBIDDEN);

    when(blocks.existsByBlockerIdAndBlockedId(BOB, ALICE)).thenReturn(true);
    assertThat(statusOf(() -> service.issueToken(ALICE, "c1"))).isEqualTo(HttpStatus.FORBIDDEN);
    when(blocks.existsByBlockerIdAndBlockedId(BOB, ALICE)).thenReturn(false);

    session.setTransport("mesh");
    assertThat(statusOf(() -> service.issueToken(ALICE, "c1"))).isEqualTo(HttpStatus.CONFLICT);
    session.setTransport("sfu");

    session.setEndedAt(Instant.now());
    assertThat(statusOf(() -> service.issueToken(ALICE, "c1"))).isEqualTo(HttpStatus.CONFLICT);

    when(calls.findSession("gone")).thenReturn(Optional.empty());
    assertThat(statusOf(() -> service.issueToken(ALICE, "gone"))).isEqualTo(HttpStatus.NOT_FOUND);

    props.setUrl("");
    assertThat(statusOf(() -> service.issueToken(ALICE, "c1")))
        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
  }
}
```

`CallService.findSession(callId)` (package-private, kể cả đã kết thúc) bổ sung cho `activeSession` của Task 2.

`CallRestControllerTest` (standalone MockMvc với `GlobalExceptionHandler` làm advice): `GET /api/calls/config` khi mesh ⇒ `{"transport":"mesh"}` không có `livekitUrl`; khi sfu ⇒ có `livekitUrl`; `POST /api/calls/c1/token` khi service ném `ApiException(FORBIDDEN, "CALL_FORBIDDEN")` ⇒ 403 + body `{"error":"Forbidden","code":"CALL_FORBIDDEN","statusCode":403}` và **không** có field `message`.

- [ ] **Step 2: RED** · **Step 3: Hiện thực** · **Step 4: GREEN** `-Dtest='SfuCallServiceTokenTest,CallRestControllerTest,AssistantMappingUniquenessTest'`
- [ ] **Step 5: Commit** `feat(chat): call config and LiveKit token endpoints`

---

### Task 5: Webhook — danh sách người trong phòng

**Files:**
- Modify: `.../service/SfuCallService.java` — `implements RtcRoomEventHandler` (`supports(room)` = `room.startsWith(RtcRooms.CALL_PREFIX)`)
- Test: `.../service/SfuCallServiceWebhookTest.java`

Hành vi:
- `onParticipantJoined(e)`: session theo `RtcRooms.idOf(room, CALL_PREFIX)`; không có / đã kết thúc / không phải sfu ⇒ bỏ qua. Participant có rồi ⇒ `leftAt=null`, `sid=e.participantSid()`, giữ `joinedAt` cũ nếu có; chưa có ⇒ thêm (`joinedAt = e.createdAt() ?? now`). `save` + `broadcastRoster` + `markBusy`.
- `onParticipantLeft(e)`: participant không có ⇒ bỏ qua; `sid` đã lưu khác `e.participantSid()` (cả hai khác null) ⇒ bỏ qua (phiên cũ); `leftAt` đã có (rời bằng `call.leave`) ⇒ bỏ qua. Ngược lại `leftAt = now`, `save`, `broadcastRoster`, `busy.clear`. `direct` ⇒ `endCall(callId, "failed")` (rời mà không bấm cúp = rớt mạng / kill app). `group` mà không còn ai `leftAt == null` ⇒ `endCall(callId, "hangup")`.
- `onRoomFinished(room)`: `endCall(callId, "hangup")` (idempotent trong `endCall`).

- [ ] **Step 1: Test**

```java
package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.service.rtc.RtcParticipantEvent;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SfuCallServiceWebhookTest {

  @Mock private CallService calls;
  @Mock private CallBusyRegistry busy;
  private SfuCallService service;
  private CallSession session;

  @BeforeEach
  void setUp() {
    service = new SfuCallService(calls, busy, null, null, null, null);
    session =
        CallSession.builder()
            .callId("c1")
            .conversationId("conv")
            .startedBy("alice")
            .transport("sfu")
            .kind("direct")
            .participants(new ArrayList<>())
            .build();
    when(calls.activeSession("c1")).thenReturn(Optional.of(session));
  }

  private static RtcParticipantEvent ev(String identity, String sid) {
    return new RtcParticipantEvent("call_c1", identity, sid, "evt", Instant.now());
  }

  private CallSession.Participant p(String userId) {
    return session.getParticipants().stream()
        .filter(x -> x.getUserId().equals(userId)).findFirst().orElseThrow();
  }

  @Test
  void ownsOnlyCallRooms() {
    assertThat(service.supports("call_c1")).isTrue();
    assertThat(service.supports("meet_m1")).isFalse();
  }

  @Test
  void joinAddsTheParticipantWithItsSessionAndBroadcasts() {
    service.onParticipantJoined(ev("bob", "PA_1"));

    assertThat(p("bob").getSid()).isEqualTo("PA_1");
    assertThat(p("bob").getJoinedAt()).isNotNull();
    assertThat(p("bob").getLeftAt()).isNull();
    verify(calls).save(session);
    verify(calls).broadcastRoster(session);
    verify(busy).markBusy("bob", "c1");
  }

  @Test
  void droppingOutOfADirectCallEndsItAsFailed() {
    service.onParticipantJoined(ev("alice", "PA_A"));
    service.onParticipantJoined(ev("bob", "PA_B"));

    service.onParticipantLeft(ev("bob", "PA_B"));

    assertThat(p("bob").getLeftAt()).isNotNull();
    verify(busy).clear("bob", "c1");
    verify(calls).endCall("c1", "failed");
  }

  @Test
  void aLeaveThatWasAlreadyRecordedIsIgnored() {
    service.onParticipantJoined(ev("bob", "PA_B"));
    p("bob").setLeftAt(Instant.now()); // left via call.leave

    service.onParticipantLeft(ev("bob", "PA_B"));

    verify(calls, never()).endCall(anyString(), anyString());
  }

  @Test
  void aStaleSessionLeavingAfterARejoinIsIgnored() {
    session.setKind("group");
    service.onParticipantJoined(ev("bob", "PA_OLD"));
    service.onParticipantJoined(ev("bob", "PA_NEW")); // rejoined from another device

    service.onParticipantLeft(ev("bob", "PA_OLD"));

    assertThat(p("bob").getLeftAt()).isNull();
    assertThat(p("bob").getSid()).isEqualTo("PA_NEW");
  }

  @Test
  void groupCallEndsWhenTheLastPersonLeaves() {
    session.setKind("group");
    service.onParticipantJoined(ev("alice", "PA_A"));
    service.onParticipantJoined(ev("bob", "PA_B"));

    service.onParticipantLeft(ev("alice", "PA_A"));
    verify(calls, never()).endCall(anyString(), anyString());

    service.onParticipantLeft(ev("bob", "PA_B"));
    verify(calls).endCall("c1", "hangup");
  }

  @Test
  void roomFinishedEndsTheCall() {
    service.onRoomFinished("call_c1");
    verify(calls).endCall("c1", "hangup");
  }

  @Test
  void endedOrMeshSessionsAreLeftAlone() {
    session.setTransport("mesh");
    service.onParticipantJoined(ev("bob", "PA_B"));
    when(calls.activeSession("c1")).thenReturn(Optional.empty());
    service.onParticipantLeft(ev("bob", "PA_B"));

    assertThat(session.getParticipants()).isEmpty();
    verify(calls, never()).save(session);
    verify(calls, never()).endCall(anyString(), anyString());
  }
}
```

- [ ] **Step 2: RED** · **Step 3: Hiện thực** · **Step 4: GREEN** `-Dtest='SfuCallServiceWebhookTest,RtcWebhookDispatcherTest'`
- [ ] **Step 5: Commit** `feat(chat): keep sfu call rosters from LiveKit webhooks`

---

### Task 6: Kiểm tra toàn bộ + tài liệu

- [ ] `mvn spotless:check && mvn test` toàn chat-service xanh.
- [ ] `docs/api-spec.md`: thêm mục "Calls (LiveKit)" — 2 route REST, 3 route STOMP mới, 3 event mới (`call-ring-cancel`, `call-declined`, `call.ended.reason`), field mới trên `call.started`/`call-ring`.
- [ ] `docs/superpowers/plans/2026-10-05-calls-on-livekit.md`: đánh dấu C1 xong (commit + số test).
- [ ] Commit `docs: calls on LiveKit — server contract`.
