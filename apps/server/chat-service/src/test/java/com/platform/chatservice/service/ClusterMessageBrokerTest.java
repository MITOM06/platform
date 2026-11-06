package com.platform.chatservice.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.data.redis.connection.DefaultMessage;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;

/**
 * Cross-instance STOMP fan-out: {@link ClusterMessageBroker} publishes an envelope on Redis and
 * {@link ClusterBroadcastListener} re-delivers it locally. Redis down ⇒ fail-open to local
 * delivery.
 */
class ClusterMessageBrokerTest {

  private final ObjectMapper json = new ObjectMapper();
  private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
  private final SimpMessagingTemplate local = mock(SimpMessagingTemplate.class);
  private final ClusterMessageBroker broker = new ClusterMessageBroker(redis, json, local);

  private final SimpMessagingTemplate remote = mock(SimpMessagingTemplate.class);
  private final ClusterBroadcastListener listener = new ClusterBroadcastListener(remote, json);

  private String published() {
    ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
    verify(redis).convertAndSend(eq(ClusterMessageBroker.CHANNEL), body.capture());
    return body.getValue();
  }

  private void deliver(String body) {
    listener.onMessage(
        new DefaultMessage(
            ClusterMessageBroker.CHANNEL.getBytes(StandardCharsets.UTF_8),
            body.getBytes(StandardCharsets.UTF_8)),
        null);
  }

  @Test
  void topicBroadcastRoundTripsThroughRedis() {
    broker.convertAndSend("/topic/conversation/c1", Map.of("type", "NEW_MESSAGE", "n", 1));

    verifyNoInteractions(local);
    deliver(published());
    verify(remote)
        .convertAndSend("/topic/conversation/c1", (Object) Map.of("type", "NEW_MESSAGE", "n", 1));
  }

  @Test
  void userDestinationKeepsTheTargetUser() {
    broker.convertAndSendToUser("bob", "/queue/notifications", Map.of("type", "X"));
    deliver(published());
    verify(remote)
        .convertAndSendToUser("bob", "/queue/notifications", (Object) Map.of("type", "X"));
    verify(remote, never()).convertAndSend(anyString(), any(Object.class));
  }

  @Test
  void orderedBatchIsDeliveredInOrder() {
    broker.convertAndSendAll("/topic/conversation/c1", List.of(Map.of("i", 1), Map.of("i", 2)));
    deliver(published());
    InOrder order = inOrder(remote);
    order.verify(remote).convertAndSend("/topic/conversation/c1", (Object) Map.of("i", 1));
    order.verify(remote).convertAndSend("/topic/conversation/c1", (Object) Map.of("i", 2));
  }

  @Test
  void emptyBatchPublishesNothing() {
    broker.convertAndSendAll("/topic/x", List.of());
    broker.convertAndSendAll("/topic/x", null);
    verifyNoInteractions(redis, local);
  }

  @Test
  void redisDownFallsBackToLocalDelivery() {
    doThrow(new RuntimeException("redis down"))
        .when(redis)
        .convertAndSend(anyString(), anyString());

    broker.convertAndSend("/topic/a", Map.of("k", "v"));
    broker.convertAndSendToUser("bob", "/queue/q", "hello");
    broker.convertAndSendAll("/topic/b", List.of("one", "two"));

    verify(local).convertAndSend("/topic/a", (Object) Map.of("k", "v"));
    verify(local).convertAndSendToUser("bob", "/queue/q", "hello");
    InOrder order = inOrder(local);
    order.verify(local).convertAndSend("/topic/b", (Object) "one");
    order.verify(local).convertAndSend("/topic/b", (Object) "two");
  }

  @Test
  void fallbackFailureIsSwallowed() {
    doThrow(new RuntimeException("redis down"))
        .when(redis)
        .convertAndSend(anyString(), anyString());
    doThrow(new RuntimeException("broker down"))
        .when(local)
        .convertAndSend(anyString(), any(Object.class));
    doThrow(new RuntimeException("broker down"))
        .when(local)
        .convertAndSendToUser(anyString(), anyString(), any(Object.class));

    broker.convertAndSend("/topic/a", "x");
    broker.convertAndSendToUser("u", "/queue/q", "x");
    broker.convertAndSendAll("/topic/b", List.of("x"));

    verify(local).convertAndSendToUser("u", "/queue/q", "x");
  }

  @Test
  void listenerDropsEnvelopesWithoutDestinationOrGarbage() {
    deliver("{\"payload\":{\"a\":1}}");
    deliver("{\"destination\":\"  \",\"payload\":{}}");
    deliver("not json");
    verifyNoInteractions(remote);
  }

  @Test
  void listenerTreatsNullUserAsBroadcast() {
    deliver("{\"destination\":\"/topic/t\",\"user\":null,\"payload\":\"hi\"}");
    verify(remote).convertAndSend("/topic/t", (Object) "hi");
  }
}
