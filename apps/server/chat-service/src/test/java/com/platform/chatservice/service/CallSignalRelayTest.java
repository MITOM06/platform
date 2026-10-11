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
import com.platform.chatservice.repository.CallSessionRepository;
import com.platform.chatservice.repository.UserBlockRepository;
import java.time.Instant;
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

/**
 * QC 2026-10-11: the 1-on-1 peer-to-peer relay forwarded offer / ice / end to ANY targetId — a
 * stranger, or someone the target had blocked, could ring them or hang up their call.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CallSignalRelayTest {

  @Mock private ClusterMessageBroker broker;
  @Mock private ConversationMembershipCache membership;
  @Mock private UserBlockRepository blocks;
  @Mock private CallSessionRepository sessions;
  private CallSignalRelay relay;

  @BeforeEach
  void setUp() {
    relay = new CallSignalRelay(broker, membership, blocks, sessions);
    when(membership.isMember("dm", "alice")).thenReturn(true);
    when(membership.isMember("dm", "bob")).thenReturn(true);
    when(membership.isMember("grp", "alice")).thenReturn(true);
    when(membership.isMember("grp", "bob")).thenReturn(true);
    when(membership.isMember("grp", "carol")).thenReturn(true);
  }

  private WebRTCSignalDto signal(String target, String conversationId) {
    WebRTCSignalDto d = new WebRTCSignalDto();
    d.setTargetId(target);
    d.setConversationId(conversationId);
    d.setSdp("v=0");
    return d;
  }

  private List<WebRTCSignalDto> sentTo(String userId) {
    ArgumentCaptor<Object> c = ArgumentCaptor.forClass(Object.class);
    verify(broker, org.mockito.Mockito.atLeast(0))
        .convertAndSendToUser(eq(userId), eq("/queue/webrtc"), c.capture());
    return c.getAllValues().stream().map(WebRTCSignalDto.class::cast).toList();
  }

  @Test
  void aMemberReachesTheOtherMemberStampedWithTheRealSender() {
    WebRTCSignalDto d = signal("bob", "dm");
    d.setSenderId("forged");

    relay.relay("alice", "offer", d);

    assertThat(sentTo("bob"))
        .singleElement()
        .satisfies(s -> assertThat(s.getSenderId()).isEqualTo("alice"));
  }

  @Test
  void aStrangerCannotReachSomeoneThroughTheirConversationId() {
    relay.relay("mallory", "offer", signal("bob", "dm"));
    relay.relayEnd("mallory", signal("bob", "dm"));

    verify(broker, never()).convertAndSendToUser(anyString(), anyString(), any());
  }

  @Test
  void aSignalNamingNoConversationIsDropped() {
    relay.relay("alice", "ice", signal("bob", null));

    verify(broker, never()).convertAndSendToUser(anyString(), anyString(), any());
  }

  @Test
  void theTargetMustBeInTheConversationToo() {
    relay.relay("alice", "offer", signal("carol", "dm"));

    assertThat(sentTo("carol")).isEmpty();
  }

  @Test
  void someoneTheTargetBlockedCannotRingOrHangUpOnThem() {
    when(blocks.existsByBlockerIdAndBlockedId("bob", "alice")).thenReturn(true);

    relay.relay("alice", "offer", signal("bob", "dm"));
    relay.relayEnd("alice", signal("bob", "dm"));

    assertThat(sentTo("bob")).isEmpty();
  }

  @Test
  void anAnswerStillStopsTheAnswerersOtherDevicesRinging() {
    relay.relay("bob", "answer", signal("alice", "dm"));

    assertThat(sentTo("alice")).hasSize(1);
    assertThat(sentTo("bob"))
        .singleElement()
        .satisfies(s -> assertThat(s.getType()).isEqualTo("answered-elsewhere"));
  }

  @Test
  void endReachesTheOtherMember() {
    relay.relayEnd("alice", signal("bob", "dm"));

    assertThat(sentTo("bob"))
        .singleElement()
        .satisfies(s -> assertThat(s.getSenderId()).isEqualTo("alice"));
  }

  @Test
  void stateIsOnlyRelayedBetweenMembers() {
    relay.relayState("mallory", signal("bob", "dm"));
    assertThat(sentTo("bob")).isEmpty();

    relay.relayState("alice", signal("bob", "dm"));
    assertThat(sentTo("bob"))
        .singleElement()
        .satisfies(s -> assertThat(s.getType()).isEqualTo("state"));
  }

  // ---- group mesh: the callId names the conversation ----

  private void groupCall(String callId, Instant endedAt) {
    CallSession s =
        CallSession.builder().callId(callId).conversationId("grp").endedAt(endedAt).build();
    when(sessions.findByCallId(callId)).thenReturn(Optional.of(s));
  }

  @Test
  void groupMeshSignalsGoBetweenMembersOfTheCallsConversation() {
    groupCall("c1", null);
    WebRTCSignalDto d = signal("carol", null);
    d.setCallId("c1");

    relay.relay("alice", "offer", d);

    assertThat(sentTo("carol"))
        .singleElement()
        .satisfies(
            s -> {
              assertThat(s.getType()).isEqualTo("offer");
              assertThat(s.getFromId()).isEqualTo("alice");
            });
  }

  @Test
  void aStrangerWithAGroupCallIdReachesNobody() {
    groupCall("c1", null);
    WebRTCSignalDto d = signal("carol", null);
    d.setCallId("c1");

    relay.relay("mallory", "offer", d);

    assertThat(sentTo("carol")).isEmpty();
  }

  @Test
  void anEndedGroupCallRelaysNothing() {
    groupCall("c1", Instant.now());
    WebRTCSignalDto d = signal("carol", null);
    d.setCallId("c1");

    relay.relay("alice", "ice", d);

    assertThat(sentTo("carol")).isEmpty();
  }
}
