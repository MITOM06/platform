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
  @Mock private org.springframework.data.mongodb.core.MongoTemplate mongo;
  @Mock private CallTimers timers;
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
            sessions,
            conversations,
            blocks,
            broker,
            redis,
            new ObjectMapper(),
            props,
            roomClient,
            busy,
            mongo,
            timers);
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
    assertThat(sentTo("bob"))
        .singleElement()
        .satisfies(
            r -> {
              assertThat(r.getType()).isEqualTo("call-ring");
              assertThat(r.getTransport()).isEqualTo("sfu");
              assertThat(r.getCallId()).isEqualTo(s.getCallId());
            });
    assertThat(broadcast("conv"))
        .singleElement()
        .satisfies(
            e -> {
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
    assertThat(sentTo("alice"))
        .singleElement()
        .satisfies(
            d -> {
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
    when(mongo.findAndReplace(any(org.springframework.data.mongodb.core.query.Query.class), eq(s)))
        .thenReturn(s);
    when(mongo.findAndModify(
            any(org.springframework.data.mongodb.core.query.Query.class),
            any(org.springframework.data.mongodb.core.query.Update.class),
            any(org.springframework.data.mongodb.core.FindAndModifyOptions.class),
            eq(CallSession.class)))
        .thenAnswer(
            inv -> {
              s.setEndedAt(Instant.now());
              return s;
            });
    return s;
  }

  @Test
  void leavingADirectSfuCallEndsItForBoth() {
    activeSfu("direct", "alice", "bob");

    service.leaveCall("alice", "c1");

    // Freed, however many paths do it — clear() is a no-op once the key is gone.
    verify(busy, org.mockito.Mockito.atLeastOnce()).clear("alice", "c1");
    verify(busy, org.mockito.Mockito.atLeastOnce()).clear("bob", "c1");
    verify(roomClient).deleteRoom("call_c1");
    assertThat(broadcast("conv"))
        .anySatisfy(
            e -> {
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

    assertThat(broadcast("conv"))
        .singleElement()
        .satisfies(
            e -> {
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

  // ---- final-review fixes ----

  @Test
  void endCallFreesEveryMemberEvenOnesWhoNeverJoined() {
    conversation("conv", "alice", "bob");
    activeSfu("direct", "alice"); // bob was rung (maybe accepted) but never reached LiveKit

    service.endCall("c1", "no_answer");

    verify(busy, org.mockito.Mockito.atLeastOnce()).clear("bob", "c1");
  }

  @Test
  void aConcurrentEndBroadcastsOnlyOnce() {
    activeSfu("group", "alice", "bob");
    when(mongo.findAndModify(
            any(org.springframework.data.mongodb.core.query.Query.class),
            any(org.springframework.data.mongodb.core.query.Update.class),
            any(org.springframework.data.mongodb.core.FindAndModifyOptions.class),
            eq(CallSession.class)))
        .thenReturn(null); // another path already ended it

    service.endCall("c1", "hangup");

    assertThat(broadcast("conv")).isEmpty();
    verify(roomClient, never()).deleteRoom(anyString());
  }

  @Test
  void aStrangerCannotHangUpSomeoneElsesCall() {
    activeSfu("direct", "alice", "bob");

    service.leaveCall("mallory", "c1");

    assertThat(broadcast("conv")).isEmpty();
    verify(roomClient, never()).deleteRoom(anyString());
  }

  @Test
  void anUnansweredSfuCallIsReapedByTheServer() {
    conversation("conv", "alice", "bob");
    service.startCall("alice", "conv", "audio", false);
    CallSession s = saved();
    when(sessions.findByCallId(s.getCallId())).thenReturn(Optional.of(s));
    when(mongo.findAndModify(
            any(org.springframework.data.mongodb.core.query.Query.class),
            any(org.springframework.data.mongodb.core.query.Update.class),
            any(org.springframework.data.mongodb.core.FindAndModifyOptions.class),
            eq(CallSession.class)))
        .thenReturn(s);

    ArgumentCaptor<Runnable> reaper = ArgumentCaptor.forClass(Runnable.class);
    verify(timers).after(eq(CallService.RING_REAPER_DELAY), reaper.capture());
    reaper.getValue().run();

    assertThat(sentTo("bob"))
        .anySatisfy(
            r -> {
              assertThat(r.getType()).isEqualTo("call-ring-cancel");
              assertThat(r.getReason()).isEqualTo("no_answer");
            });
    assertThat(broadcast("conv")).anySatisfy(e -> assertThat(e.getReason()).isEqualTo("no_answer"));
  }

  @Test
  void theReaperLeavesAnAnsweredCallAlone() {
    conversation("conv", "alice", "bob");
    service.startCall("alice", "conv", "audio", false);
    CallSession s = saved();
    s.getParticipants()
        .add(CallSession.Participant.builder().userId("bob").acceptedAt(Instant.now()).build());
    when(sessions.findByCallId(s.getCallId())).thenReturn(Optional.of(s));

    ArgumentCaptor<Runnable> reaper = ArgumentCaptor.forClass(Runnable.class);
    verify(timers).after(eq(CallService.RING_REAPER_DELAY), reaper.capture());
    reaper.getValue().run();

    assertThat(broadcast("conv"))
        .noneSatisfy(e -> assertThat(e.getEvent()).isEqualTo("call.ended"));
  }

  @Test
  void ringAndStartedTellClientsWhetherItIsADirectOrGroupCall() {
    conversation("conv", "alice", "bob");

    service.startCall("alice", "conv", "audio", false);

    assertThat(sentTo("bob").get(0).getKind()).isEqualTo("direct");
    assertThat(broadcast("conv").get(0).getKind()).isEqualTo("direct");
  }
}
