package com.platform.chatservice.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

class WsSessionRevalidationSweepTest {

  @Test
  void closesOnlySocketsWhoseAuthSessionIsNoLongerValid() throws Exception {
    WsSessionRegistry registry = new WsSessionRegistry();
    SessionValidator validator = mock(SessionValidator.class);
    WebSocketSession live = open(registry, "ws-1", "u1", "s-live");
    WebSocketSession loggedOut = open(registry, "ws-2", "u1", "s-out");
    WebSocketSession storeDown = open(registry, "ws-3", "u2", "s-x");
    when(validator.validate("s-live", "u1")).thenReturn(SessionStatus.VALID);
    when(validator.validate("s-out", "u1")).thenReturn(SessionStatus.SESSION_REVOKED);
    when(validator.validate("s-x", "u2")).thenReturn(SessionStatus.UNAVAILABLE);

    new WsSessionRevalidationSweep(registry, validator).sweep();

    verify(live, never()).close(any());
    verify(storeDown, never()).close(any());
    verify(loggedOut)
        .close(new CloseStatus(WsSessionRegistry.CLOSE_CODE_SESSION_INVALID, "SESSION_REVOKED"));
  }

  private WebSocketSession open(WsSessionRegistry r, String id, String userId, String sid) {
    WebSocketSession s = mock(WebSocketSession.class);
    when(s.getId()).thenReturn(id);
    when(s.isOpen()).thenReturn(true);
    r.register(s);
    r.bind(id, userId, sid);
    return s;
  }
}
