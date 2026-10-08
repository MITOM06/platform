package com.platform.chatservice.service;

import com.platform.chatservice.dto.WebRTCSignalDto;
import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.repository.CallSessionRepository;
import java.time.Instant;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Two people tapping Call on each other at the same time (glare) on the LiveKit path. Instead of
 * both getting "busy", the later {@code call.start} answers the call already ringing it: the caller
 * is accepted into that session and told to join it with a {@code call-merged} signal.
 *
 * <p>Two checks cover the timing: the callee's busy key (their call is already saved and marked),
 * and — for starts processed at the very same instant — an atomic per-conversation claim, where the
 * loser drops its own unsurfaced session and joins the winner's.
 */
@Component
@RequiredArgsConstructor
public class DirectCallGlare {

  private static final String WEBRTC_QUEUE = "/queue/webrtc";

  private final CallSessionRepository sessions;
  private final CallBusyRegistry busy;
  private final StringRedisTemplate redis;
  private final MongoTemplate mongo;
  private final ClusterMessageBroker broker;

  /**
   * {@code userId} starts a 1-on-1 in {@code conversationId} while the callee is in {@code
   * calleeCallId}. When that is the callee's own unanswered call to {@code userId}, answer it
   * instead. True when merged — the start is then done.
   */
  public boolean joinIfTheyAreCalling(String userId, String calleeCallId, String conversationId) {
    return ringingFor(calleeCallId, userId, conversationId)
        .map(theirs -> merge(userId, theirs))
        .orElse(false);
  }

  /**
   * Claim {@code conversationId} for the just-saved {@code own} session. False when a simultaneous
   * start from the other person claimed it first and {@code userId} was merged into that call —
   * {@code own} is deleted and must not be surfaced (an app without {@code canMerge} hears busy
   * instead). A claim left by an ended call is taken over.
   */
  public boolean claimOrMerge(String userId, CallSession own, boolean canMerge) {
    String key = CallService.ACTIVE_KEY_PREFIX + own.getConversationId();
    if (Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(key, own.getCallId()))) {
      return true;
    }
    Optional<CallSession> theirs =
        ringingFor(redis.opsForValue().get(key), userId, own.getConversationId());
    if (theirs.isPresent()) {
      busy.clear(userId, own.getCallId());
      if (!canMerge) {
        // An app that cannot join a merged call: drop ours and say busy, as before.
        sessions.delete(own);
        send(
            userId,
            WebRTCSignalDto.builder()
                .type("call-declined")
                .conversationId(own.getConversationId())
                .reason("busy")
                .senderId(theirs.get().getStartedBy())
                .build());
        return false;
      }
      if (merge(userId, theirs.get())) {
        sessions.delete(own);
        return false;
      }
      busy.markBusy(userId, own.getCallId()); // theirs ended meanwhile: go on with ours
    }
    redis.opsForValue().set(key, own.getCallId());
    return true;
  }

  /** The other person's live, unanswered LiveKit 1-on-1 to {@code userId} in the conversation. */
  private Optional<CallSession> ringingFor(String callId, String userId, String conversationId) {
    if (callId == null) {
      return Optional.empty();
    }
    return sessions
        .findByCallId(callId)
        .filter(s -> s.getEndedAt() == null)
        .filter(CallService::isSfu)
        .filter(s -> "direct".equals(s.getKind()))
        .filter(s -> conversationId.equals(s.getConversationId()))
        .filter(s -> !userId.equals(s.getStartedBy()))
        .filter(s -> !CallService.answeredByOthers(s));
  }

  /** Accept {@code userId} into {@code theirs} (as {@code call.accept} would) and say so. */
  private boolean merge(String userId, CallSession theirs) {
    CallSession.Participant p =
        theirs.getParticipants().stream()
            .filter(x -> userId.equals(x.getUserId()))
            .findFirst()
            .orElse(null);
    if (p == null) {
      p = CallSession.Participant.builder().userId(userId).build();
      theirs.getParticipants().add(p);
    }
    p.setAcceptedAt(Instant.now());
    boolean live =
        mongo.findAndReplace(
                new Query(Criteria.where("callId").is(theirs.getCallId()).and("endedAt").is(null)),
                theirs)
            != null;
    if (!live) {
      return false;
    }
    busy.markBusy(userId, theirs.getCallId());
    // The user's other devices were ringing for this call.
    send(
        userId,
        WebRTCSignalDto.builder()
            .type("call-ring-cancel")
            .callId(theirs.getCallId())
            .reason("answered_elsewhere")
            .build());
    send(
        userId,
        WebRTCSignalDto.builder()
            .type("call-merged")
            .callId(theirs.getCallId())
            .conversationId(theirs.getConversationId())
            .senderId(theirs.getStartedBy())
            .media(theirs.getMedia())
            .transport(theirs.getTransport())
            .kind(theirs.getKind())
            .build());
    return true;
  }

  private void send(String userId, WebRTCSignalDto dto) {
    broker.convertAndSendToUser(userId, WEBRTC_QUEUE, dto);
  }
}
