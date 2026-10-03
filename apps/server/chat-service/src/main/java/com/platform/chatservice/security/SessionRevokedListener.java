package com.platform.chatservice.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

/**
 * Consumes auth-service's {@code auth:sessions-revoked} Redis Pub/Sub event (payload {@code
 * {"userId","reason"}}, published after {@code SessionService.revokeAllSessions}) and immediately
 * closes every WebSocket/STOMP session that user has open on this instance. Every chat-service
 * instance is subscribed, so each one closes its own sockets. Presence goes offline through the
 * resulting {@code SessionDisconnectEvent}. Registered in {@code RedisListenerConfig}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SessionRevokedListener implements MessageListener {

  public static final String CHANNEL = "auth:sessions-revoked";

  private final ObjectMapper objectMapper;
  private final SessionValidator sessionValidator;
  private final WsSessionRegistry wsSessionRegistry;

  @Override
  public void onMessage(Message message, byte[] pattern) {
    try {
      JsonNode body = objectMapper.readTree(message.getBody());
      String userId = body.path("userId").asText(null);
      if (userId == null || userId.isBlank()) {
        log.warn("{} event without userId — ignored", CHANNEL);
        return;
      }
      sessionValidator.evictUser(userId);
      int closed =
          wsSessionRegistry.closeUserSessions(userId, SessionStatus.SESSION_REVOKED.code());
      log.info(
          "Sessions revoked for user {} (reason={}): closed {} socket(s)",
          userId,
          body.path("reason").asText("other"),
          closed);
    } catch (Exception e) {
      log.error("Failed to process {} event", CHANNEL, e);
    }
  }
}
