package com.platform.chatservice.service;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.MessageResponse;
import io.micrometer.tracing.Span;
import io.micrometer.tracing.TraceContext;
import io.micrometer.tracing.Tracer;
import io.micrometer.tracing.propagation.Propagator;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.messaging.simp.SimpMessagingTemplate;

/**
 * Lenient strictness is needed because the setUp() method wires up a full no-op tracing chain in
 * one place. Some stubs (e.g. propagator.extract for the traceparent path) are only exercised by
 * the relevant test, so strict mode would flag them as unnecessary in the other tests.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiResponseListenerTest {

  @Mock private SimpMessagingTemplate messagingTemplate;
  @Mock private ClusterMessageBroker clusterBroker;
  @Mock private MessageService messageService;
  @Mock private MessageNotificationService notificationService;
  @Mock private Message redisMessage;
  @Mock private Tracer tracer;
  @Mock private Propagator propagator;
  @Mock private Span span;
  @Mock private Span.Builder spanBuilder;
  @Mock private Tracer.SpanInScope spanInScope;
  @Mock private TraceContext traceContext;
  @Mock private StringRedisTemplate redisTemplate;
  @Mock private ValueOperations<String, String> valueOperations;
  @Mock private AiPendingActionService pendingActionService;

  private AiResponseListener listener;

  private final ObjectMapper objectMapper = new ObjectMapper();

  @BeforeEach
  void setUp() {
    // Wire up a no-op tracing chain so the listener logic runs without a live collector.
    // Fresh-root path: tracer.nextSpan() → Span (Span.name/tag/start return self).
    when(tracer.nextSpan()).thenReturn(span);
    when(span.name(anyString())).thenReturn(span);
    when(span.tag(anyString(), anyString())).thenReturn(span);
    when(span.start()).thenReturn(span);
    when(span.context()).thenReturn(traceContext);
    when(tracer.withSpan(any(Span.class))).thenReturn(spanInScope);

    // Propagated-context path: propagator.extract() → Span.Builder → Span.
    when(propagator.extract(any(), any())).thenReturn(spanBuilder);
    when(spanBuilder.name(anyString())).thenReturn(spanBuilder);
    when(spanBuilder.tag(anyString(), anyString())).thenReturn(spanBuilder);
    when(spanBuilder.start()).thenReturn(span);

    // AI_STREAM_DONE dedup claim: default to winning the SET NX so the persist path runs.
    when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    when(valueOperations.setIfAbsent(anyString(), anyString(), any(Duration.class)))
        .thenReturn(true);
    // No early action outcomes by default: reconcile hands the saved message back unchanged.
    when(pendingActionService.reconcile(any())).thenAnswer(inv -> inv.getArgument(0));

    listener =
        new AiResponseListener(
            messagingTemplate,
            clusterBroker,
            messageService,
            notificationService,
            objectMapper,
            tracer,
            propagator,
            redisTemplate,
            pendingActionService);
  }

  @Test
  void onMessage_AI_STREAM_CHUNK_broadcastsChunkToTopic() throws Exception {
    Map<String, Object> payload =
        Map.of(
            "type", "AI_STREAM_CHUNK",
            "chunk", "Hello",
            "conversationId", "conv-1");
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

    listener.onMessage(redisMessage, null);

    verify(messagingTemplate)
        .convertAndSend(
            eq("/topic/conversation/conv-1"),
            (Object)
                argThat(
                    arg ->
                        arg instanceof Map
                            && "AI_STREAM_CHUNK".equals(((Map<?, ?>) arg).get("type"))
                            && "Hello".equals(((Map<?, ?>) arg).get("chunk"))
                            && AiConstants.AI_BOT_USER_ID.equals(
                                ((Map<?, ?>) arg).get("senderId"))));
  }

  @Test
  @SuppressWarnings("unchecked")
  void onMessage_AI_STREAM_DONE_persistsThenDeliversMessageAndDoneInOneOrderedClusterBatch()
      throws Exception {
    Map<String, Object> payload =
        Map.of(
            "type", "AI_STREAM_DONE",
            "fullContent", "Full AI reply",
            "conversationId", "conv-1");
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));
    MessageResponse saved =
        new MessageResponse(
            "msg-ai-1",
            "conv-1",
            AiConstants.AI_BOT_USER_ID,
            "Full AI reply",
            "ai",
            List.of(),
            Instant.now());
    when(messageService.persistAiMessage(eq("conv-1"), eq("Full AI reply"), isNull(), anyList()))
        .thenReturn(saved);

    listener.onMessage(redisMessage, null);

    // Persist WITHOUT broadcasting, then deliver [saved, DONE] together so every client — on any
    // instance — sees the saved message before AI_STREAM_DONE.
    org.mockito.ArgumentCaptor<List<Object>> batch =
        org.mockito.ArgumentCaptor.forClass(List.class);
    verify(clusterBroker).convertAndSendAll(eq("/topic/conversation/conv-1"), batch.capture());
    org.assertj.core.api.Assertions.assertThat(batch.getValue()).hasSize(2);
    org.assertj.core.api.Assertions.assertThat(batch.getValue().get(0)).isSameAs(saved);
    org.assertj.core.api.Assertions.assertThat(
            ((Map<String, Object>) batch.getValue().get(1)).get("type"))
        .isEqualTo("AI_STREAM_DONE");
    // The reply must reach participants who are not looking at this conversation (banner, unread
    // badge, push) — the topic broadcast alone only reaches the open chat.
    verify(notificationService).notifyNewMessage(AiConstants.AI_BOT_USER_ID, saved);
    verify(messageService, never()).saveAiMessage(any(), any(), any());
    verifyNoInteractions(messagingTemplate);
  }

  @Test
  void onMessage_AI_STREAM_DONE_claimsPerReplyId_soIdenticalRepliesAreBothSaved() throws Exception {
    // Two replies with the same text (e.g. "Đã nhớ!") must get different claim keys; keying on
    // the text alone dropped the second one for DONE_CLAIM_TTL.
    for (String replyId : List.of("reply-a", "reply-b")) {
      Map<String, Object> payload =
          Map.of(
              "type", "AI_STREAM_DONE",
              "fullContent", "Đã nhớ!",
              "conversationId", "conv-1",
              "replyId", replyId);
      when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));
      listener.onMessage(redisMessage, null);
    }

    verify(valueOperations).setIfAbsent(eq("ai:done:conv-1:reply-a"), anyString(), any());
    verify(valueOperations).setIfAbsent(eq("ai:done:conv-1:reply-b"), anyString(), any());
    verify(messageService, org.mockito.Mockito.times(2))
        .persistAiMessage(eq("conv-1"), eq("Đã nhớ!"), isNull(), anyList());
  }

  @Test
  void onMessage_AI_STREAM_DONE_withoutReplyId_fallsBackToContentHashClaim() throws Exception {
    Map<String, Object> payload =
        Map.of(
            "type", "AI_STREAM_DONE",
            "fullContent", "Full AI reply",
            "conversationId", "conv-1");
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

    listener.onMessage(redisMessage, null);

    verify(valueOperations)
        .setIfAbsent(
            eq("ai:done:conv-1:" + Integer.toHexString("Full AI reply".hashCode())),
            anyString(),
            any());
  }

  @Test
  void onMessage_AI_STREAM_DONE_whenClaimLost_doesNothing_theWinnerDeliversEverything()
      throws Exception {
    // Another instance already claimed this DONE (SET NX returned false) → this instance must NOT
    // persist (no duplicate insert) and must not emit DONE either: the winner delivers the saved
    // message + DONE cluster-wide in one ordered batch.
    when(valueOperations.setIfAbsent(anyString(), anyString(), any(Duration.class)))
        .thenReturn(false);
    Map<String, Object> payload =
        Map.of(
            "type", "AI_STREAM_DONE",
            "fullContent", "Full AI reply",
            "conversationId", "conv-1");
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

    listener.onMessage(redisMessage, null);

    verify(messageService, never()).persistAiMessage(any(), any(), any(), any());
    verify(notificationService, never()).notifyNewMessage(any(), any());
    verifyNoInteractions(messagingTemplate, clusterBroker);
  }

  @Test
  void onMessage_AI_STREAM_DONE_withoutContent_endsTheStreamLocally_withoutClaiming()
      throws Exception {
    Map<String, Object> payload = Map.of("type", "AI_STREAM_DONE", "conversationId", "conv-1");
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

    listener.onMessage(redisMessage, null);

    verify(valueOperations, never()).setIfAbsent(anyString(), anyString(), any(Duration.class));
    verify(messagingTemplate)
        .convertAndSend(
            eq("/topic/conversation/conv-1"),
            (Object)
                argThat(
                    arg ->
                        arg instanceof Map
                            && "AI_STREAM_DONE".equals(((Map<?, ?>) arg).get("type"))));
    verifyNoInteractions(clusterBroker);
  }

  @Test
  void onMessage_AI_STREAM_DONE_whenPersistFails_stillEndsTheStreamClusterWide() throws Exception {
    Map<String, Object> payload =
        Map.of(
            "type", "AI_STREAM_DONE",
            "fullContent", "Full AI reply",
            "conversationId", "conv-1");
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));
    when(messageService.persistAiMessage(any(), any(), any(), any()))
        .thenThrow(new RuntimeException("mongo down"));

    listener.onMessage(redisMessage, null);

    verify(clusterBroker)
        .convertAndSend(
            eq("/topic/conversation/conv-1"),
            (Object)
                argThat(
                    arg ->
                        arg instanceof Map
                            && "AI_STREAM_DONE".equals(((Map<?, ?>) arg).get("type"))));
    verify(notificationService, never()).notifyNewMessage(any(), any());
  }

  @Test
  void onMessage_AI_STREAM_ERROR_broadcastsErrorEvent() throws Exception {
    Map<String, Object> payload =
        Map.of(
            "type", "AI_STREAM_ERROR",
            "error", "AI unavailable",
            "conversationId", "conv-1");
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

    listener.onMessage(redisMessage, null);

    verify(messageService, never()).persistAiMessage(any(), any(), any(), any());
    verify(messagingTemplate)
        .convertAndSend(
            eq("/topic/conversation/conv-1"),
            (Object)
                argThat(
                    arg ->
                        arg instanceof Map
                            && "AI_STREAM_ERROR".equals(((Map<?, ?>) arg).get("type"))
                            && "AI unavailable".equals(((Map<?, ?>) arg).get("error"))));
  }

  @Test
  void onMessage_AI_TOOL_CALL_broadcastsToolCallToTopic() throws Exception {
    Map<String, Object> payload =
        Map.of(
            "type", "AI_TOOL_CALL",
            "toolName", "search_messages",
            "inputSummary", "{\"query\":\"Flutter\"}",
            "conversationId", "conv-1");
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

    listener.onMessage(redisMessage, null);

    verify(messagingTemplate)
        .convertAndSend(
            eq("/topic/conversation/conv-1"),
            (Object)
                argThat(
                    arg ->
                        arg instanceof Map
                            && "AI_TOOL_CALL".equals(((Map<?, ?>) arg).get("type"))
                            && "search_messages".equals(((Map<?, ?>) arg).get("toolName"))
                            && AiConstants.AI_BOT_USER_ID.equals(
                                ((Map<?, ?>) arg).get("senderId"))));
  }

  @Test
  void onMessage_missingConversationId_doesNothing() throws Exception {
    Map<String, Object> payload = Map.of("type", "AI_STREAM_CHUNK", "chunk", "hi");
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

    listener.onMessage(redisMessage, null);

    verifyNoInteractions(messagingTemplate, messageService);
  }

  @Test
  void onMessage_withTraceparent_extractsContextAndDeliversToStomp() throws Exception {
    // When a _traceparent is present the listener must still deliver the STOMP event,
    // and must use propagator.extract() to restore the remote parent context.
    Map<String, Object> payload =
        Map.of(
            "type", "AI_STREAM_CHUNK",
            "chunk", "traced",
            "conversationId", "conv-traced",
            "_traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

    listener.onMessage(redisMessage, null);

    verify(propagator).extract(any(), any());
    verify(messagingTemplate)
        .convertAndSend(
            eq("/topic/conversation/conv-traced"),
            (Object)
                argThat(
                    arg ->
                        arg instanceof Map
                            && "AI_STREAM_CHUNK".equals(((Map<?, ?>) arg).get("type"))
                            && "traced".equals(((Map<?, ?>) arg).get("chunk"))));
    // Span lifecycle: scope must be closed and the span ended after delivery.
    verify(spanInScope).close();
    verify(span).end();
  }

  @Test
  void onMessage_endsSpanAndClosesScope_evenWithoutTraceparent() throws Exception {
    // Fresh-root path (no _traceparent) must still close the scope and end the span.
    Map<String, Object> payload =
        Map.of(
            "type", "AI_STREAM_CHUNK",
            "chunk", "hi",
            "conversationId", "conv-1");
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

    listener.onMessage(redisMessage, null);

    verify(tracer).nextSpan();
    verify(spanInScope).close();
    verify(span).end();
  }

  // ---------------------------------------------------------------- round 2 wiring

  @SuppressWarnings("unchecked")
  private Map<String, Object> capturedLocal() {
    org.mockito.ArgumentCaptor<Object> event = org.mockito.ArgumentCaptor.forClass(Object.class);
    verify(messagingTemplate).convertAndSend(eq("/topic/conversation/conv-1"), event.capture());
    return (Map<String, Object>) event.getValue();
  }

  private void receive(Map<String, Object> payload) throws Exception {
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));
    listener.onMessage(redisMessage, null);
  }

  @Test
  void chunk_forwardsReplyIdAndRequesterId() throws Exception {
    receive(
        Map.of(
            "type", "AI_STREAM_CHUNK",
            "chunk", "Hi",
            "conversationId", "conv-1",
            "replyId", "r-1",
            "requesterId", "user-9"));

    Map<String, Object> event = capturedLocal();
    org.assertj.core.api.Assertions.assertThat(event)
        .containsEntry("type", "AI_STREAM_CHUNK")
        .containsEntry("chunk", "Hi")
        .containsEntry("replyId", "r-1")
        .containsEntry("requesterId", "user-9");
  }

  @Test
  void toolCall_forwardsReplyIdAndRequesterId() throws Exception {
    receive(
        Map.of(
            "type", "AI_TOOL_CALL",
            "toolName", "web_search",
            "inputSummary", "q",
            "sensitive", false,
            "conversationId", "conv-1",
            "replyId", "r-1",
            "requesterId", "user-9"));

    org.assertj.core.api.Assertions.assertThat(capturedLocal())
        .containsEntry("type", "AI_TOOL_CALL")
        .containsEntry("sensitive", false)
        .containsEntry("replyId", "r-1")
        .containsEntry("requesterId", "user-9");
  }

  @Test
  void error_forwardsRoutingCodeAndStopReason() throws Exception {
    receive(
        Map.of(
            "type", "AI_STREAM_ERROR",
            "error", "The AI returned an empty response.",
            "code", "AI_EMPTY_RESPONSE",
            "stopReason", "refusal",
            "conversationId", "conv-1",
            "replyId", "r-1",
            "requesterId", "user-9"));

    org.assertj.core.api.Assertions.assertThat(capturedLocal())
        .containsEntry("code", "AI_EMPTY_RESPONSE")
        .containsEntry("stopReason", "refusal")
        .containsEntry("replyId", "r-1")
        .containsEntry("requesterId", "user-9");
  }

  @Test
  void actionPending_forwardsOnlyDisplayFields_withRouting() throws Exception {
    receive(
        Map.of(
            "type", "AI_ACTION_PENDING",
            "conversationId", "conv-1",
            "replyId", "r-1",
            "requesterId", "user-9",
            "action",
                Map.of(
                    "id", "act-1",
                    "toolName", "mcp__gmail__send_email",
                    "provider", "gmail",
                    "summary", Map.of("kind", "send_email", "to", "a@b.c", "subject", "Hi"),
                    "status", "pending",
                    "expiresAt", "2026-10-05T10:10:00Z",
                    "input", Map.of("body", "secret draft"))));

    Map<String, Object> event = capturedLocal();
    org.assertj.core.api.Assertions.assertThat(event)
        .containsEntry("type", "AI_ACTION_PENDING")
        .containsEntry("replyId", "r-1")
        .containsEntry("requesterId", "user-9")
        .containsEntry("senderId", AiConstants.AI_BOT_USER_ID);
    @SuppressWarnings("unchecked")
    Map<String, Object> action = (Map<String, Object>) event.get("action");
    org.assertj.core.api.Assertions.assertThat(action)
        .containsEntry("id", "act-1")
        .containsEntry("toolName", "mcp__gmail__send_email")
        .containsEntry("provider", "gmail")
        .containsEntry("status", "pending")
        .containsEntry("expiresAt", "2026-10-05T10:10:00Z")
        .containsEntry("requesterId", "user-9")
        .doesNotContainKey("input");
    verifyNoInteractions(clusterBroker, messageService);
  }

  @Test
  void actionPending_withoutValidAction_isDropped() throws Exception {
    receive(Map.of("type", "AI_ACTION_PENDING", "conversationId", "conv-1", "action", "x"));

    verifyNoInteractions(messagingTemplate, clusterBroker);
  }

  @Test
  @SuppressWarnings("unchecked")
  void done_persistsPendingActionsAndCacheTokens_andForwardsRouting() throws Exception {
    Map<String, Object> trace =
        Map.of(
            "inputTokens", 1200,
            "outputTokens", 80,
            "cachedInputTokens", 900,
            "cacheCreationInputTokens", 250,
            "model", "claude-sonnet-4-5");
    receive(
        Map.of(
            "type", "AI_STREAM_DONE",
            "fullContent", "I will send it once you confirm.",
            "conversationId", "conv-1",
            "replyId", "r-1",
            "requesterId", "user-9",
            "trace", trace,
            "pendingActions",
                List.of(
                    Map.of(
                        "id", "act-1",
                        "toolName", "mcp__gmail__send_email",
                        "provider", "gmail",
                        "summary", Map.of("kind", "send_email", "subject", "Hi"),
                        "status", "pending",
                        "expiresAt", "2026-10-05T10:10:00Z"))));

    org.mockito.ArgumentCaptor<com.platform.chatservice.model.AiTraceData> traceArg =
        org.mockito.ArgumentCaptor.forClass(com.platform.chatservice.model.AiTraceData.class);
    org.mockito.ArgumentCaptor<List<com.platform.chatservice.model.PendingAction>> actionsArg =
        org.mockito.ArgumentCaptor.forClass(List.class);
    verify(messageService)
        .persistAiMessage(
            eq("conv-1"),
            eq("I will send it once you confirm."),
            traceArg.capture(),
            actionsArg.capture());
    org.assertj.core.api.Assertions.assertThat(traceArg.getValue().getCachedInputTokens())
        .isEqualTo(900);
    org.assertj.core.api.Assertions.assertThat(traceArg.getValue().getCacheCreationInputTokens())
        .isEqualTo(250);
    org.assertj.core.api.Assertions.assertThat(traceArg.getValue().getInputTokens())
        .isEqualTo(1200);
    com.platform.chatservice.model.PendingAction action = actionsArg.getValue().get(0);
    org.assertj.core.api.Assertions.assertThat(action.getId()).isEqualTo("act-1");
    org.assertj.core.api.Assertions.assertThat(action.getRequesterId()).isEqualTo("user-9");
    org.assertj.core.api.Assertions.assertThat(action.getStatus()).isEqualTo("pending");
    org.assertj.core.api.Assertions.assertThat(action.getExpiresAt())
        .isEqualTo(Instant.parse("2026-10-05T10:10:00Z"));
    verify(pendingActionService).reconcile(any());
  }

  @Test
  @SuppressWarnings("unchecked")
  void done_eventCarriesReplyIdRequesterIdAndPendingActions() throws Exception {
    MessageResponse saved =
        new MessageResponse(
            "msg-ai-1", "conv-1", AiConstants.AI_BOT_USER_ID, "ok", "ai", List.of(), Instant.now());
    when(messageService.persistAiMessage(any(), any(), any(), any())).thenReturn(saved);
    receive(
        Map.of(
            "type", "AI_STREAM_DONE",
            "fullContent", "ok",
            "conversationId", "conv-1",
            "replyId", "r-1",
            "requesterId", "user-9",
            "pendingActions", List.of(Map.of("id", "act-1", "toolName", "t"))));

    org.mockito.ArgumentCaptor<List<Object>> batch =
        org.mockito.ArgumentCaptor.forClass(List.class);
    verify(clusterBroker).convertAndSendAll(eq("/topic/conversation/conv-1"), batch.capture());
    Map<String, Object> done = (Map<String, Object>) batch.getValue().get(1);
    org.assertj.core.api.Assertions.assertThat(done)
        .containsEntry("replyId", "r-1")
        .containsEntry("requesterId", "user-9")
        .containsKey("pendingActions");
  }
}
