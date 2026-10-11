package com.platform.chatservice.service;

import com.platform.chatservice.dto.CallEventDto;
import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.model.Conversation;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/** Pure helpers over {@link CallSession}s, shared by the call services. */
final class CallSessions {

  /**
   * A ring still unanswered this long after it started outlived the reaper — its timer was lost
   * (instance restart) and its caller's app died. It is ended instead of being treated as live.
   */
  static final Duration GHOST_RING_AGE = CallService.RING_REAPER_DELAY.plusSeconds(30);

  private CallSessions() {}

  static boolean isSfu(CallSession session) {
    return "sfu".equals(session.getTransport());
  }

  /** A 1-on-1 chat. Conversations saved before {@code type} existed fall back to their size. */
  static boolean isDirect(Conversation conv) {
    return "direct".equals(conv.getType())
        || (conv.getType() == null
            && conv.getParticipants() != null
            && conv.getParticipants().size() == 2);
  }

  /** Someone other than the caller answered or reached the room. */
  static boolean answeredByOthers(CallSession s) {
    return s.getParticipants().stream()
        .anyMatch(
            p ->
                !p.getUserId().equals(s.getStartedBy())
                    && (p.getJoinedAt() != null || p.getAcceptedAt() != null));
  }

  /** An sfu ring nobody answered that is older than {@link #GHOST_RING_AGE}. */
  static boolean isGhostRing(CallSession s) {
    return s != null
        && isSfu(s)
        && s.getStartedAt() != null
        && s.getStartedAt().isBefore(Instant.now().minus(GHOST_RING_AGE))
        && !answeredByOthers(s);
  }

  static CallSession.Participant findParticipant(CallSession session, String userId) {
    if (session.getParticipants() == null) {
      return null;
    }
    return session.getParticipants().stream()
        .filter(p -> userId.equals(p.getUserId()))
        .findFirst()
        .orElse(null);
  }

  static CallSession.Participant participant(String userId, Instant joinedAt) {
    return CallSession.Participant.builder()
        .userId(userId)
        .displayName(userId)
        .joinedAt(joinedAt)
        .build();
  }

  static List<CallEventDto.ParticipantDto> toParticipantDtos(CallSession session) {
    if (session.getParticipants() == null) {
      return List.of();
    }
    return session.getParticipants().stream()
        .map(
            p ->
                CallEventDto.ParticipantDto.builder()
                    .userId(p.getUserId())
                    .displayName(p.getDisplayName())
                    .joinedAt(p.getJoinedAt())
                    .leftAt(p.getLeftAt())
                    .build())
        .toList();
  }
}
