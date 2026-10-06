package com.platform.chatservice.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.PresenceService;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@ExtendWith(MockitoExtension.class)
class PresenceEventListenerTest {

  @Mock private PresenceService presenceService;
  @Mock private ClusterMessageBroker clusterBroker;

  @InjectMocks private PresenceEventListener listener;

  private static Message<byte[]> stomp(StompCommand command) {
    StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
    accessor.setSessionId("ws-1");
    accessor.setUser(new UserPrincipal("user-1"));
    return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
  }

  @Test
  void connect_recordsSocket_andBroadcastsOnline() {
    listener.onConnect(new SessionConnectedEvent(this, stomp(StompCommand.CONNECTED)));

    verify(presenceService).connected("user-1", "ws-1");
    verify(clusterBroker)
        .convertAndSend("/topic/presence", Map.of("userId", "user-1", "online", true));
  }

  @Test
  void disconnect_ofLastSocket_broadcastsOffline() {
    when(presenceService.disconnected("user-1", "ws-1")).thenReturn(true);

    listener.onDisconnect(
        new SessionDisconnectEvent(
            this,
            stomp(StompCommand.DISCONNECT),
            "ws-1",
            CloseStatus.NORMAL,
            new UserPrincipal("user-1")));

    verify(clusterBroker)
        .convertAndSend("/topic/presence", Map.of("userId", "user-1", "online", false));
  }

  /** Closing one tab while another stays open must not flip the user offline. */
  @Test
  void disconnect_withOtherSocketsLeft_staysSilent() {
    when(presenceService.disconnected("user-1", "ws-1")).thenReturn(false);

    listener.onDisconnect(
        new SessionDisconnectEvent(
            this,
            stomp(StompCommand.DISCONNECT),
            "ws-1",
            CloseStatus.NORMAL,
            new UserPrincipal("user-1")));

    verify(clusterBroker, never()).convertAndSend(anyString(), any());
    verify(presenceService).disconnected(eq("user-1"), eq("ws-1"));
  }
}
