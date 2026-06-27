package com.platform.chatservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Cluster-aware replacement for direct {@link SimpMessagingTemplate} broadcasts.
 *
 * <p>chat-service runs with {@code --max-instances>1} on Cloud Run, but the STOMP broker is the
 * in-memory {@code SimpleBroker} (see {@code WebSocketConfig}). A {@code convertAndSend} therefore
 * only reaches the WebSocket sessions owned by the instance that made the call — so when two
 * conversation participants are connected to different instances, realtime delivery (messages,
 * notifications, typing, read receipts, call signaling, …) is silently lost and the recipient only
 * sees the message on a manual reload (which reads it from Mongo over REST). This was the root
 * cause of the "no realtime / no notifications until reload" bug.
 *
 * <p>The fix mirrors the pattern already used for AI streaming ({@code AiResponseListener}):
 * instead of delivering to the local broker directly, publish the broadcast to a single Redis
 * pub/sub channel. Redis fans it out to <em>every</em> instance, and {@link
 * ClusterBroadcastListener} on each instance re-delivers it to that instance's local STOMP clients.
 * Because the publishing instance is also subscribed, it delivers to its own clients via the same
 * round-trip — so every client receives exactly one copy, wherever it is connected.
 *
 * <p>If Redis is unavailable the publish falls back to a direct local {@code convertAndSend} so
 * realtime degrades to single-instance behavior instead of failing completely.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ClusterMessageBroker {

  /** Single Redis pub/sub channel carrying every cross-instance STOMP broadcast. */
  public static final String CHANNEL = "stomp:broadcast";

  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;
  private final SimpMessagingTemplate messagingTemplate;

  /**
   * Broadcast a payload to a resolved broker destination (e.g. {@code /topic/conversation/{id}}) on
   * every instance. Drop-in replacement for {@link SimpMessagingTemplate#convertAndSend}.
   */
  public void convertAndSend(String destination, Object payload) {
    publish(destination, null, payload);
  }

  /**
   * Send a payload to a single user's destination (e.g. {@code /queue/notifications}). The user's
   * session may live on any instance; the bridge lets whichever instance owns it resolve and
   * deliver. Drop-in replacement for {@link SimpMessagingTemplate#convertAndSendToUser}.
   */
  public void convertAndSendToUser(String user, String destination, Object payload) {
    publish(destination, user, payload);
  }

  private void publish(String destination, String user, Object payload) {
    try {
      ObjectNode envelope = objectMapper.createObjectNode();
      envelope.put("destination", destination);
      if (user != null) {
        envelope.put("user", user);
      }
      // Serialize the payload to a JSON tree now so the listener can re-emit the exact same wire
      // shape the STOMP converter would have produced from the original object.
      envelope.set("payload", objectMapper.valueToTree(payload));
      redisTemplate.convertAndSend(CHANNEL, objectMapper.writeValueAsString(envelope));
    } catch (Exception e) {
      // Redis down / serialization failed: fall back to local-only delivery so this instance's
      // clients still get the event (degraded, but better than total realtime loss).
      log.error(
          "Cluster broadcast to {} (user={}) failed; falling back to local delivery",
          destination,
          user,
          e);
      try {
        if (user != null) {
          messagingTemplate.convertAndSendToUser(user, destination, payload);
        } else {
          messagingTemplate.convertAndSend(destination, payload);
        }
      } catch (Exception fallback) {
        log.error("Local fallback delivery to {} also failed", destination, fallback);
      }
    }
  }
}
