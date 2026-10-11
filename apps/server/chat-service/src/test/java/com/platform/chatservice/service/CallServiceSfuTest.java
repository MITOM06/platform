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
    CallSessionWriter writer = new CallSessionWriter(sessions, mongo);
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
            timers,
            new DirectCallGlare(sessions, busy, redis, writer, broker),
            writer,
            new CallRoomProvisioner(roomClient));
  }

  private void conversation(String id, String... members) {
    typedConversation(id, members.length == 2 ? "direct" : "group", members);
  }

  private void typedConversation(String id, String type, String... members) {
    Conversation c = new Conversation();
    c.setId(id);
    c.setType(type);
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

  // ---- Both tapped Call at the same time (glare) ----

  /** {@code caller}'s 1-on-1 in "conv" that has not been answered yet. */
  private CallSession ringingFrom(String caller, String callId) {
    CallSession s =
        CallSession.builder()
            .callId(callId)
            .conversationId("conv")
            .startedBy(caller)
            .transport("sfu")
            .kind("direct")
            .media("video")
            .participants(
                new ArrayList<>(
                    List.of(
                        CallSession.Participant.builder()
                            .userId(caller)
                            .joinedAt(Instant.now())
                            .build())))
            .build();
    when(sessions.findByCallId(callId)).thenReturn(Optional.of(s));
    when(mongo.findAndReplace(any(org.springframework.data.mongodb.core.query.Query.class), eq(s)))
        .thenReturn(s);
    return s;
  }

  private WebRTCSignalDto mergedSignalTo(String userId) {
    return sentTo(userId).stream()
        .filter(d -> "call-merged".equals(d.getType()))
        .findFirst()
        .orElseThrow();
  }

  @Test
  void callingBackWhileTheyAreCallingYouJoinsTheirCall() {
    conversation("conv", "alice", "bob");
    CallSession aliceCall = ringingFrom("alice", "call-a");
    when(busy.busyCallOf("alice")).thenReturn("call-a");

    service.startCall("bob", "conv", "audio", false, true);

    verify(sessions, never()).save(any());
    assertThat(aliceCall.getParticipants())
        .anySatisfy(
            p -> {
              assertThat(p.getUserId()).isEqualTo("bob");
              assertThat(p.getAcceptedAt()).isNotNull();
            });
    verify(busy).markBusy("bob", "call-a");
    assertThat(sentTo("alice")).isEmpty(); // no "busy", no second ring
    WebRTCSignalDto merged = mergedSignalTo("bob");
    assertThat(merged.getCallId()).isEqualTo("call-a");
    assertThat(merged.getSenderId()).isEqualTo("alice");
    assertThat(merged.getConversationId()).isEqualTo("conv");
    assertThat(merged.getMedia()).isEqualTo("video");
    assertThat(merged.getTransport()).isEqualTo("sfu");
    assertThat(merged.getKind()).isEqualTo("direct");
    // Bob's other devices were ringing for Alice's call: they stop.
    assertThat(sentTo("bob"))
        .anySatisfy(
            d -> {
              assertThat(d.getType()).isEqualTo("call-ring-cancel");
              assertThat(d.getCallId()).isEqualTo("call-a");
              assertThat(d.getReason()).isEqualTo("answered_elsewhere");
            });
  }

  @Test
  void aCalleeInACallWithSomeoneElseIsStillBusy() {
    conversation("conv", "alice", "bob");
    CallSession elsewhere = ringingFrom("alice", "call-x");
    elsewhere.setConversationId("conv-with-carol");
    when(busy.busyCallOf("alice")).thenReturn("call-x");

    service.startCall("bob", "conv", "audio", false);

    verify(sessions, never()).save(any());
    assertThat(sentTo("bob"))
        .singleElement()
        .satisfies(
            d -> {
              assertThat(d.getType()).isEqualTo("call-declined");
              assertThat(d.getReason()).isEqualTo("busy");
            });
  }

  @Test
  void aCallTheyAlreadyAnsweredIsNotJoinedAgain() {
    conversation("conv", "alice", "bob");
    CallSession live = ringingFrom("alice", "call-a");
    live.getParticipants()
        .add(CallSession.Participant.builder().userId("bob").acceptedAt(Instant.now()).build());
    when(busy.busyCallOf("alice")).thenReturn("call-a");

    service.startCall("bob", "conv", "audio", false);

    assertThat(sentTo("bob")).extracting(WebRTCSignalDto::getType).containsExactly("call-declined");
  }

  @Test
  void simultaneousStartsEndUpAsOneCall() {
    // Both passed the busy check before either was marked: the conversation claim decides.
    conversation("conv", "alice", "bob");
    ringingFrom("alice", "call-a");
    when(values.setIfAbsent(
            eq(CallService.ACTIVE_KEY_PREFIX + "conv"), anyString(), any(java.time.Duration.class)))
        .thenReturn(false);
    when(values.get(CallService.ACTIVE_KEY_PREFIX + "conv")).thenReturn("call-a");

    service.startCall("bob", "conv", "audio", false, true);

    CallSession bobs = saved();
    verify(sessions).delete(bobs);
    verify(busy).clear("bob", bobs.getCallId());
    verify(busy).markBusy("bob", "call-a");
    assertThat(mergedSignalTo("bob").getCallId()).isEqualTo("call-a");
    assertThat(sentTo("alice")).isEmpty();
    assertThat(broadcast("conv")).isEmpty(); // Bob's own call never surfaced
    verify(timers, never()).after(any(), any());
  }

  @Test
  void anOlderAppThatCannotJoinAMergedCallStillHearsBusy() {
    // Apps before call-merged do not send `merge`: keep v1.1.0 behaviour for them.
    conversation("conv", "alice", "bob");
    ringingFrom("alice", "call-a");
    when(busy.busyCallOf("alice")).thenReturn("call-a");

    service.startCall("bob", "conv", "audio", false);

    verify(busy, never()).markBusy(eq("bob"), anyString());
    assertThat(sentTo("bob"))
        .singleElement()
        .satisfies(
            d -> {
              assertThat(d.getType()).isEqualTo("call-declined");
              assertThat(d.getReason()).isEqualTo("busy");
            });
  }

  @Test
  void anOlderAppLosingASimultaneousStartHearsBusyAndLeavesNoCallBehind() {
    conversation("conv", "alice", "bob");
    ringingFrom("alice", "call-a");
    when(values.setIfAbsent(
            eq(CallService.ACTIVE_KEY_PREFIX + "conv"), anyString(), any(java.time.Duration.class)))
        .thenReturn(false);
    when(values.get(CallService.ACTIVE_KEY_PREFIX + "conv")).thenReturn("call-a");

    service.startCall("bob", "conv", "audio", false);

    CallSession bobs = saved();
    verify(sessions).delete(bobs);
    verify(busy).clear("bob", bobs.getCallId());
    verify(busy, never()).markBusy("bob", "call-a");
    assertThat(sentTo("bob"))
        .singleElement()
        .satisfies(
            d -> {
              assertThat(d.getType()).isEqualTo("call-declined");
              assertThat(d.getReason()).isEqualTo("busy");
              assertThat(d.getSenderId()).isEqualTo("alice");
            });
    assertThat(broadcast("conv")).isEmpty();
  }

  @Test
  void aStaleConversationClaimIsTakenOver() {
    conversation("conv", "alice", "bob");
    when(values.setIfAbsent(
            eq(CallService.ACTIVE_KEY_PREFIX + "conv"), anyString(), any(java.time.Duration.class)))
        .thenReturn(false);
    when(values.get(CallService.ACTIVE_KEY_PREFIX + "conv")).thenReturn("long-gone");

    service.startCall("alice", "conv", "audio", false);

    CallSession s = saved();
    verify(values)
        .set(CallService.ACTIVE_KEY_PREFIX + "conv", s.getCallId(), CallService.ACTIVE_TTL);
    assertThat(sentTo("bob")).extracting(WebRTCSignalDto::getType).containsExactly("call-ring");
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

  // ---- Who may start / join / talk in a call (QC 2026-10-11) ----

  @Test
  void aNonMemberCannotStartACallInSomeoneElsesConversation() {
    conversation("conv", "alice", "bob");

    service.startCall("mallory", "conv", "video", false);

    verify(sessions, never()).save(any());
    assertThat(sentTo("alice")).isEmpty();
    assertThat(sentTo("bob")).isEmpty();
    assertThat(broadcast("conv")).isEmpty();
  }

  @Test
  void aNonMemberCannotStartAMeshCallEither() {
    props.setCallTransport("mesh");
    conversation("grp", "alice", "bob", "carol");

    service.startCall("mallory", "grp", "audio", false);

    verify(sessions, never()).save(any());
    assertThat(sentTo("bob")).isEmpty();
  }

  @Test
  void aGroupWithTwoMembersStillGetsAGroupCall() {
    typedConversation("grp2", "group", "alice", "bob");

    service.startCall("alice", "grp2", "audio", false);

    assertThat(saved().getKind()).isEqualTo("group");
    assertThat(sentTo("bob").get(0).getKind()).isEqualTo("group");
  }

  @Test
  void anOldDirectConversationWithoutATypeIsStillADirectCall() {
    typedConversation("legacy", null, "alice", "bob");

    service.startCall("alice", "legacy", "audio", false);

    assertThat(saved().getKind()).isEqualTo("direct");
  }

  @Test
  void aNonMemberCannotJoinACallByItsId() {
    props.setCallTransport("mesh");
    conversation("grp", "alice", "bob", "carol");
    CallSession s =
        CallSession.builder()
            .callId("c1")
            .conversationId("grp")
            .startedBy("alice")
            .transport("mesh")
            .kind("group")
            .participants(new ArrayList<>())
            .build();
    when(sessions.findByCallId("c1")).thenReturn(Optional.of(s));

    service.joinCall("mallory", "c1");

    verify(mongo, never())
        .findAndReplace(
            any(org.springframework.data.mongodb.core.query.Query.class), any(CallSession.class));
    assertThat(s.getParticipants()).isEmpty();
  }

  /**
   * LiveKit closes an auto-created room ~20 s after its last participant drops, which ended a call
   * (as a plain "hangup") before the 60 s reconnect grace could bring the person back.
   */
  @Test
  void anSfuCallRoomOutlivesTheReconnectGrace() {
    conversation("conv", "alice", "bob");

    service.startCall("alice", "conv", "audio", false);

    String room = "call_" + saved().getCallId();
    ArgumentCaptor<Integer> departure = ArgumentCaptor.forClass(Integer.class);
    ArgumentCaptor<Integer> empty = ArgumentCaptor.forClass(Integer.class);
    verify(roomClient).createRoom(eq(room), empty.capture(), departure.capture(), eq(25));
    assertThat(departure.getValue())
        .isGreaterThan((int) SfuCallService.RECONNECT_GRACE.toSeconds());
    assertThat(empty.getValue()).isGreaterThan((int) CallService.RING_REAPER_DELAY.toSeconds());
  }

  @Test
  void aCallStillStartsWhenTheRoomCannotBeCreatedAhead() {
    conversation("conv", "alice", "bob");
    doThrow(new LiveKitApiException("CreateRoom", 503, null))
        .when(roomClient)
        .createRoom(
            anyString(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.anyInt());

    service.startCall("alice", "conv", "audio", false);

    assertThat(sentTo("bob")).hasSize(1);
  }

  @Test
  void aMeshCallCreatesNoRoom() {
    props.setCallTransport("mesh");
    conversation("conv", "alice", "bob");

    service.startCall("alice", "conv", "audio", false);

    verify(roomClient, never())
        .createRoom(
            anyString(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.anyInt());
  }

  // ---- call:active claim and ghost rings (QC 2026-10-11) ----

  /**
   * A ring whose server-side timer was lost (instance restart) and whose caller's app died never
   * ended: calling that person back merged you into a dead call, or answered "busy" for 6 hours.
   */
  @Test
  void aGhostRingIsEndedAndTheCallBackRingsNormally() {
    conversation("conv", "alice", "bob");
    CallSession ghost = ringingFrom("alice", "call-ghost");
    ghost.setStartedAt(Instant.now().minusSeconds(600));
    // Ending the ghost clears Alice's busy key, so the next look finds her free.
    when(busy.busyCallOf("alice")).thenReturn("call-ghost", (String) null);
    when(mongo.findAndModify(
            any(org.springframework.data.mongodb.core.query.Query.class),
            any(org.springframework.data.mongodb.core.query.Update.class),
            any(org.springframework.data.mongodb.core.FindAndModifyOptions.class),
            eq(CallSession.class)))
        .thenReturn(ghost);

    service.startCall("bob", "conv", "audio", false, true);

    verify(mongo)
        .findAndModify(
            any(org.springframework.data.mongodb.core.query.Query.class),
            any(org.springframework.data.mongodb.core.query.Update.class),
            any(org.springframework.data.mongodb.core.FindAndModifyOptions.class),
            eq(CallSession.class)); // the ghost is ended
    assertThat(ghost.getParticipants()).noneMatch(p -> "bob".equals(p.getUserId()));
    assertThat(sentTo("bob")).noneMatch(d -> "call-merged".equals(d.getType()));
    assertThat(sentTo("alice")).anyMatch(d -> "call-ring".equals(d.getType()));
  }

  @Test
  void theConversationClaimExpiresOnItsOwn() {
    conversation("conv", "alice", "bob");
    when(values.setIfAbsent(anyString(), anyString(), any(java.time.Duration.class)))
        .thenReturn(true);

    service.startCall("alice", "conv", "audio", false);

    String callId = saved().getCallId();
    verify(values).setIfAbsent(eq("call:active:conv"), eq(callId), any(java.time.Duration.class));
  }

  @Test
  void endingACallOnlyDropsAClaimThatStillPointsAtIt() {
    CallSession s = ringingFrom("alice", "call-a");
    when(mongo.findAndModify(
            any(org.springframework.data.mongodb.core.query.Query.class),
            any(org.springframework.data.mongodb.core.query.Update.class),
            any(org.springframework.data.mongodb.core.FindAndModifyOptions.class),
            eq(CallSession.class)))
        .thenReturn(s);

    service.endCall("call-a", "hangup");

    verify(redis, never()).delete("call:active:conv");
    verify(redis)
        .execute(
            any(org.springframework.data.redis.core.script.RedisScript.class),
            eq(List.of("call:active:conv")),
            eq("call-a"));
  }

  /** issueToken refuses a 1-on-1 blocked in EITHER direction; ringing must not promise more. */
  @Test
  void callingSomeoneYouBlockedDoesNotRingThem() {
    conversation("conv", "alice", "bob");
    when(blocks.existsByBlockerIdAndBlockedId("alice", "bob")).thenReturn(true);

    service.startCall("alice", "conv", "audio", false);

    verify(sessions, never()).save(any());
    assertThat(sentTo("bob")).isEmpty();
    assertThat(sentTo("alice"))
        .singleElement()
        .satisfies(d -> assertThat(d.getType()).isEqualTo("call-blocked"));
  }

  /**
   * Both apps send call.cancel then call.leave when the caller gives up; the inbound channel may
   * run leave first. Leaving an unanswered 1-on-1 as its caller is then a cancel too: the callee's
   * devices must stop ringing, not only see call.ended on a topic they may not be subscribed to.
   */
  @Test
  void theCallerLeavingAnUnansweredCallStopsTheRingLikeACancel() {
    conversation("conv", "alice", "bob");
    CallSession s = ringingFrom("alice", "call-a");
    when(mongo.findAndModify(
            any(org.springframework.data.mongodb.core.query.Query.class),
            any(org.springframework.data.mongodb.core.query.Update.class),
            any(org.springframework.data.mongodb.core.FindAndModifyOptions.class),
            eq(CallSession.class)))
        .thenReturn(s);

    service.leaveCall("alice", "call-a");

    assertThat(sentTo("bob"))
        .anySatisfy(
            d -> {
              assertThat(d.getType()).isEqualTo("call-ring-cancel");
              assertThat(d.getCallId()).isEqualTo("call-a");
            });
  }
}
