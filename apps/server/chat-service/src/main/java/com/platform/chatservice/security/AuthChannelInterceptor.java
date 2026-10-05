package com.platform.chatservice.security;

import com.platform.chatservice.service.ConversationQueryService;
import com.platform.chatservice.service.PresenceService;
import java.security.Principal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * Inbound STOMP gatekeeper (clientInboundChannel): authenticates CONNECT, re-validates the auth
 * session on SEND/SUBSCRIBE, enforces {@link StompDestinationPolicy} (SUBSCRIBE allow-list +
 * conversation membership, SEND only to {@code /app/**}) and refreshes presence on every inbound
 * frame — heartbeats included.
 *
 * <p>A refused frame throws {@link MessageDeliveryException}: Spring answers with a STOMP ERROR
 * frame whose {@code message} header is the reason code ({@link #FORBIDDEN_DESTINATION} / {@link
 * #UNAUTHORIZED_SUBSCRIPTION}) and closes the socket, so the frame never reaches the broker.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuthChannelInterceptor implements ChannelInterceptor {

  /** ERROR reason: destination not on the allow-list (or SEND outside {@code /app/**}). */
  public static final String FORBIDDEN_DESTINATION = "FORBIDDEN_DESTINATION";

  /** ERROR reason: conversation topic of a conversation the user is not a participant of. */
  public static final String UNAUTHORIZED_SUBSCRIPTION = "Unauthorized subscription";

  private final JwtUtil jwtUtil;
  private final ConversationQueryService conversationQueryService;
  private final SessionValidator sessionValidator;
  private final WsSessionRegistry wsSessionRegistry;
  private final PresenceService presenceService;

  @Override
  public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
    StompHeaderAccessor accessor =
        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
    if (accessor == null) {
      return message;
    }
    StompCommand command = accessor.getCommand();
    if (command == null) {
      // Heartbeat (or another command-less frame): the socket is alive — keep presence fresh.
      // Returning early here used to let idle users fall offline after the 5-minute TTL.
      touchPresence(accessor);
      return message;
    }

    if (StompCommand.CONNECT.equals(command) || StompCommand.STOMP.equals(command)) {
      authenticate(accessor);
      // Presence is set by PresenceEventListener.onConnect once the Principal is registered.
      return message;
    }

    if (StompCommand.SEND.equals(command) || StompCommand.SUBSCRIBE.equals(command)) {
      if (!sessionStillValid(accessor)) {
        return null; // frame dropped; the socket has been closed with the reason code
      }
    }

    if (StompCommand.SUBSCRIBE.equals(command)) {
      authorizeSubscription(accessor);
    } else if (StompCommand.SEND.equals(command)) {
      authorizeSend(accessor);
    }

    if (!StompCommand.DISCONNECT.equals(command)) {
      touchPresence(accessor);
    }
    return message;
  }

  private void authenticate(StompHeaderAccessor accessor) {
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
  }

  /**
   * SUBSCRIBE is allow-listed ({@link StompDestinationPolicy#SUBSCRIBE_ALLOW_LIST}); wildcard /
   * template / traversal syntax is refused outright and conversation topics require membership
   * (read straight from Mongo so a just-added member can subscribe immediately).
   */
  private void authorizeSubscription(StompHeaderAccessor accessor) {
    Principal user = accessor.getUser();
    String destination = accessor.getDestination();
    if (user == null) {
      throw new MessageDeliveryException(UNAUTHORIZED_SUBSCRIPTION);
    }
    StompDestinationPolicy.SubscribeDecision decision =
        StompDestinationPolicy.evaluateSubscribe(destination);
    if (!decision.allowed()) {
      log.warn("Refused SUBSCRIBE to '{}' by {}", destination, user.getName());
      throw new MessageDeliveryException(FORBIDDEN_DESTINATION);
    }
    if (decision.conversationId() != null) {
      List<String> participants =
          conversationQueryService.getParticipants(decision.conversationId());
      if (participants == null || !participants.contains(user.getName())) {
        throw new MessageDeliveryException(UNAUTHORIZED_SUBSCRIPTION);
      }
    }
  }

  /**
   * SEND only reaches {@code @MessageMapping} handlers: a SEND straight to {@code /topic/**},
   * {@code /queue/**} or {@code /user/**} would be relayed to subscribers as-is (forged frames).
   */
  private void authorizeSend(StompHeaderAccessor accessor) {
    String destination = accessor.getDestination();
    Principal user = accessor.getUser();
    if (user == null) {
      throw new MessageDeliveryException("Unauthenticated SEND");
    }
    if (!StompDestinationPolicy.isAllowedSend(destination)) {
      log.warn("Refused SEND to '{}' by {}", destination, user.getName());
      throw new MessageDeliveryException(FORBIDDEN_DESTINATION);
    }
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

  private void touchPresence(StompHeaderAccessor accessor) {
    Principal user = accessor.getUser();
    if (user != null) {
      presenceService.touch(user.getName(), accessor.getSessionId());
    }
  }
}
