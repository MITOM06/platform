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
    assertThat(sentTo("bob"))
        .singleElement()
        .satisfies(
            s -> {
              assertThat(s.getType()).isEqualTo("call-ring-cancel");
              assertThat(s.getReason()).isEqualTo("answered_elsewhere");
              assertThat(s.getCallId()).isEqualTo("c1");
            });
    verify(calls, never()).endCall(anyString(), anyString());
  }

  @Test
  void declineOfADirectCallTellsTheCallerAndEndsIt() {
    service.decline("bob", "c1", "busy");

    assertThat(sentTo("alice"))
        .singleElement()
        .satisfies(
            s -> {
              assertThat(s.getType()).isEqualTo("call-declined");
              assertThat(s.getReason()).isEqualTo("busy");
              assertThat(s.getSenderId()).isEqualTo("bob");
            });
    assertThat(sentTo("bob"))
        .singleElement()
        .satisfies(s -> assertThat(s.getType()).isEqualTo("call-ring-cancel"));
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

    assertThat(sentTo("bob"))
        .singleElement()
        .satisfies(
            s -> {
              assertThat(s.getType()).isEqualTo("call-ring-cancel");
              assertThat(s.getReason()).isEqualTo("no_answer");
            });
    assertThat(sentTo("carol")).hasSize(1);
    assertThat(sentTo("alice")).isEmpty();
    verify(calls).endCall("c1", "no_answer");
  }

  @Test
  void cancelAfterSomeoneJoinedIsIgnored() {
    session
        .getParticipants()
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
