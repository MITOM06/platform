package com.platform.chatservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Receives cross-instance STOMP broadcasts published by {@link ClusterMessageBroker} on the {@link
 * ClusterMessageBroker#CHANNEL} Redis channel and re-delivers each one to <em>this</em> instance's
 * local WebSocket clients via the in-memory broker.
 *
 * <p>Redis pub/sub fans every published envelope out to all subscribed instances, so each instance
 * runs this listener and delivers to whichever of the targeted sessions it locally owns. A topic
 * broadcast lands on every instance; a user-targeted message is resolved by the instance that holds
 * that user's session (others simply have no matching session and no-op).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ClusterBroadcastListener implements MessageListener {

  private final SimpMessagingTemplate messagingTemplate;
  private final ObjectMapper objectMapper;

  @Override
  @SuppressWarnings("null")
  public void onMessage(org.springframework.data.redis.connection.Message message, byte[] pattern) {
    try {
      JsonNode envelope = objectMapper.readTree(message.getBody());
      String destination = envelope.path("destination").asText(null);
      if (destination == null || destination.isBlank()) {
        log.warn("Cluster broadcast missing destination; dropping");
        return;
      }
      JsonNode payloadNode = envelope.get("payload");
      // Re-hydrate the payload as a generic tree; Jackson re-serializes it to the identical wire
      // JSON the STOMP converter would have produced from the original object.
      Object payload =
          payloadNode == null ? null : objectMapper.treeToValue(payloadNode, Object.class);

      JsonNode userNode = envelope.get("user");
      if (userNode != null && !userNode.isNull()) {
        messagingTemplate.convertAndSendToUser(userNode.asText(), destination, payload);
      } else {
        messagingTemplate.convertAndSend(destination, payload);
      }
    } catch (Exception e) {
      log.error("Failed to deliver cluster broadcast", e);
    }
  }
}
