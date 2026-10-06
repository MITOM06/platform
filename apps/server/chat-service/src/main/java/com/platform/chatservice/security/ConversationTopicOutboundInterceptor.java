package com.platform.chatservice.security;

import com.platform.chatservice.service.ConversationMembershipCache;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHeaders;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

/**
 * Outbound membership filter (clientOutboundChannel). Membership is only checked once, at SUBSCRIBE
 * time, so a member removed from a group kept receiving that group's live messages over the
 * subscription they already held. Every {@code MESSAGE} frame for {@code
 * /topic/conversation/{id}[/typing]} is therefore re-checked against the CURRENT participants
 * ({@link ConversationMembershipCache}, short TTL, invalidated on membership change) and dropped
 * for a session whose user is no longer a member. The subscription itself is kept, so a member who
 * is re-added starts receiving again without resubscribing.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ConversationTopicOutboundInterceptor implements ChannelInterceptor {

  private final WsSessionRegistry wsSessionRegistry;
  private final ConversationMembershipCache membershipCache;

  @Override
  public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
    MessageHeaders headers = message.getHeaders();
    if (SimpMessageHeaderAccessor.getMessageType(headers) != SimpMessageType.MESSAGE) {
      return message;
    }
    String conversationId =
        StompDestinationPolicy.conversationIdOfTopic(
            SimpMessageHeaderAccessor.getDestination(headers));
    if (conversationId == null) {
      return message;
    }
    String sessionId = SimpMessageHeaderAccessor.getSessionId(headers);
    WsSessionRegistry.Binding binding = wsSessionRegistry.bindingOf(sessionId);
    if (binding == null || !membershipCache.isMember(conversationId, binding.userId())) {
      log.debug(
          "Dropped frame for conversation {} to non-member session {}", conversationId, sessionId);
      return null;
    }
    return message;
  }
}
