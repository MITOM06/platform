package com.platform.chatservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.model.AiTraceData;
import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import io.micrometer.tracing.propagation.Propagator;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Subscribes to the Redis {@code ai:response:{conversationId}} channel and fans the AI streaming
 * events out to connected WebSocket (STOMP) clients.
 *
 * <p>When the ai-service includes a {@code _traceparent} field in its payload, the W3C context is
 * extracted and the STOMP-delivery work runs as a child span of that context — completing the
 * end-to-end distributed trace: chat-service → RabbitMQ → ai-service → Redis → chat-service →
 * STOMP.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AiResponseListener implements MessageListener {

  /** Dedupe window for the "who persists this AI_STREAM_DONE" claim across instances. */
  private static final Duration DONE_CLAIM_TTL = Duration.ofMinutes(5);

  private final SimpMessagingTemplate messagingTemplate;
  private final ClusterMessageBroker clusterBroker;
  private final MessageService messageService;
  private final MessageNotificationService notificationService;
  private final ObjectMapper objectMapper;
  private final Tracer tracer;
  private final Propagator propagator;
  private final StringRedisTemplate redisTemplate;

  @Override
  @SuppressWarnings("null")
  public void onMessage(org.springframework.data.redis.connection.Message message, byte[] pattern) {
    try {
      Map<String, Object> payload =
          objectMapper.readValue(message.getBody(), new TypeReference<>() {});
      String type = (String) payload.get("type");
      String convId = (String) payload.get("conversationId");
      if (convId == null || type == null) {
        log.warn("AI response payload missing type or conversationId");
        return;
      }

      // Extract W3C traceparent injected by the ai-service so the STOMP
      // delivery spans become children of the same end-to-end trace.
      String traceparent = (String) payload.get("_traceparent");
      Span span = buildDeliverSpan(traceparent, type, convId);
      // Close the scope BEFORE ending the span (correct OTel lifecycle ordering).
      Tracer.SpanInScope scope = tracer.withSpan(span);
      try {
        deliverToStomp(payload, type, convId);
      } finally {
        scope.close();
        span.end();
      }
    } catch (Exception e) {
      log.error("Failed to process AI response message", e);
    }
  }

  /**
   * Builds a child span from the propagated {@code traceparent} when present, or a fresh root span
   * when the field is absent/null.
   *
   * <p>{@code propagator.extract()} returns a {@link Span.Builder} already wired to the remote
   * parent context — just name it and start it.
   */
  private Span buildDeliverSpan(String traceparent, String type, String convId) {
    if (traceparent != null && !traceparent.isBlank()) {
      try {
        // Wrap the single _traceparent value in the Map carrier the propagator expects.
        Map<String, String> carrier = Map.of("traceparent", traceparent);
        return propagator
            .extract(carrier, Map::get)
            .name("ai.response.deliver")
            .tag("messaging.type", type)
            .tag("conversation.id", convId)
            .start();
      } catch (Exception ex) {
        log.warn(
            "Could not extract trace context from _traceparent '{}': {}",
            traceparent,
            ex.getMessage());
      }
    }
    // No traceparent — start a fresh span so delivery is still observable.
    return tracer
        .nextSpan()
        .name("ai.response.deliver")
        .tag("messaging.type", type)
        .tag("conversation.id", convId)
        .start();
  }

  private void deliverToStomp(Map<String, Object> payload, String type, String convId) {
    String topic = "/topic/conversation/" + convId;
    switch (type) {
      case "AI_STREAM_CHUNK" -> {
        String chunk = (String) payload.getOrDefault("chunk", "");
        messagingTemplate.convertAndSend(
            topic,
            Map.of(
                "type",
                "AI_STREAM_CHUNK",
                "chunk",
                chunk,
                "senderId",
                AiConstants.AI_BOT_USER_ID,
                "conversationId",
                convId));
      }
      case "AI_STREAM_DONE" -> {
        String fullContent = (String) payload.get("fullContent");
        @SuppressWarnings("unchecked")
        Map<String, Object> traceMap = (Map<String, Object>) payload.get("trace");
        Map<String, Object> doneEvent = new HashMap<>();
        doneEvent.put("type", "AI_STREAM_DONE");
        doneEvent.put("senderId", AiConstants.AI_BOT_USER_ID);
        doneEvent.put("conversationId", convId);
        if (traceMap != null) doneEvent.put("trace", traceMap);
        // Forward RAG citation sources untouched so clients can render clickable
        // references. Each element is {documentId, fileName, score}; passed through
        // as-is (no field reconstruction/stripping). Default to an empty list.
        Object sources = payload.get("sources");
        doneEvent.put("sources", sources != null ? sources : java.util.List.of());

        if (fullContent == null || fullContent.isBlank()) {
          // Nothing to persist. Every instance receives this Redis event, so each one tells its
          // own clients that the stream ended.
          messagingTemplate.convertAndSend(topic, doneEvent);
          return;
        }
        // Every instance subscribed to the Redis ai:response:* pattern receives this DONE event,
        // so guard the Mongo write with an atomic SET NX claim: only the instance that wins the
        // claim persists the message (no N duplicate inserts under multi-instance) and it alone
        // delivers BOTH the persisted message and the DONE event, cluster-wide, in one ordered
        // batch — clients always see the saved message before AI_STREAM_DONE. Losers send nothing.
        // Key on the per-reply id when ai-service sends one: keying on the text alone
        // silently dropped any reply identical to one in the last DONE_CLAIM_TTL.
        Object replyId = payload.get("replyId");
        String claimKey =
            "ai:done:"
                + convId
                + ":"
                + (replyId != null
                    ? replyId.toString()
                    : Integer.toHexString(fullContent.hashCode()));
        Boolean claimed = redisTemplate.opsForValue().setIfAbsent(claimKey, "1", DONE_CLAIM_TTL);
        if (!Boolean.TRUE.equals(claimed)) {
          return;
        }
        AiTraceData trace = null;
        if (traceMap != null) {
          try {
            trace = objectMapper.convertValue(traceMap, AiTraceData.class);
          } catch (Exception ex) {
            log.warn("Failed to deserialize AiTraceData", ex);
          }
        }
        MessageResponse saved = null;
        try {
          saved = messageService.persistAiMessage(convId, fullContent, trace);
        } catch (Exception ex) {
          log.error("Failed to persist AI reply for conversation {}", convId, ex);
        }
        if (saved == null) {
          // Still end the stream everywhere so no client keeps a spinner up.
          clusterBroker.convertAndSend(topic, doneEvent);
          return;
        }
        clusterBroker.convertAndSendAll(topic, List.of(saved, doneEvent));
        // The claiming instance is also the one that notifies participants who are elsewhere.
        notificationService.notifyNewMessage(AiConstants.AI_BOT_USER_ID, saved);
      }
      case "AI_STREAM_ERROR" -> {
        String error = (String) payload.getOrDefault("error", "AI is temporarily unavailable.");
        String code = (String) payload.get("code");
        Map<String, Object> errorEvent = new HashMap<>();
        errorEvent.put("type", "AI_STREAM_ERROR");
        errorEvent.put("error", error);
        errorEvent.put("senderId", AiConstants.AI_BOT_USER_ID);
        errorEvent.put("conversationId", convId);
        if (code != null) errorEvent.put("code", code);
        messagingTemplate.convertAndSend(topic, errorEvent);
      }
      case "AI_TOOL_CALL" -> {
        String toolName = (String) payload.getOrDefault("toolName", "");
        String inputSummary = (String) payload.getOrDefault("inputSummary", "");
        Boolean sensitive = (Boolean) payload.get("sensitive");
        Map<String, Object> toolCallEvent = new HashMap<>();
        toolCallEvent.put("type", "AI_TOOL_CALL");
        toolCallEvent.put("toolName", toolName);
        toolCallEvent.put("inputSummary", inputSummary);
        toolCallEvent.put("senderId", AiConstants.AI_BOT_USER_ID);
        toolCallEvent.put("conversationId", convId);
        if (sensitive != null) toolCallEvent.put("sensitive", sensitive);
        messagingTemplate.convertAndSend(topic, toolCallEvent);
      }
      default -> log.warn("Unknown AI response type: {}", type);
    }
  }
}
