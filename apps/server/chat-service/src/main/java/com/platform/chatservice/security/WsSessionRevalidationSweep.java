package com.platform.chatservice.security;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Safety net for the push-based revocation in {@link SessionRevokedListener}: periodically
 * re-checks the auth session of every open socket and closes the ones that are no longer valid.
 * Covers what the event cannot: a single-session logout (auth-service only publishes the event on
 * revoke-all), an idle socket that never sends a frame, and a Pub/Sub message missed during a Redis
 * reconnect. A store outage ({@link SessionStatus#UNAVAILABLE}) never closes a socket.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WsSessionRevalidationSweep {

  private final WsSessionRegistry wsSessionRegistry;
  private final SessionValidator sessionValidator;

  @Scheduled(fixedDelayString = "${app.session.ws-sweep-interval-ms:30000}")
  public void sweep() {
    int closed = 0;
    for (Map.Entry<String, WsSessionRegistry.Binding> e :
        wsSessionRegistry.bindingsSnapshot().entrySet()) {
      WsSessionRegistry.Binding b = e.getValue();
      SessionStatus status = sessionValidator.validate(b.sid(), b.userId());
      if (status.isValid() || status == SessionStatus.UNAVAILABLE) continue;
      if (wsSessionRegistry.closeSession(e.getKey(), status.code())) closed++;
    }
    if (closed > 0) {
      log.info("WebSocket session sweep closed {} socket(s) with invalid auth sessions", closed);
    }
  }
}
