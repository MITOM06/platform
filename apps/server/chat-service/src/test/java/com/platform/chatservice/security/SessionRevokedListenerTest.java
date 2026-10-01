package com.platform.chatservice.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.data.redis.connection.DefaultMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

class SessionRevokedListenerTest {

  private SessionValidator validator;
  private WsSessionRegistry registry;
  private SessionRevokedListener listener;

  @BeforeEach
  void setUp() {
    validator = mock(SessionValidator.class);
    registry = new WsSessionRegistry();
    listener = new SessionRevokedListener(new ObjectMapper(), validator, registry);
  }

  private WebSocketSession socket(String id, String userId, String sid) {
    WebSocketSession s = mock(WebSocketSession.class);
    when(s.getId()).thenReturn(id);
    when(s.isOpen()).thenReturn(true);
    registry.register(s);
    registry.bind(id, userId, sid);
    return s;
  }

  private void publish(String json) {
    listener.onMessage(
        new DefaultMessage(
            SessionRevokedListener.CHANNEL.getBytes(StandardCharsets.UTF_8),
            json.getBytes(StandardCharsets.UTF_8)),
        null);
  }

  @Test
  void eventClosesEveryOpenSocketOfThatUserOnly() throws Exception {
    WebSocketSession a1 = socket("ws-a1", "alice", "s1");
    WebSocketSession a2 = socket("ws-a2", "alice", "s2");
    WebSocketSession b1 = socket("ws-b1", "bob", "s3");

    publish("{\"userId\":\"alice\",\"reason\":\"blocked\"}");

    CloseStatus expected =
        new CloseStatus(WsSessionRegistry.CLOSE_CODE_SESSION_INVALID, "SESSION_REVOKED");
    for (WebSocketSession s : new WebSocketSession[] {a1, a2}) {
      InOrder order = inOrder(s);
      ArgumentCaptor<TextMessage> frame = ArgumentCaptor.forClass(TextMessage.class);
      order.verify(s).sendMessage(frame.capture());
      order.verify(s).close(expected);
      String stomp = frame.getValue().getPayload();
      assertThat(stomp).startsWith("ERROR\n");
      assertThat(stomp).contains("message:SESSION_REVOKED");
      assertThat(stomp).contains("{\"code\":\"SESSION_REVOKED\"}");
    }
    verify(b1, never()).close(any());
    verify(b1, never()).sendMessage(any());
    verify(validator).evictUser("alice");
    assertThat(registry.bindingOf("ws-a1")).isNull();
    assertThat(registry.bindingOf("ws-a2")).isNull();
    assertThat(registry.bindingOf("ws-b1")).isNotNull();
  }

  @Test
  void eventWithoutReasonStillWorks() throws Exception {
    WebSocketSession a1 = socket("ws-a1", "alice", "s1");
    publish("{\"userId\":\"alice\"}");
    verify(a1).close(any(CloseStatus.class));
  }

  @Test
  void malformedOrEmptyEventsAreIgnored() throws Exception {
    WebSocketSession a1 = socket("ws-a1", "alice", "s1");
    publish("not json");
    publish("{\"reason\":\"blocked\"}");
    verify(a1, never()).close(any());
    verifyNoInteractions(validator);
  }

  @Test
  void userWithNoSocketsIsANoOp() {
    publish("{\"userId\":\"nobody\",\"reason\":\"role_changed\"}");
    verify(validator).evictUser("nobody");
  }
}
