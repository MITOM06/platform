package com.platform.chatservice.security;

import com.platform.chatservice.service.ConversationQueryService;
import java.security.Principal;
import java.time.Duration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AuthChannelInterceptor implements ChannelInterceptor {

  private static final String STATUS_KEY_PREFIX = "user:status:";
  private static final Duration ONLINE_TTL = Duration.ofMinutes(5);
  private static final String CONV_TOPIC_PREFIX = "/topic/conversation/";

  private final JwtUtil jwtUtil;
  private final StringRedisTemplate redisTemplate;
  private final ConversationQueryService conversationQueryService;
  private final SessionValidator sessionValidator;
  private final WsSessionRegistry wsSessionRegistry;

  @Override
  public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
    StompHeaderAccessor accessor =
        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
    if (accessor == null || accessor.getCommand() == null) {
      return message;
    }

    if (StompCommand.CONNECT.equals(accessor.getCommand())) {
      List<String> authHeaders = accessor.getNativeHeader("Authorization");
      if (authHeaders == null || authHeaders.isEmpty()) {
        throw new MessageDeliveryException("Missing Authorization header");
      }

      String header = authHeaders.get(0);
      if (!header.startsWith("Bearer ")) {
        throw new MessageDeliveryException("Invalid Authorization header format");
      }

      String token = header.substring(7);
      if (!jwtUtil.isValid(token)) {
        throw new MessageDeliveryException("Invalid or expired JWT token");
      }

      String userId = jwtUtil.extractUserId(token);
      String sid = jwtUtil.extractSid(token);
      SessionStatus status = sessionValidator.validate(sid, userId);
      if (!status.isValid()) {
        // The STOMP ERROR frame's "message" header carries the code (e.g. SESSION_REVOKED).
        throw new MessageDeliveryException(status.code());
      }
      wsSessionRegistry.bind(accessor.getSessionId(), userId, sid);
      accessor.setUser(
          new UserPrincipal(
              userId,
              jwtUtil.extractRole(token),
              jwtUtil.extractPerms(token),
              jwtUtil.extractDepts(token)));
      // Presence key is set by PresenceEventListener.onConnect (fires after the
      // Principal is registered). No need to refresh here — the key doesn't exist yet.
      return message;
    }

    if (StompCommand.SEND.equals(accessor.getCommand())
        || StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
      if (!sessionStillValid(accessor)) {
        return null; // frame dropped; the socket has been closed with the reason code
      }
    }

    if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
      String destination = accessor.getDestination();
      if (destination != null && destination.startsWith(CONV_TOPIC_PREFIX)) {
        String rest = destination.substring(CONV_TOPIC_PREFIX.length());
        int slashIdx = rest.indexOf('/');
        String conversationId = slashIdx == -1 ? rest : rest.substring(0, slashIdx);
        if (!conversationId.isBlank()) {
          Principal user = accessor.getUser();
          if (user == null) {
            throw new MessageDeliveryException("Unauthorized subscription");
          }
          List<String> participants = conversationQueryService.getParticipants(conversationId);
          if (!participants.contains(user.getName())) {
            throw new MessageDeliveryException("Unauthorized subscription");
          }
        }
      }
    }

    // For all subsequent messages, refresh the online TTL to act as a heartbeat
    Principal user = accessor.getUser();
    if (user != null) {
      refreshPresence(user.getName());
    }

    return message;
  }

  /**
   * Re-validate the auth session the socket connected with (≤5s cached). An invalid session closes
   * the socket (close code 4401, reason = code) and drops the frame; a session-store outage only
   * rejects the frame, it never disconnects the user.
   */
  private boolean sessionStillValid(StompHeaderAccessor accessor) {
    if (accessor.getUser() == null) {
      return true; // unauthenticated frames are handled (rejected) downstream as before
    }
    String wsSessionId = accessor.getSessionId();
    WsSessionRegistry.Binding binding = wsSessionRegistry.bindingOf(wsSessionId);
    SessionStatus status =
        binding == null
            ? SessionStatus.TOKEN_INVALID
            : sessionValidator.validate(binding.sid(), binding.userId());
    if (status.isValid()) {
      return true;
    }
    if (status == SessionStatus.UNAVAILABLE) {
      throw new MessageDeliveryException(status.code());
    }
    wsSessionRegistry.closeSession(wsSessionId, status.code());
    return false;
  }

  @SuppressWarnings("null")
  private void refreshPresence(String userId) {
    // Use set() rather than expire() so a heartbeat from a still-alive socket whose
    // key has already lapsed recreates the presence entry instead of being a no-op.
    redisTemplate.opsForValue().set(STATUS_KEY_PREFIX + userId, "online", ONLINE_TTL);
  }
}
