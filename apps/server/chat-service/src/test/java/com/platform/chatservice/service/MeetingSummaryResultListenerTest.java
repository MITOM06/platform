package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.model.MeetingSummaryState;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.MeetingRepository;
import com.platform.chatservice.repository.MessageRepository;
import com.platform.chatservice.service.meeting.MeetingEvents;
import com.platform.chatservice.service.meeting.MeetingGroupService;
import com.platform.chatservice.service.meeting.MeetingStore;
import com.platform.chatservice.service.meeting.MeetingSummaryResultListener;
import com.platform.chatservice.service.meeting.MeetingSummaryStore;
import com.platform.chatservice.service.upload.UploadRefs;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Real Mongo for meetings, summaries, conversations and messages; the cluster broker, push and
 * STOMP events are mocks. Lives in {@code service} because the conversation write support is
 * package-private.
 */
@DataMongoTest
@Testcontainers
class MeetingSummaryResultListenerTest {

  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:7");

  @DynamicPropertySource
  static void mongoProps(DynamicPropertyRegistry registry) {
    registry.add("spring.data.mongodb.uri", mongo::getReplicaSetUrl);
  }

  @Autowired private MongoTemplate template;
  @Autowired private MeetingRepository meetingRepository;
  @Autowired private ConversationRepository conversationRepository;
  @Autowired private MessageRepository messageRepository;

  private final ObjectMapper json = new ObjectMapper();
  private final MessageNotificationService notifications = mock(MessageNotificationService.class);
  private final MeetingEvents events = mock(MeetingEvents.class);
  private MeetingStore store;
  private MeetingSummaryStore summaries;
  private MeetingSummaryResultListener listener;
  private Instant t0;

  @BeforeEach
  void setUp() {
    meetingRepository.deleteAll();
    conversationRepository.deleteAll();
    messageRepository.deleteAll();
    template.dropCollection("meeting_summaries");
    t0 = Instant.now().truncatedTo(ChronoUnit.MILLIS).minusSeconds(3600);

    store = new MeetingStore(template, meetingRepository);
    summaries = org.mockito.Mockito.spy(new MeetingSummaryStore(template));
    ConversationCacheService cache = new ConversationCacheService(conversationRepository);
    ConversationMapper mapper = new ConversationMapper(messageRepository);
    ConversationWriteSupport support =
        new ConversationWriteSupport(cache, template, messageRepository, mapper);
    ConversationService conversations =
        new ConversationService(
            conversationRepository,
            cache,
            null,
            null,
            support,
            mock(ConversationMembershipCache.class),
            mock(UploadRefs.class));
    ClusterMessageBroker broker = mock(ClusterMessageBroker.class);
    MessageMapper messageMapper = new MessageMapper();
    AiMessageService ai =
        new AiMessageService(
            messageRepository,
            conversationRepository,
            broker,
            messageMapper,
            template,
            cache,
            mock(UploadRefs.class));
    MessageService messages = mock(MessageService.class);
    when(messages.createSystemMessage(any(), eq("system.group.created")))
        .thenAnswer(
            inv -> {
              Message saved =
                  messageRepository.save(
                      Message.builder()
                          .conversationId(inv.getArgument(0))
                          .senderId("system")
                          .content("system.group.created")
                          .type("system")
                          .readBy(new ArrayList<>())
                          .build());
              return messageMapper.toResponse(saved);
            });
    MeetingGroupService groups =
        new MeetingGroupService(
            store, conversations, conversationRepository, messages, broker, notifications, cache);
    listener =
        new MeetingSummaryResultListener(store, summaries, groups, ai, notifications, events, json);
  }

  private Meeting pending(String code, String title, String attempt, String... invitees) {
    Meeting m =
        store.insert(
            Meeting.builder()
                .code(code)
                .title(title)
                .hostId("host")
                .inviteeIds(new ArrayList<>(List.of(invitees)))
                .status(MeetingStatus.ENDED)
                .sortAt(t0)
                .createdAt(t0)
                .startedAt(t0)
                .endedAt(t0.plusSeconds(90))
                .attendance(
                    new ArrayList<>(
                        List.of(
                            Meeting.Attendance.builder()
                                .userId("host")
                                .displayName("Host Name")
                                .joinedAt(t0)
                                .build(),
                            Meeting.Attendance.builder()
                                .userId("u1")
                                .displayName("Alice")
                                .joinedAt(t0)
                                .build(),
                            Meeting.Attendance.builder()
                                .userId("u1")
                                .displayName("Alice")
                                .joinedAt(t0)
                                .build())))
                .aiNotesEverEnabled(true)
                .build());
    assertThat(store.claimSummary(m.getId(), attempt, t0)).isTrue();
    return m;
  }

  private void deliver(String meetingId, String attempt, String status) throws Exception {
    String body =
        json.writeValueAsString(
            status.equals("ok")
                ? Map.of(
                    "meetingId", meetingId,
                    "attempt", attempt,
                    "status", status,
                    "summary",
                        Map.of(
                            "overview", "We shipped.",
                            "keyPoints", List.of("k1"),
                            "decisions", List.of("d1"),
                            "actionItems", List.of(Map.of("text", "do x", "assigneeName", "Alice")),
                            "fromMaterials", List.of(),
                            "language", "en"))
                : Map.of("meetingId", meetingId, "attempt", attempt, "status", status));
    var msg = mock(org.springframework.data.redis.connection.Message.class);
    when(msg.getBody()).thenReturn(body.getBytes());
    listener.onMessage(msg, null);
  }

  private List<Message> summaryMessages(String convId) {
    return messageRepository.findAll().stream()
        .filter(m -> convId.equals(m.getConversationId()) && "meeting_summary".equals(m.getType()))
        .toList();
  }

  @Test
  void okCreatesGroupAndPostsSummary() throws Exception {
    Meeting m = pending("ml1-aaaa-aaa", "Sprint review", "a1", "inv1");
    deliver(m.getId(), "a1", "ok");

    Meeting after = store.findById(m.getId()).orElseThrow();
    assertThat(after.getSummaryState()).isEqualTo(MeetingSummaryState.DONE);
    assertThat(after.getGroupConversationId()).isNotNull();
    Conversation c = conversationRepository.findById(after.getGroupConversationId()).orElseThrow();
    assertThat(c.getMeetingId()).isEqualTo(m.getId());
    assertThat(c.getName()).isEqualTo("Họp: Sprint review");
    assertThat(c.getAdmins()).containsExactly("host");
    assertThat(c.getCreatedBy()).isEqualTo("host");
    assertThat(c.getType()).isEqualTo(Conversation.TYPE_GROUP);
    assertThat(c.getParticipants()).containsExactly("host", "inv1", "u1");
    assertThat(c.getPendingMembers()).isEmpty();

    List<Message> posted = summaryMessages(c.getId());
    assertThat(posted).hasSize(1);
    assertThat(posted.get(0).getSenderId()).isEqualTo(AiConstants.AI_BOT_USER_ID);
    JsonNode card = json.readTree(posted.get(0).getContent());
    assertThat(card.get("meetingId").asText()).isEqualTo(m.getId());
    assertThat(card.get("title").asText()).isEqualTo("Sprint review");
    assertThat(card.get("overview").asText()).isEqualTo("We shipped.");
    assertThat(card.get("durationSec").asLong()).isEqualTo(90);
    assertThat(card.get("attendees"))
        .extracting(JsonNode::asText)
        .containsExactly("Host Name", "Alice");
    assertThat(
            messageRepository.findAll().stream()
                .filter(x -> "system.group.created".equals(x.getContent()))
                .count())
        .isEqualTo(1);

    assertThat(summaries.latest(m.getId())).isPresent();
    verify(notifications).notifyNewMessage(eq(AiConstants.AI_BOT_USER_ID), any());

    @SuppressWarnings("unchecked")
    ArgumentCaptor<java.util.Collection<String>> to =
        ArgumentCaptor.forClass(java.util.Collection.class);
    verify(events).summaryReady(any(Meeting.class), to.capture());
    assertThat(to.getValue()).containsExactlyInAnyOrder("host", "inv1", "u1");
  }

  /**
   * Shared contract with ai-service ({@code contracts/meet-summary-result.ok.json}, the producer's
   * spec pins the same file): an ok result is consumed and its summary stored as sent. Only the
   * meetingId is swapped for the real meeting's id.
   */
  @Test
  void theSharedOkFixtureIsConsumedAndItsSummaryStored() throws Exception {
    Meeting m = pending("ml9-aaaa-aaa", "Q3 planning", "a1", "inv1");
    com.fasterxml.jackson.databind.node.ObjectNode fixture =
        (com.fasterxml.jackson.databind.node.ObjectNode)
            json.readTree(
                java.nio.file.Files.readString(
                    java.nio.file.Path.of("..", "contracts", "meet-summary-result.ok.json")));
    assertThat(fixture.get("attempt").asText()).isEqualTo("a1");
    fixture.put("meetingId", m.getId());
    var msg = mock(org.springframework.data.redis.connection.Message.class);
    when(msg.getBody()).thenReturn(json.writeValueAsBytes(fixture));

    listener.onMessage(msg, null);

    assertThat(store.findById(m.getId()).orElseThrow().getSummaryState())
        .isEqualTo(MeetingSummaryState.DONE);
    Map<String, Object> stored = summaries.latest(m.getId()).orElseThrow().getSummary();
    assertThat(stored)
        .containsOnlyKeys(
            "overview", "keyPoints", "decisions", "actionItems", "fromMaterials", "language");
    JsonNode storedJson = json.valueToTree(stored);
    assertThat(storedJson).isEqualTo(fixture.get("summary"));
    verify(events).summaryReady(any(Meeting.class), any());
  }

  @Test
  void sameResultTwiceMakesOneGroupOneMessage() throws Exception {
    Meeting m = pending("ml2-aaaa-aaa", "T", "a1", "inv1");
    deliver(m.getId(), "a1", "ok");
    deliver(m.getId(), "a1", "ok");

    assertThat(conversationRepository.count()).isEqualTo(1);
    String convId = store.findById(m.getId()).orElseThrow().getGroupConversationId();
    assertThat(summaryMessages(convId)).hasSize(1);
    verify(notifications, times(1)).notifyNewMessage(any(), any());
  }

  @Test
  void staleAttemptIgnored() throws Exception {
    Meeting m = pending("ml3-aaaa-aaa", "T", "a1", "inv1");
    deliver(m.getId(), "old", "ok");

    Meeting after = store.findById(m.getId()).orElseThrow();
    assertThat(after.getSummaryState()).isEqualTo(MeetingSummaryState.PENDING);
    assertThat(conversationRepository.count()).isZero();
    assertThat(summaries.latest(m.getId())).isEmpty();
    verify(events, never()).summaryReady(any(), any());
  }

  @Test
  void hostAloneNoGroup() throws Exception {
    Meeting m =
        store.insert(
            Meeting.builder()
                .code("ml4-aaaa-aaa")
                .hostId("host")
                .status(MeetingStatus.ENDED)
                .sortAt(t0)
                .createdAt(t0)
                .aiNotesEverEnabled(true)
                .build());
    store.claimSummary(m.getId(), "a1", t0);
    deliver(m.getId(), "a1", "ok");

    Meeting after = store.findById(m.getId()).orElseThrow();
    assertThat(after.getSummaryState()).isEqualTo(MeetingSummaryState.DONE);
    assertThat(after.getGroupConversationId()).isNull();
    assertThat(summaries.latest(m.getId())).isPresent();
    assertThat(conversationRepository.count()).isZero();
  }

  @Test
  void regenerateReusesGroup() throws Exception {
    Meeting m = pending("ml5-aaaa-aaa", "T", "a1", "inv1");
    deliver(m.getId(), "a1", "ok");
    String convId = store.findById(m.getId()).orElseThrow().getGroupConversationId();

    assertThat(store.claimRegenerate(m.getId(), "a2", t0)).isTrue();
    deliver(m.getId(), "a2", "ok");

    assertThat(store.findById(m.getId()).orElseThrow().getGroupConversationId()).isEqualTo(convId);
    assertThat(conversationRepository.count()).isEqualTo(1);
    assertThat(summaryMessages(convId)).hasSize(2);
    assertThat(
            messageRepository.findAll().stream()
                .filter(x -> "system.group.created".equals(x.getContent()))
                .count())
        .isEqualTo(1);
  }

  @Test
  void groupDeletedThenRegenerateCreatesNew() throws Exception {
    Meeting m = pending("ml6-aaaa-aaa", "T", "a1", "inv1");
    deliver(m.getId(), "a1", "ok");
    String first = store.findById(m.getId()).orElseThrow().getGroupConversationId();
    conversationRepository.deleteById(first);

    assertThat(store.claimRegenerate(m.getId(), "a2", t0)).isTrue();
    deliver(m.getId(), "a2", "ok");

    String second = store.findById(m.getId()).orElseThrow().getGroupConversationId();
    assertThat(second).isNotNull().isNotEqualTo(first);
    assertThat(conversationRepository.existsById(second)).isTrue();
    assertThat(summaryMessages(second)).hasSize(1);
  }

  @Test
  void aFailingSummaryDocSaveStillPostsAndSendsTheEvent() throws Exception {
    Meeting m = pending("ml9-aaaa-aaa", "T", "a1", "inv1");
    org.mockito.Mockito.doThrow(new RuntimeException("mongo down")).when(summaries).save(any());

    deliver(m.getId(), "a1", "ok");

    Meeting after = store.findById(m.getId()).orElseThrow();
    assertThat(after.getSummaryState()).isEqualTo(MeetingSummaryState.DONE);
    assertThat(summaryMessages(after.getGroupConversationId())).hasSize(1);
    verify(events).summaryReady(any(Meeting.class), any());
  }

  @Test
  void aFailingEventSendDoesNotEscape() throws Exception {
    Meeting m = pending("mla-aaaa-aaa", "T", "a1", "inv1");
    org.mockito.Mockito.doThrow(new RuntimeException("stomp down"))
        .when(events)
        .summaryReady(any(Meeting.class), any());

    deliver(m.getId(), "a1", "ok");

    assertThat(summaries.latest(m.getId())).isPresent();
  }

  @Test
  void emptyAndFailedSetStateWithoutGroup() throws Exception {
    Meeting a = pending("ml7-aaaa-aaa", "T", "a1", "inv1");
    deliver(a.getId(), "a1", "empty");
    Meeting b = pending("ml8-aaaa-aaa", "T", "b1", "inv1");
    deliver(b.getId(), "b1", "failed");

    assertThat(store.findById(a.getId()).orElseThrow().getSummaryState())
        .isEqualTo(MeetingSummaryState.EMPTY);
    assertThat(store.findById(b.getId()).orElseThrow().getSummaryState())
        .isEqualTo(MeetingSummaryState.FAILED);
    assertThat(conversationRepository.count()).isZero();
    assertThat(summaries.latest(a.getId())).isEmpty();
    verify(events, times(2)).summaryReady(any(Meeting.class), any());
  }

  @Test
  void unknownStatusOrMissingFieldsIgnored() throws Exception {
    Meeting m = pending("ml9-aaaa-aaa", "T", "a1", "inv1");
    deliver(m.getId(), "a1", "weird");
    var msg = mock(org.springframework.data.redis.connection.Message.class);
    when(msg.getBody()).thenReturn("{\"status\":\"ok\"}".getBytes());
    listener.onMessage(msg, null);

    assertThat(store.findById(m.getId()).orElseThrow().getSummaryState())
        .isEqualTo(MeetingSummaryState.PENDING);
  }

  @Test
  void longNameIsCutTo100() throws Exception {
    Meeting m = pending("mla-aaaa-aaa", "x".repeat(300), "a1", "inv1");
    deliver(m.getId(), "a1", "ok");

    String convId = store.findById(m.getId()).orElseThrow().getGroupConversationId();
    String name = conversationRepository.findById(convId).orElseThrow().getName();
    assertThat(name).hasSize(100).startsWith("Họp: xxx");
  }
}
