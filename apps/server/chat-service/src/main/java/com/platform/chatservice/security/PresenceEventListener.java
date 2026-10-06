package com.platform.chatservice.security;

import com.platform.chatservice.service.ClusterMessageBroker;
import com.platform.chatservice.service.PresenceService;
import java.security.Principal;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * Feeds STOMP session lifecycle events into {@link PresenceService}, which tracks every open socket
 * per user so a user only goes offline when their LAST socket closes (not when any one tab or
 * device disconnects).
 */
@Component
@RequiredArgsConstructor
public class PresenceEventListener {

  private static final String PRESENCE_TOPIC = "/topic/presence";

  private final PresenceService presenceService;
  private final ClusterMessageBroker clusterBroker;

  @EventListener
  public void onConnect(SessionConnectedEvent event) {
    // SessionConnectedEvent fires after AuthChannelInterceptor has set the Principal
    StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
    Principal user = accessor.getUser();
    if (user == null) return;
    presenceService.connected(user.getName(), accessor.getSessionId());
    broadcastPresence(user.getName(), true);
  }

  @EventListener
  public void onDisconnect(SessionDisconnectEvent event) {
    Principal user = event.getUser();
    if (user == null) {
      user = StompHeaderAccessor.wrap(event.getMessage()).getUser();
    }
    if (user == null) return;
    if (presenceService.disconnected(user.getName(), event.getSessionId())) {
      broadcastPresence(user.getName(), false);
    }
  }

  /** Notify subscribers (e.g. the "active friends" row) that a user came online/offline. */
  private void broadcastPresence(String userId, boolean online) {
    clusterBroker.convertAndSend(PRESENCE_TOPIC, Map.of("userId", userId, "online", online));
  }
}
