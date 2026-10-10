package com.platform.chatservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.MessageResponse;
import com.platform.chatservice.model.AiTraceData;
import com.platform.chatservice.model.PendingAction;
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
 * events out to connected WebSocket (STOMP) clients: {@code AI_STREAM_CHUNK}, {@code AI_TOOL_CALL},
 * {@code AI_ACTION_PENDING} (a sensitive action awaiting the requester's confirmation — display
 * fields only), {@code AI_STREAM_ERROR} and {@code AI_STREAM_DONE}. Every forwarded event keeps
 * ai-service's {@code replyId} / {@code requesterId} so clients route it to the right bubble. DONE
 * persists the reply once cluster-wide, with its trace (incl. prompt-cache token counts) and {@code
 * pendingActions}.
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
  private final AiPendingActionService pendingActionService;

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
        Map<String, Object> chunkEvent = baseEvent("AI_STREAM_CHUNK", convId, payload);
        chunkEvent.put("chunk", payload.getOrDefault("chunk", ""));
        messagingTemplate.convertAndSend(topic, chunkEvent);
      }
      case "AI_STREAM_DONE" -> deliverDone(payload, convId, topic);
      case "AI_STREAM_ERROR" -> {
        Map<String, Object> errorEvent = baseEvent("AI_STREAM_ERROR", convId, payload);
        errorEvent.put("error", payload.getOrDefault("error", "AI is temporarily unavailable."));
        copyText(payload, errorEvent, "code");
        copyText(payload, errorEvent, "stopReason");
        messagingTemplate.convertAndSend(topic, errorEvent);
      }
      case "AI_TOOL_CALL" -> {
        Map<String, Object> toolCallEvent = baseEvent("AI_TOOL_CALL", convId, payload);
        toolCallEvent.put("toolName", payload.getOrDefault("toolName", ""));
        toolCallEvent.put("inputSummary", payload.getOrDefault("inputSummary", ""));
        if (payload.get("sensitive") instanceof Boolean sensitive) {
          toolCallEvent.put("sensitive", sensitive);
        }
        messagingTemplate.convertAndSend(topic, toolCallEvent);
      }
      case "AI_ACTION_PENDING" -> {
        // A sensitive tool call is waiting for the requester's confirmation (F2). Only the display
        // fields are forwarded (never the tool input); every instance receives this event, so each
        // delivers to its own clients like the other stream events.
        PendingAction action =
            AiPendingActionService.parseAction(payload.get("action"), text(payload, "requesterId"));
        if (action == null) {
          log.warn("AI_ACTION_PENDING without a valid action for conversation {}", convId);
          return;
        }
        Map<String, Object> pendingEvent = baseEvent("AI_ACTION_PENDING", convId, payload);
        pendingEvent.put("action", AiPendingActionService.toWire(action));
        messagingTemplate.convertAndSend(topic, pendingEvent);
      }
      default -> log.warn("Unknown AI response type: {}", type);
    }
  }

  private void deliverDone(Map<String, Object> payload, String convId, String topic) {
    String fullContent = (String) payload.get("fullContent");
    @SuppressWarnings("unchecked")
    Map<String, Object> traceMap = (Map<String, Object>) payload.get("trace");
    List<PendingAction> pendingActions =
        AiPendingActionService.parseActions(
            payload.get("pendingActions"), text(payload, "requesterId"));
    Map<String, Object> doneEvent = baseEvent("AI_STREAM_DONE", convId, payload);
    if (traceMap != null) doneEvent.put("trace", traceMap);
    // Forward RAG citation sources untouched so clients can render clickable
    // references. Each element is {documentId, fileName, score}; passed through
    // as-is (no field reconstruction/stripping). Default to an empty list.
    Object sources = payload.get("sources");
    doneEvent.put("sources", sources != null ? sources : List.of());
    if (!pendingActions.isEmpty()) {
      doneEvent.put(
          "pendingActions", pendingActions.stream().map(AiPendingActionService::toWire).toList());
    }

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
            + (replyId != null ? replyId.toString() : Integer.toHexString(fullContent.hashCode()));
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
      saved =
          messageService.persistAiMessage(
              convId,
              fullContent,
              trace,
              pendingActions,
              replyId != null ? replyId.toString() : null,
              com.platform.chatservice.model.AiSource.fromPayload(sources));
      // An action confirmed from the AI_ACTION_PENDING card while this reply was still streaming
      // resolved before the message existed — apply that outcome now.
      saved = pendingActionService.reconcile(saved);
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

  /**
   * Common fields of every forwarded AI stream event. {@code replyId} (unique per reply) and {@code
   * requesterId} (who asked) are copied through so clients route each event to the right bubble —
   * two @AI requests in one group otherwise streamed into one bubble, and one user's error cleared
   * another user's stream.
   */
  private static Map<String, Object> baseEvent(
      String type, String convId, Map<String, Object> payload) {
    Map<String, Object> event = new HashMap<>();
    event.put("type", type);
    event.put("senderId", AiConstants.AI_BOT_USER_ID);
    event.put("conversationId", convId);
    copyText(payload, event, "replyId");
    copyText(payload, event, "requesterId");
    return event;
  }

  private static void copyText(Map<String, Object> from, Map<String, Object> to, String key) {
    String value = text(from, key);
    if (value != null) to.put(key, value);
  }

  private static String text(Map<String, Object> payload, String key) {
    Object value = payload.get(key);
    return value instanceof String s && !s.isBlank() ? s : null;
  }
}
