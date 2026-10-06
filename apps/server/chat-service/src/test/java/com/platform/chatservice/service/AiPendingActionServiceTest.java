package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.model.Message;
import com.platform.chatservice.model.PendingAction;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.UpdateDefinition;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiPendingActionServiceTest {

  private static final String CONV = "conv-1";
  private static final String MSG = "msg-ai-1";

  @Mock private MongoTemplate mongoTemplate;
  @Mock private StringRedisTemplate redisTemplate;
  @Mock private ValueOperations<String, String> values;
  @Mock private ClusterMessageBroker clusterBroker;

  private AiPendingActionService service;

  @BeforeEach
  void setUp() {
    when(redisTemplate.opsForValue()).thenReturn(values);
    service =
        new AiPendingActionService(
            mongoTemplate, redisTemplate, clusterBroker, new MessageMapper());
  }

  private static Message aiMessage(String status) {
    return Message.builder()
        .id(MSG)
        .conversationId(CONV)
        .senderId(AiConstants.AI_BOT_USER_ID)
        .content("I'll send it after you confirm.")
        .type("ai")
        .pendingActions(
            List.of(
                PendingAction.builder()
                    .id("act-1")
                    .toolName("mcp__gmail__send_email")
                    .provider("gmail")
                    .summary(Map.of("kind", "send_email"))
                    .status(status)
                    .expiresAt(Instant.parse("2026-10-05T10:10:00Z"))
                    .requesterId("user-9")
                    .build()))
        .build();
  }

  // ---------------------------------------------------------------- parsing

  @Test
  void parseAction_keepsDisplayFieldsOnly_andBoundsTheSummary() {
    Map<String, Object> raw =
        Map.of(
            "id", "act-1",
            "toolName", "mcp__calendar__create_event",
            "provider", "calendar",
            "summary",
                Map.of(
                    "kind", "create_event",
                    "title", "x".repeat(900),
                    "attendees", List.of("a@b.c", Map.of("nested", true)),
                    "nested", Map.of("token", "secret"),
                    "$where", "1"),
            "status", "PENDING",
            "expiresAt", 1_791_000_000_000L,
            "input", Map.of("token", "secret"));

    PendingAction action = AiPendingActionService.parseAction(raw, "user-9");

    assertThat(action.getId()).isEqualTo("act-1");
    assertThat(action.getStatus()).isEqualTo("pending");
    assertThat(action.getRequesterId()).isEqualTo("user-9");
    assertThat(action.getExpiresAt()).isEqualTo(Instant.ofEpochMilli(1_791_000_000_000L));
    assertThat(action.getSummary())
        .containsEntry("kind", "create_event")
        .containsEntry("attendees", List.of("a@b.c"))
        .doesNotContainKeys("nested", "$where");
    assertThat((String) action.getSummary().get("title")).hasSize(500);
    assertThat(AiPendingActionService.toWire(action)).doesNotContainKey("input");
  }

  @Test
  void parseAction_rejectsNonObjectsAndMissingIds() {
    assertThat(AiPendingActionService.parseAction("x", "u")).isNull();
    assertThat(AiPendingActionService.parseAction(Map.of("toolName", "t"), "u")).isNull();
    assertThat(AiPendingActionService.parseAction(Map.of("id", "  "), "u")).isNull();
  }

  @Test
  void parseAction_unknownStatusFallsBackToPending_andOwnRequesterWins() {
    PendingAction action =
        AiPendingActionService.parseAction(
            Map.of("id", "a", "status", "weird", "requesterId", "owner"), "other");
    assertThat(action.getStatus()).isEqualTo("pending");
    assertThat(action.getRequesterId()).isEqualTo("owner");
  }

  @Test
  void parseActions_dedupesAndCaps() {
    List<Object> raw = new java.util.ArrayList<>();
    raw.add(Map.of("id", "dup"));
    raw.add(Map.of("id", "dup"));
    for (int i = 0; i < 20; i++) raw.add(Map.of("id", "a" + i));

    List<PendingAction> actions = AiPendingActionService.parseActions(raw, "u");

    assertThat(actions).hasSize(AiPendingActionService.MAX_ACTIONS_PER_MESSAGE);
    assertThat(actions.stream().filter(a -> a.getId().equals("dup"))).hasSize(1);
    assertThat(AiPendingActionService.parseActions(null, "u")).isEmpty();
    assertThat(AiPendingActionService.parseActions("nope", "u")).isEmpty();
  }

  @Test
  void instant_acceptsIsoMillisAndSeconds() {
    Instant t = Instant.parse("2026-10-05T10:10:00Z");
    assertThat(AiPendingActionService.instant("2026-10-05T10:10:00Z")).isEqualTo(t);
    assertThat(AiPendingActionService.instant(t.toEpochMilli())).isEqualTo(t);
    assertThat(AiPendingActionService.instant(t.getEpochSecond())).isEqualTo(t);
    assertThat(AiPendingActionService.instant(String.valueOf(t.toEpochMilli()))).isEqualTo(t);
    assertThat(AiPendingActionService.instant("soon")).isNull();
  }

  // ---------------------------------------------------------------- resolve

  @Test
  void resolve_remembersOutcome_thenFlipsPendingElementAtomically_andBroadcasts() {
    when(mongoTemplate.findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Message.class)))
        .thenReturn(aiMessage("confirmed"));

    service.resolve("act-1", CONV, "confirmed");

    InOrder order = inOrder(values, mongoTemplate);
    order
        .verify(values)
        .set(eq("chat:ai-action-resolved:act-1"), eq("confirmed"), any(Duration.class));
    ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
    ArgumentCaptor<UpdateDefinition> update = ArgumentCaptor.forClass(UpdateDefinition.class);
    order
        .verify(mongoTemplate)
        .findAndModify(
            query.capture(), update.capture(), any(FindAndModifyOptions.class), eq(Message.class));
    Document filter = query.getValue().getQueryObject();
    assertThat(filter.get("conversationId")).isEqualTo(CONV);
    Document elemMatch = (Document) ((Document) filter.get("pendingActions")).get("$elemMatch");
    assertThat(elemMatch).containsEntry("id", "act-1").containsEntry("status", "pending");
    assertThat(update.getValue().getUpdateObject().get("$set", Document.class))
        .containsEntry("pendingActions.$.status", "confirmed");

    ArgumentCaptor<Object> event = ArgumentCaptor.forClass(Object.class);
    verify(clusterBroker).convertAndSend(eq("/topic/conversation/" + CONV), event.capture());
    @SuppressWarnings("unchecked")
    Map<String, Object> payload = (Map<String, Object>) event.getValue();
    assertThat(payload)
        .containsEntry("type", "MESSAGE_UPDATED")
        .containsEntry("messageId", MSG)
        .containsEntry("conversationId", CONV)
        .containsEntry("content", "I'll send it after you confirm.")
        .doesNotContainKey("editedAt");
    @SuppressWarnings("unchecked")
    List<MessageResponse.PendingActionDto> actions =
        (List<MessageResponse.PendingActionDto>) payload.get("pendingActions");
    assertThat(actions).singleElement().extracting("status").isEqualTo("confirmed");
  }

  @Test
  void resolve_onAnotherInstanceOrBeforeTheMessageExists_broadcastsNothing() {
    // Update matched nothing: either another instance already flipped it, or the AI message is
    // not persisted yet (then reconcile applies the remembered outcome).
    service.resolve("act-1", CONV, "cancelled");

    verify(values).set(eq("chat:ai-action-resolved:act-1"), eq("cancelled"), any(Duration.class));
    verifyNoInteractions(clusterBroker);
  }

  @Test
  void resolve_ignoresUnknownStatusesAndBlankIds() {
    service.resolve("act-1", CONV, "pending");
    service.resolve("act-1", CONV, "approved");
    service.resolve(" ", CONV, "confirmed");
    service.resolve(null, CONV, "confirmed");

    verifyNoInteractions(mongoTemplate, clusterBroker);
    verify(values, never()).set(anyString(), anyString(), any(Duration.class));
  }

  @Test
  void resolve_redisDown_stillUpdatesTheMessage() {
    doThrow(new RedisConnectionFailureException("down"))
        .when(values)
        .set(anyString(), anyString(), any(Duration.class));
    when(mongoTemplate.findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Message.class)))
        .thenReturn(aiMessage("failed"));

    service.resolve("act-1", CONV, "FAILED");

    verify(clusterBroker).convertAndSend(anyString(), any(Object.class));
  }

  @Test
  void resolve_withoutConversationId_matchesOnTheActionAlone() {
    service.resolve("act-1", null, "confirmed");

    ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
    verify(mongoTemplate)
        .findAndModify(
            query.capture(),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Message.class));
    assertThat(query.getValue().getQueryObject()).doesNotContainKey("conversationId");
  }

  // ---------------------------------------------------------------- reconcile

  @Test
  void reconcile_appliesAnOutcomeThatArrivedBeforeThePersist() {
    MessageResponse saved = new MessageMapper().toResponse(aiMessage("pending"));
    when(values.multiGet(List.of("chat:ai-action-resolved:act-1")))
        .thenReturn(Arrays.asList("confirmed"));
    when(mongoTemplate.findById(MSG, Message.class)).thenReturn(aiMessage("confirmed"));

    MessageResponse result = service.reconcile(saved);

    verify(mongoTemplate)
        .findAndModify(
            any(Query.class),
            any(UpdateDefinition.class),
            any(FindAndModifyOptions.class),
            eq(Message.class));
    assertThat(result.pendingActions()).singleElement().extracting("status").isEqualTo("confirmed");
  }

  @Test
  void reconcile_withoutEarlyOutcome_returnsTheSavedMessageUntouched() {
    MessageResponse saved = new MessageMapper().toResponse(aiMessage("pending"));
    when(values.multiGet(anyList())).thenReturn(Arrays.asList((String) null));

    assertThat(service.reconcile(saved)).isSameAs(saved);
    verifyNoInteractions(mongoTemplate);
  }

  @Test
  void reconcile_skipsMessagesWithoutActions_andSurvivesRedisOutage() {
    MessageResponse plain =
        new MessageResponse(MSG, CONV, "u", "hi", "ai", List.of(), Instant.now());
    assertThat(service.reconcile(plain)).isSameAs(plain);
    assertThat(service.reconcile(null)).isNull();

    MessageResponse saved = new MessageMapper().toResponse(aiMessage("pending"));
    when(values.multiGet(anyList())).thenThrow(new RedisConnectionFailureException("down"));
    assertThat(service.reconcile(saved)).isSameAs(saved);
    verifyNoInteractions(mongoTemplate);
  }
}
