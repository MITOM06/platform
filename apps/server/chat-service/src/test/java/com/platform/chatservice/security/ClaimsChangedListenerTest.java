package com.platform.chatservice.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.data.redis.connection.DefaultMessage;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class ClaimsChangedListenerTest {

  private SessionValidator validator;
  private SimpMessagingTemplate messagingTemplate;
  private ClaimsChangedListener listener;

  @BeforeEach
  void setUp() {
    validator = mock(SessionValidator.class);
    messagingTemplate = mock(SimpMessagingTemplate.class);
    listener = new ClaimsChangedListener(new ObjectMapper(), validator, messagingTemplate);
  }

  private void publish(String json) {
    listener.onMessage(
        new DefaultMessage(
            ClaimsChangedListener.CHANNEL.getBytes(StandardCharsets.UTF_8),
            json.getBytes(StandardCharsets.UTF_8)),
        null);
  }

  @Test
  void evictsCachedSessionsThenTellsTheUsersSockets() {
    publish("{\"userId\":\"alice\"}");

    InOrder order = inOrder(validator, messagingTemplate);
    // Evict first: a client reacting instantly must already hit Redis for the new claimsAt.
    order.verify(validator).evictUser("alice");
    order
        .verify(messagingTemplate)
        .convertAndSendToUser("alice", "/queue/notifications", Map.of("type", "CLAIMS_CHANGED"));
  }

  @Test
  void deliversLocallyOnly_neverRepublishesOnTheClusterChannel() {
    // Every instance receives auth:claims-changed itself; a cluster re-publish would hand each
    // socket one copy per instance. Local delivery is the only side effect.
    publish("{\"userId\":\"alice\"}");

    verify(messagingTemplate, times(1)).convertAndSendToUser(anyString(), anyString(), any());
    verifyNoMoreInteractions(messagingTemplate);
  }

  @Test
  void eventWithoutUserIdIsIgnored() {
    publish("{\"reason\":\"role_changed\"}");
    publish("{\"userId\":\"\"}");

    verifyNoInteractions(validator, messagingTemplate);
  }

  @Test
  void malformedPayloadIsIgnored() {
    publish("not json");

    verifyNoInteractions(validator, messagingTemplate);
  }

  @Test
  void deliveryFailureDoesNotPropagate() {
    doThrow(new IllegalStateException("broker down"))
        .when(messagingTemplate)
        .convertAndSendToUser(anyString(), anyString(), any());

    publish("{\"userId\":\"alice\"}");

    verify(validator).evictUser("alice");
  }
}
