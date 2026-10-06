package com.platform.chatservice.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Consumes auth-service's {@code auth:claims-changed} Redis Pub/Sub event (payload {@code
 * {"userId"}}, published by {@code SessionService.markClaimsStale} after it stamped {@code
 * sess:{sid}.claimsAt} on every session of the user whose role, departments or permissions just
 * changed) and:
 *
 * <ol>
 *   <li>drops the user's cached session snapshots, so this instance sees the new {@code claimsAt}
 *       on the very next REST request / STOMP CONNECT instead of up to 5s later;
 *   <li>tells the user's open sockets {@code {"type":"CLAIMS_CHANGED"}} on {@code
 *       /user/queue/notifications} — clients refresh their token, refetch their capabilities and
 *       reconnect STOMP so menus and permissions update without a re-login.
 * </ol>
 *
 * <p>Delivery is LOCAL ({@link SimpMessagingTemplate}), the same pattern {@code AiResponseListener}
 * uses for stream chunks: Redis already fans this event out to every chat-service instance, and
 * each instance delivers to the sockets it owns (no local socket = no-op). Re-publishing it on the
 * {@code stomp:broadcast} cluster channel from every instance would hand each socket one copy per
 * instance — i.e. N token refreshes and N reconnects — and a claim/dedupe key cannot tell two real
 * back-to-back changes apart (the payload carries no event id). Registered in {@code
 * RedisListenerConfig}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ClaimsChangedListener implements MessageListener {

  public static final String CHANNEL = "auth:claims-changed";

  /** Event type pushed to the user's notification queue. */
  public static final String EVENT_TYPE = "CLAIMS_CHANGED";

  static final String USER_QUEUE = "/queue/notifications";

  private final ObjectMapper objectMapper;
  private final SessionValidator sessionValidator;
  private final SimpMessagingTemplate messagingTemplate;

  @Override
  public void onMessage(Message message, byte[] pattern) {
    String userId;
    try {
      JsonNode body = objectMapper.readTree(message.getBody());
      userId = body.path("userId").asText(null);
    } catch (Exception e) {
      log.error("Unreadable {} event — ignored", CHANNEL, e);
      return;
    }
    if (userId == null || userId.isBlank()) {
      log.warn("{} event without userId — ignored", CHANNEL);
      return;
    }
    sessionValidator.evictUser(userId);
    try {
      messagingTemplate.convertAndSendToUser(userId, USER_QUEUE, Map.of("type", EVENT_TYPE));
    } catch (Exception e) {
      log.error("Failed to deliver {} to user {}", EVENT_TYPE, userId, e);
    }
  }
}
