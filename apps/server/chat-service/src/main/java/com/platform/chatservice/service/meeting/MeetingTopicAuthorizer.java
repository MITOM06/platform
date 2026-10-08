package com.platform.chatservice.service.meeting;

import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.repository.MeetingRepository;
import com.platform.chatservice.security.UserPrincipal;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Who may SUBSCRIBE to {@code /topic/meeting/{id}}: exactly the people who get a LiveKit token
 * straight away (host, co-host, invited / department member / admitted). Someone waiting, removed,
 * locked out, or a meeting that ended is refused. "Already in the room" is deliberately not
 * required — clients subscribe before LiveKit's join webhook arrives.
 *
 * <p>Depends only on the repository and Redis (never on the broker) so {@code
 * AuthChannelInterceptor} can use it without a bean cycle with the WebSocket configuration.
 */
@Component
@RequiredArgsConstructor
public class MeetingTopicAuthorizer {

  private final MeetingRepository meetings;
  private final MeetingLobby lobby;

  public boolean canSubscribe(String meetingId, UserPrincipal user) {
    if (meetingId == null || user == null || user.getUserId() == null) {
      return false;
    }
    Optional<Meeting> found = meetings.findById(meetingId);
    if (found.isEmpty()) {
      return false;
    }
    String uid = user.getUserId();
    return MeetingAccess.decide(found.get(), uid, user.getDepts(), lobby.isAdmitted(meetingId, uid))
        .entersRoom();
  }
}
