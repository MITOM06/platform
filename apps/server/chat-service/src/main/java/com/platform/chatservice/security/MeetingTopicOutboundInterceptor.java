package com.platform.chatservice.security;

import com.platform.chatservice.service.meeting.MeetingLobby;
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
 * Outbound filter for {@code /topic/meeting/{id}} (clientOutboundChannel). Room access is checked
 * at SUBSCRIBE time only, so someone the host removed mid-meeting would keep receiving the room's
 * chat, hands and roster over the subscription they already hold. Every {@code MESSAGE} frame of a
 * meeting topic is therefore dropped for a session whose user is in the meeting's Redis removed set
 * ({@link MeetingLobby#isRemoved}, one {@code SISMEMBER} — no Mongo read). The subscription stays
 * open but silent.
 *
 * <p>Fail-open on a Redis error: one blip must not silence the whole room, and a removed person was
 * already kicked from LiveKit and told {@code meet.removed}. Depends on Redis only, so it adds no
 * bean cycle with {@code WebSocketConfig}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MeetingTopicOutboundInterceptor implements ChannelInterceptor {

  private final WsSessionRegistry wsSessionRegistry;
  private final MeetingLobby lobby;

  @Override
  public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
    MessageHeaders headers = message.getHeaders();
    if (SimpMessageHeaderAccessor.getMessageType(headers) != SimpMessageType.MESSAGE) {
      return message;
    }
    String meetingId =
        StompDestinationPolicy.meetingIdOfTopic(SimpMessageHeaderAccessor.getDestination(headers));
    if (meetingId == null) {
      return message;
    }
    String sessionId = SimpMessageHeaderAccessor.getSessionId(headers);
    WsSessionRegistry.Binding binding = wsSessionRegistry.bindingOf(sessionId);
    if (binding == null) {
      log.debug("Dropped frame for meeting {} to unknown session {}", meetingId, sessionId);
      return null;
    }
    try {
      if (lobby.isRemoved(meetingId, binding.userId())) {
        log.debug("Dropped frame for meeting {} to removed session {}", meetingId, sessionId);
        return null;
      }
    } catch (RuntimeException e) {
      log.warn("Meeting {} removed-set lookup failed; delivering", meetingId);
    }
    return message;
  }
}
