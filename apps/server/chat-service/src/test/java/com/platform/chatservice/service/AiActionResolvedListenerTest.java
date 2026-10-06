package com.platform.chatservice.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.DefaultMessage;

class AiActionResolvedListenerTest {

  private AiPendingActionService service;
  private AiActionResolvedListener listener;

  @BeforeEach
  void setUp() {
    service = mock(AiPendingActionService.class);
    listener = new AiActionResolvedListener(new ObjectMapper(), service);
  }

  private void publish(String json) {
    listener.onMessage(
        new DefaultMessage(
            AiActionResolvedListener.CHANNEL.getBytes(StandardCharsets.UTF_8),
            json.getBytes(StandardCharsets.UTF_8)),
        null);
  }

  @Test
  void forwardsActionConversationAndStatus() {
    publish(
        "{\"actionId\":\"act-1\",\"conversationId\":\"conv-1\",\"status\":\"confirmed\","
            + "\"resultSummary\":\"Sent\"}");

    verify(service).resolve("act-1", "conv-1", "confirmed");
  }

  @Test
  void missingFieldsArePassedAsNull_theServiceDecides() {
    publish("{\"actionId\":\"act-1\"}");

    verify(service).resolve("act-1", null, null);
  }

  @Test
  void malformedPayloadIsIgnored() {
    publish("{not json");

    verify(service, never()).resolve(any(), any(), any());
  }
}
