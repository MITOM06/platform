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
        .filter(x -> x.getUserId().equals(userId))
        .findFirst()
        .orElseThrow();
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
