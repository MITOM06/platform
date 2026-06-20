package com.platform.chatservice.service;

import com.platform.chatservice.config.RabbitMqConfig;
import com.platform.chatservice.dto.AiRequestPayload;
import com.platform.chatservice.repository.ConversationRepository;
import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import io.micrometer.tracing.propagation.Propagator;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
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

  private final RabbitTemplate rabbitTemplate;
  private final Tracer tracer;
  private final Propagator propagator;
  private final ConversationRepository conversationRepository;

  public void publishAiRequest(
      String conversationId,
      String userId,
      String displayName,
      String content,
      List<Map<String, String>> history) {
    // Enrich the AI job with the conversation's department so ai-service can
    // department-scope RAG/tools for the group bot (P6). Null for personal chats.
    String departmentId =
        conversationRepository.findById(conversationId).map(c -> c.getDepartmentId()).orElse(null);
    AiRequestPayload payload =
        new AiRequestPayload(conversationId, userId, displayName, content, history, departmentId);

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
}
