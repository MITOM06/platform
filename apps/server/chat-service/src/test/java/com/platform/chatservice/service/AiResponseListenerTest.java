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
  @Mock private MessageService messageService;
  @Mock private Message redisMessage;
  @Mock private Tracer tracer;
  @Mock private Propagator propagator;
  @Mock private Span span;
  @Mock private Span.Builder spanBuilder;
  @Mock private Tracer.SpanInScope spanInScope;
  @Mock private TraceContext traceContext;
  @Mock private StringRedisTemplate redisTemplate;
  @Mock private ValueOperations<String, String> valueOperations;

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

    listener =
        new AiResponseListener(
            messagingTemplate, messageService, objectMapper, tracer, propagator, redisTemplate);
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
  void onMessage_AI_STREAM_DONE_savesMessageAndBroadcastsBoth() throws Exception {
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
    when(messageService.saveAiMessage(eq("conv-1"), eq("Full AI reply"), isNull()))
        .thenReturn(saved);

    listener.onMessage(redisMessage, null);

    // saveAiMessage persists AND broadcasts the saved message itself (single-broadcast fix),
    // so the listener must NOT broadcast `saved` again — it only emits the AI_STREAM_DONE event.
    verify(messageService).saveAiMessage(eq("conv-1"), eq("Full AI reply"), isNull());
    verify(messagingTemplate, never()).convertAndSend(anyString(), (Object) eq(saved));
    verify(messagingTemplate)
        .convertAndSend(
            eq("/topic/conversation/conv-1"),
            (Object)
                argThat(
                    arg ->
                        arg instanceof Map
                            && "AI_STREAM_DONE".equals(((Map<?, ?>) arg).get("type"))));
  }

  @Test
  void onMessage_AI_STREAM_DONE_whenClaimLost_doesNotPersist_butStillBroadcastsDone()
      throws Exception {
    // Another instance already claimed this DONE (SET NX returned false) → this instance must NOT
    // persist the AI message (prevents duplicate Mongo inserts) but still emits the DONE event.
    when(valueOperations.setIfAbsent(anyString(), anyString(), any(Duration.class)))
        .thenReturn(false);
    Map<String, Object> payload =
        Map.of(
            "type", "AI_STREAM_DONE",
            "fullContent", "Full AI reply",
            "conversationId", "conv-1");
    when(redisMessage.getBody()).thenReturn(objectMapper.writeValueAsBytes(payload));

    listener.onMessage(redisMessage, null);

    verify(messageService, never()).saveAiMessage(any(), any(), any());
    verify(messagingTemplate)
        .convertAndSend(
            eq("/topic/conversation/conv-1"),
            (Object)
                argThat(
                    arg ->
                        arg instanceof Map
                            && "AI_STREAM_DONE".equals(((Map<?, ?>) arg).get("type"))));
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

    verify(messageService, never()).saveAiMessage(any(), any(), any());
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
}
