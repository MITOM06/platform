package com.platform.chatservice.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompEncoder;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

/**
 * Tracks this instance's open WebSocket sessions and which user / auth session ({@code sid}) each
 * one authenticated as at STOMP CONNECT, so a revoked user's sockets can be found and force-closed.
 *
 * <p>Sockets are registered by the transport decorator in {@code WebSocketConfig} and bound to a
 * user by {@link AuthChannelInterceptor} on a successful CONNECT (the WebSocket session id equals
 * the STOMP {@code simpSessionId}). Closing a socket makes Spring publish a {@code
 * SessionDisconnectEvent}, which {@link PresenceEventListener} turns into "offline".
 */
@Component
@Slf4j
public class WsSessionRegistry {

  /** Custom close code (4000-4999 range is application-defined): "auth session no longer valid". */
  public static final int CLOSE_CODE_SESSION_INVALID = 4401;

  // Same limits as WebSocketConfig#configureWebSocketTransport.
  private static final int SEND_TIME_LIMIT_MS = 20_000;
  private static final int SEND_BUFFER_SIZE_LIMIT = 512 * 1024;

  private final StompEncoder stompEncoder = new StompEncoder();

  /** Who a socket authenticated as. */
  public record Binding(String userId, String sid) {}

  private final Map<String, WebSocketSession> sockets = new ConcurrentHashMap<>();
  private final Map<String, Binding> bindings = new ConcurrentHashMap<>();
  private final Map<String, Set<String>> socketsByUser = new ConcurrentHashMap<>();

  /**
   * Track a newly opened socket. Returns a {@link ConcurrentWebSocketSessionDecorator} around it
   * that the caller must hand to Spring's STOMP handler, so every write to the socket — Spring's
   * and the ERROR frame sent by {@link #closeSession} — is serialized through one lock.
   */
  public WebSocketSession register(WebSocketSession session) {
    WebSocketSession safe =
        session instanceof ConcurrentWebSocketSessionDecorator
            ? session
            : new ConcurrentWebSocketSessionDecorator(
                session, SEND_TIME_LIMIT_MS, SEND_BUFFER_SIZE_LIMIT);
    sockets.put(session.getId(), safe);
    return safe;
  }

  /** Remove every trace of a closed socket. */
  public void unregister(String wsSessionId) {
    sockets.remove(wsSessionId);
    Binding b = bindings.remove(wsSessionId);
    if (b != null) {
      socketsByUser.computeIfPresent(
          b.userId(),
          (k, ids) -> {
            ids.remove(wsSessionId);
            return ids.isEmpty() ? null : ids;
          });
    }
  }

  /** Record the identity a socket authenticated with on STOMP CONNECT. */
  public void bind(String wsSessionId, String userId, String sid) {
    if (wsSessionId == null || userId == null) return;
    bindings.put(wsSessionId, new Binding(userId, sid));
    socketsByUser.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(wsSessionId);
  }

  public Binding bindingOf(String wsSessionId) {
    return wsSessionId == null ? null : bindings.get(wsSessionId);
  }

  /** Snapshot of all bound sockets (for the periodic re-validation sweep). */
  public Map<String, Binding> bindingsSnapshot() {
    return Map.copyOf(bindings);
  }

  /** Close every open socket of {@code userId} on this instance; returns how many were closed. */
  public int closeUserSessions(String userId, String reasonCode) {
    Set<String> ids = socketsByUser.get(userId);
    if (ids == null || ids.isEmpty()) return 0;
    int closed = 0;
    for (String id : List.copyOf(ids)) {
      if (closeSession(id, reasonCode)) closed++;
    }
    return closed;
  }

  /**
   * Send a STOMP {@code ERROR} frame carrying {@code reasonCode} (header {@code message} and JSON
   * body {@code {"code": ...}}), then close the socket with {@link #CLOSE_CODE_SESSION_INVALID} and
   * the same code as close reason. Clients treat the ERROR frame as the signal to refresh the token
   * (which fails for a revoked session → logout). Even if the frame is lost, the client's reconnect
   * is rejected at CONNECT with an ERROR frame carrying the same code.
   */
  public boolean closeSession(String wsSessionId, String reasonCode) {
    WebSocketSession session = sockets.get(wsSessionId);
    if (session == null) {
      unregister(wsSessionId);
      return false;
    }
    try {
      if (session.isOpen()) {
        sendErrorFrame(session, reasonCode);
        session.close(new CloseStatus(CLOSE_CODE_SESSION_INVALID, reasonCode));
      }
      return true;
    } catch (IOException | RuntimeException e) {
      log.warn("Failed to close WebSocket session {}: {}", wsSessionId, e.toString());
      return false;
    } finally {
      // afterConnectionClosed normally unregisters; do it here too in case it never fires.
      unregister(wsSessionId);
    }
  }

  private void sendErrorFrame(WebSocketSession session, String reasonCode) {
    try {
      StompHeaderAccessor error = StompHeaderAccessor.create(StompCommand.ERROR);
      error.setMessage(reasonCode);
      error.setContentType(MimeTypeUtils.APPLICATION_JSON);
      byte[] body = ("{\"code\":\"" + reasonCode + "\"}").getBytes(StandardCharsets.UTF_8);
      session.sendMessage(new TextMessage(stompEncoder.encode(error.getMessageHeaders(), body)));
    } catch (IOException | RuntimeException e) {
      log.debug(
          "Could not send STOMP ERROR to {} before closing: {}", session.getId(), e.toString());
    }
  }
}
