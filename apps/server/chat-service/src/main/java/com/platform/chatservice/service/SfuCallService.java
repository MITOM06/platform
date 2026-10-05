package com.platform.chatservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.LiveKitProperties;
import com.platform.chatservice.dto.WebRTCSignalDto;
import com.platform.chatservice.exception.ApiException;
import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.repository.UserBlockRepository;
import com.platform.chatservice.service.rtc.LiveKitTokenService;
import com.platform.chatservice.service.rtc.RtcGrant;
import com.platform.chatservice.service.rtc.RtcRooms;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Calls on the LiveKit (sfu) path: answering, declining and cancelling a ringing call. The session
 * lifecycle itself stays in {@link CallService}; mesh sessions are never touched here.
 *
 * <p>Contract: {@code docs/superpowers/plans/2026-10-05-calls-on-livekit.md}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SfuCallService {

  private static final Set<String> DECLINE_REASONS = Set.of("declined", "busy", "media_error");
  private static final Set<String> CANCEL_REASONS = Set.of("hangup", "no_answer");
  private static final ObjectMapper JSON = new ObjectMapper();

  /** What a client needs to join the call's LiveKit room. */
  public record CallToken(String url, String token) {}

  private final CallService calls;
  private final CallBusyRegistry busy;
  private final LiveKitProperties props;
  private final LiveKitTokenService tokens;
  private final UserBlockRepository blocks;
  private final MongoTemplate mongo;

  /** The callee answered: they are busy now, and their other devices stop ringing. */
  public void accept(String userId, String callId) {
    sfuSessionFor(userId, callId)
        .ifPresent(
            s -> {
              busy.markBusy(userId, callId);
              calls.sendToUser(userId, ringCancel(callId, "answered_elsewhere"));
            });
  }

  /** The callee declined (or could not take it): a 1-on-1 ends, a group call goes on. */
  public void decline(String userId, String callId, String reason) {
    sfuSessionFor(userId, callId)
        .ifPresent(
            s -> {
              String why = DECLINE_REASONS.contains(reason) ? reason : "declined";
              calls.sendToUser(userId, ringCancel(callId, "declined"));
              if ("direct".equals(s.getKind())) {
                calls.sendToUser(
                    s.getStartedBy(),
                    WebRTCSignalDto.builder()
                        .type("call-declined")
                        .callId(callId)
                        .conversationId(s.getConversationId())
                        .reason(why)
                        .senderId(userId)
                        .build());
                calls.endCall(callId, why);
              }
            });
  }

  /** The caller gave up before anyone answered: stop every ring and end the call. */
  public void cancel(String userId, String callId, String reason) {
    sfuSessionFor(userId, callId)
        .filter(s -> userId.equals(s.getStartedBy()))
        .filter(s -> nobodyElseJoined(s))
        .ifPresent(
            s -> {
              String why = CANCEL_REASONS.contains(reason) ? reason : "hangup";
              calls.membersOf(s.getConversationId()).stream()
                  .filter(m -> !m.equals(userId))
                  .forEach(m -> calls.sendToUser(m, ringCancel(callId, why)));
              calls.endCall(callId, why);
            });
  }

  /**
   * A LiveKit token for {@code callId}'s room. Checked in this order so the client can tell an
   * outage from a refusal: LiveKit off (503), unknown call (404), ended or not on sfu (409), not a
   * member or blocked in a 1-on-1 (403).
   */
  public CallToken issueToken(String userId, String callId) {
    if (!props.isConfigured()) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "CALLS_UNAVAILABLE");
    }
    CallSession s =
        calls
            .findSession(callId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CALL_NOT_FOUND"));
    if (s.getEndedAt() != null) {
      throw new ApiException(HttpStatus.CONFLICT, "CALL_ENDED");
    }
    if (!CallService.isSfu(s)) {
      throw new ApiException(HttpStatus.CONFLICT, "CALL_NOT_SFU");
    }
    List<String> members = calls.membersOf(s.getConversationId());
    if (!members.contains(userId) || blockedInDirectCall(s, members, userId)) {
      throw new ApiException(HttpStatus.FORBIDDEN, "CALL_FORBIDDEN");
    }
    Document user = lookupUser(userId);
    String name = user == null ? null : user.getString("displayName");
    String avatar = user == null ? null : user.getString("avatarUrl");
    String token =
        tokens.participantToken(
            userId, name, metadata(avatar), RtcGrant.participant(RtcRooms.forCall(callId)));
    return new CallToken(props.getUrl(), token);
  }

  private boolean blockedInDirectCall(CallSession s, List<String> members, String userId) {
    if (!"direct".equals(s.getKind())) {
      return false;
    }
    return members.stream()
        .filter(m -> !m.equals(userId))
        .anyMatch(
            other ->
                blocks.existsByBlockerIdAndBlockedId(other, userId)
                    || blocks.existsByBlockerIdAndBlockedId(userId, other));
  }

  private Document lookupUser(String userId) {
    if (!ObjectId.isValid(userId)) {
      return null;
    }
    Query query = new Query(Criteria.where("_id").is(new ObjectId(userId)));
    query.fields().include("displayName").include("avatarUrl");
    return mongo.findOne(query, Document.class, "users");
  }

  private static String metadata(String avatarUrl) {
    if (avatarUrl == null || avatarUrl.isBlank()) {
      return null;
    }
    try {
      return JSON.writeValueAsString(Map.of("avatarUrl", avatarUrl));
    } catch (JsonProcessingException e) {
      return null;
    }
  }

  private Optional<CallSession> sfuSessionFor(String userId, String callId) {
    return calls
        .activeSession(callId)
        .filter(CallService::isSfu)
        .filter(s -> calls.membersOf(s.getConversationId()).contains(userId));
  }

  private static boolean nobodyElseJoined(CallSession s) {
    return s.getParticipants().stream()
        .noneMatch(p -> !p.getUserId().equals(s.getStartedBy()) && p.getJoinedAt() != null);
  }

  private static WebRTCSignalDto ringCancel(String callId, String reason) {
    return WebRTCSignalDto.builder().type("call-ring-cancel").callId(callId).reason(reason).build();
  }
}
