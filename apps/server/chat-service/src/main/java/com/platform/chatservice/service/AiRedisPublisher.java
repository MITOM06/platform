package com.platform.chatservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.RabbitMqConfig;
import com.platform.chatservice.dto.AiHistoryEntry;
import com.platform.chatservice.dto.AiRequestPayload;
import com.platform.chatservice.repository.ConversationRepository;
import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import io.micrometer.tracing.propagation.Propagator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Publishes AI request jobs to RabbitMQ.
 *
 * <p>Injects W3C {@code traceparent} into the AMQP message headers so that the ai-service can
 * extract the propagated context and continue the same distributed trace (chat-service → RabbitMQ →
 * ai-service).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiRedisPublisher {

  /** ai-service's streaming channel, relayed to STOMP by AiResponseListener. */
  private static final String AI_RESPONSE_CHANNEL_PREFIX = "ai:response:";

  private final RabbitTemplate rabbitTemplate;
  private final Tracer tracer;
  private final Propagator propagator;
  private final ConversationRepository conversationRepository;
  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;

  public void publishAiRequest(
      String conversationId,
      String userId,
      String displayName,
      String content,
      List<AiHistoryEntry> history,
      String role,
      List<String> perms,
      List<String> departmentIds) {
    // Enrich the AI job with the conversation's department so ai-service can
    // department-scope RAG/tools for the group bot (P6). Null for personal chats.
    String departmentId =
        conversationRepository.findById(conversationId).map(c -> c.getDepartmentId()).orElse(null);
    AiRequestPayload payload =
        new AiRequestPayload(
            conversationId,
            userId,
            displayName,
            content,
            history,
            departmentId,
            role,
            perms == null ? List.of() : perms,
            departmentIds == null ? List.of() : departmentIds);

    // Create a child span for the RabbitMQ publish operation. The scope is closed
    // explicitly BEFORE the span is ended so the thread-local context is cleared
    // first (correct OTel span lifecycle ordering).
    Span span = tracer.nextSpan().name("ai.request.publish").start();
    Tracer.SpanInScope scope = tracer.withSpan(span);
    try {
      rabbitTemplate.convertAndSend(
          RabbitMqConfig.AI_EXCHANGE,
          RabbitMqConfig.AI_ROUTING_KEY,
          payload,
          message -> {
            // Inject W3C traceparent (and tracestate if present) into AMQP headers.
            // The ai-service reads the lowercase "traceparent" key from these headers.
            propagator.inject(
                span.context(),
                message.getMessageProperties(),
                (msg, key, value) -> msg.getHeaders().put(key, value));
            return message;
          });
      log.debug(
          "Published AI request via RabbitMQ for conversation {} [traceId={}]",
          conversationId,
          span.context().traceId());
    } catch (RuntimeException e) {
      span.error(e);
      throw e;
    } finally {
      scope.close();
      span.end();
    }
  }

  /**
   * The request could not be handed to ai-service (RabbitMQ unreachable, history lookup failed):
   * log it and tell the asker right away with {@code AI_STREAM_ERROR / AI_UNAVAILABLE} on the usual
   * {@code ai:response:{conversationId}} stream, which every instance relays to its sockets.
   * Swallowing it left the asker on a bubble that never answered and nothing in the logs. Never
   * throws.
   */
  public void reportUnavailable(String conversationId, String requesterId, Exception cause) {
    log.warn(
        "Could not hand the AI request for conversation {} to ai-service: {}",
        conversationId,
        cause.toString());
    try {
      Map<String, Object> event = new LinkedHashMap<>();
      event.put("type", "AI_STREAM_ERROR");
      event.put("code", "AI_UNAVAILABLE");
      event.put("error", "AI is temporarily unavailable.");
      event.put("conversationId", conversationId);
      event.put("requesterId", requesterId);
      event.put("replyId", UUID.randomUUID().toString());
      redisTemplate.convertAndSend(
          AI_RESPONSE_CHANNEL_PREFIX + conversationId, objectMapper.writeValueAsString(event));
    } catch (Exception e) {
      log.warn(
          "Could not report the AI outage for conversation {}: {}", conversationId, e.toString());
    }
  }
}
