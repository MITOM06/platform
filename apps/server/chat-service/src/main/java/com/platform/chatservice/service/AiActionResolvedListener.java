package com.platform.chatservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

/**
 * Consumes ai-service's {@code ai:action:resolved} Redis Pub/Sub event — {@code {actionId,
 * conversationId, status: "confirmed" | "failed" | "cancelled", resultSummary?}}, published after
 * the requester confirmed or cancelled a sensitive AI action — and hands it to {@link
 * AiPendingActionService#resolve}, which flips the action's status on the AI message and broadcasts
 * {@code MESSAGE_UPDATED}. {@code resultSummary} is not stored: the outcome is reported by
 * ai-service's follow-up reply. Registered in {@code RedisListenerConfig}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AiActionResolvedListener implements MessageListener {

  public static final String CHANNEL = "ai:action:resolved";

  private final ObjectMapper objectMapper;
  private final AiPendingActionService pendingActionService;

  @Override
  public void onMessage(Message message, byte[] pattern) {
    try {
      JsonNode body = objectMapper.readTree(message.getBody());
      pendingActionService.resolve(
          body.path("actionId").asText(null),
          body.path("conversationId").asText(null),
          body.path("status").asText(null));
    } catch (Exception e) {
      log.error("Failed to process {} event", CHANNEL, e);
    }
  }
}
