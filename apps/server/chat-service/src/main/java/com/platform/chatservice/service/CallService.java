package com.platform.chatservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.config.LiveKitProperties;
import com.platform.chatservice.dto.CallEventDto;
import com.platform.chatservice.dto.WebRTCSignalDto;
import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.model.Conversation;
import com.platform.chatservice.repository.CallSessionRepository;
import com.platform.chatservice.repository.ConversationRepository;
import com.platform.chatservice.repository.UserBlockRepository;
import com.platform.chatservice.service.rtc.LiveKitRoomClient;
import com.platform.chatservice.service.rtc.RtcRooms;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

/**
 * Group-call (P2P mesh) business logic: session lifecycle, roster broadcast, ringing, mesh signal
 * relay, transcript buffering, and AI-summary kickoff.
 *
 * <p>Contract: {@code docs/superpowers/specs/2026-06-22-track-a-group-call-contracts.md} §2–§5.
 * chat-service only PUBLISHES {@code call:summarize}; ai-service produces the summary and replies
 * on {@code call:summary:result} (handled by {@link CallSummaryListener}).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CallService {

  /** Redis string key holding the active callId for a conversation. */
  public static final String ACTIVE_KEY_PREFIX = "call:active:";

  /** Safety net for that key, like the busy registry's: a call that never ends must not pin it. */
  public static final Duration ACTIVE_TTL = Duration.ofHours(6);

  /** Drops the conversation's active-call key only while it still names this call. */
  private static final RedisScript<Long> RELEASE_ACTIVE =
      new DefaultRedisScript<>(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end "
              + "return 0",
          Long.class);

  /** Redis pub/sub channel: chat-service → ai-service to request a summary. */
  public static final String SUMMARIZE_CHANNEL = "call:summarize";

  /** STOMP per-user destination for mesh/ring signaling. */
  private static final String WEBRTC_QUEUE = "/queue/webrtc";

  /**
   * How long an sfu call may ring with nobody answering before the server ends it itself — the
   * clients give up at 45s/50s; this catches a caller whose app died before it could cancel.
   */
  static final Duration RING_REAPER_DELAY = Duration.ofSeconds(60);

  private final CallSessionRepository callSessionRepository;
  private final ConversationRepository conversationRepository;
  private final UserBlockRepository userBlockRepository;
  private final ClusterMessageBroker clusterBroker;
  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;
  private final LiveKitProperties liveKitProperties;
  private final LiveKitRoomClient liveKitRoomClient;
  private final CallBusyRegistry busyRegistry;
  private final MongoTemplate mongoTemplate;
  private final CallTimers timers;
  private final DirectCallGlare glare;
  private final CallSessionWriter sessionWriter;
  private final CallRoomProvisioner roomProvisioner;

  // ----------------------------------------------------------------------------------------------
  // call.start
  // ----------------------------------------------------------------------------------------------

  /** Create a session, mark the conversation active, broadcast call.started, and ring everyone. */
  public void startCall(String userId, String conversationId, String media, boolean aiNotetaker) {
    startCall(userId, conversationId, media, aiNotetaker, false);
  }

  /** As above; {@code canMerge}: the app joins a {@code call-merged} call (see DirectCallGlare). */
  public void startCall(
      String userId, String conversationId, String media, boolean aiNotetaker, boolean canMerge) {
    if (conversationId == null || conversationId.isBlank()) {
      return;
    }

    // Only a member may ring a conversation: otherwise anyone who knows (or can list, for public
    // channels) a conversation id could ring every member in it under their own name.
    Conversation conv = conversationRepository.findById(conversationId).orElse(null);
    if (conv == null
        || conv.getParticipants() == null
        || !conv.getParticipants().contains(userId)) {
      return;
    }
    boolean direct = CallSessions.isDirect(conv);
    // Block guard: a 1-on-1 blocked in either direction does not ring (issueToken refuses both
    // directions too, so the call could never connect)
    if (direct) {
      for (String p : conv.getParticipants()) {
        if (!p.equals(userId)
            && (userBlockRepository.existsByBlockerIdAndBlockedId(p, userId)
                || userBlockRepository.existsByBlockerIdAndBlockedId(userId, p))) {
          WebRTCSignalDto blocked =
              WebRTCSignalDto.builder()
                  .type("call-blocked")
                  .conversationId(conversationId)
                  .senderId(userId)
                  .build();
          clusterBroker.convertAndSendToUser(userId, WEBRTC_QUEUE, blocked);
          return;
        }
      }
    }

    boolean sfu = liveKitProperties.callsUseSfu();
    List<String> members = conv.getParticipants();
    // From the conversation's type, not its size: a group that happens to have two members is
    // still a group (both clients drop a "direct" ring that is not a 1-on-1 chat).
    String kind = direct ? "direct" : "group";
    if (sfu && "direct".equals(kind)) {
      String callee = members.stream().filter(m -> !m.equals(userId)).findFirst().orElse(null);
      String calleeCall = busyRegistry.busyCallOf(callee);
      if (calleeCall != null && isGhostRing(calleeCall)) {
        expireUnanswered(calleeCall);
        calleeCall = null;
      }
      // Both tapped Call: they are ringing us right now — answer their call instead of "busy".
      if (canMerge
          && calleeCall != null
          && glare.joinIfTheyAreCalling(userId, calleeCall, conversationId)) {
        return;
      }
      if (calleeCall != null) {
        sendToUser(
            userId,
            WebRTCSignalDto.builder()
                .type("call-declined")
                .conversationId(conversationId)
                .reason("busy")
                .senderId(callee)
                .build());
        return;
      }
    }

    String callId = UUID.randomUUID().toString();
    Instant now = Instant.now();

    CallSession session =
        CallSession.builder()
            .callId(callId)
            .conversationId(conversationId)
            .startedBy(userId)
            .startedByName(userId)
            .startedAt(now)
            .media(media == null ? "audio" : media)
            .aiNotetaker(aiNotetaker)
            .transport(sfu ? "sfu" : "mesh")
            .kind(kind)
            .participants(new ArrayList<>(List.of(CallSessions.participant(userId, now))))
            .build();
    callSessionRepository.save(session);
    boolean sfuDirect = sfu && "direct".equals(kind);
    if (sfu) {
      busyRegistry.markBusy(userId, callId);
    }
    if (sfuDirect && !glare.claimOrMerge(userId, session, canMerge)) {
      return; // started at the same instant as theirs: joined their call instead
    }
    if (sfu) {
      timers.after(RING_REAPER_DELAY, () -> expireUnanswered(callId));
      roomProvisioner.createFor(callId);
    }
    if (!sfuDirect) {
      redisTemplate.opsForValue().set(ACTIVE_KEY_PREFIX + conversationId, callId, ACTIVE_TTL);
    }

    broadcastStarted(session);
    ringOtherMembers(session);
  }

  private void broadcastStarted(CallSession session) {
    CallEventDto event =
        CallEventDto.builder()
            .event("call.started")
            .callId(session.getCallId())
            .conversationId(session.getConversationId())
            .media(session.getMedia())
            .aiNotetaker(session.isAiNotetaker())
            .startedBy(session.getStartedBy())
            .startedByName(session.getStartedByName())
            .participants(CallSessions.toParticipantDtos(session))
            .transport(session.getTransport())
            .kind(session.getKind())
            .livekitUrl(CallSessions.isSfu(session) ? liveKitProperties.getUrl() : null)
            .build();
    broadcastToConversation(session.getConversationId(), event);
  }

  private void ringOtherMembers(CallSession session) {
    List<String> members = membersOf(session.getConversationId());
    for (String memberId : members) {
      if (memberId.equals(session.getStartedBy())) {
        continue;
      }
      // On sfu a member already in another call is not rung (a 1-on-1 to them never got here).
      if (CallSessions.isSfu(session) && busyRegistry.busyCallOf(memberId) != null) {
        continue;
      }
      WebRTCSignalDto ring =
          WebRTCSignalDto.builder()
              .type("call-ring")
              .callId(session.getCallId())
              .conversationId(session.getConversationId())
              .senderId(session.getStartedBy())
              .startedByName(session.getStartedByName())
              .media(session.getMedia())
              .aiNotetaker(session.isAiNotetaker())
              .transport(session.getTransport())
              .kind(session.getKind())
              .build();
      clusterBroker.convertAndSendToUser(memberId, WEBRTC_QUEUE, ring);
    }
  }

  // ----------------------------------------------------------------------------------------------
  // call.join / call.leave
  // ----------------------------------------------------------------------------------------------

  /** Append (or re-activate) the caller as a participant and broadcast the roster. */
  public void joinCall(String userId, String callId) {
    CallSession session = callSessionRepository.findByCallId(callId).orElse(null);
    if (session == null || session.getEndedAt() != null) {
      return;
    }
    if (!membersOf(session.getConversationId()).contains(userId)) {
      return; // a callId is not a ticket: only the conversation's members may join
    }
    Instant now = Instant.now();
    updateActive(
            callId,
            s -> {
              CallSession.Participant existing = CallSessions.findParticipant(s, userId);
              if (existing == null) {
                s.getParticipants().add(CallSessions.participant(userId, now));
              } else {
                // Rejoin: clear the previous leftAt so the roster shows them active again.
                existing.setLeftAt(null);
                if (existing.getJoinedAt() == null) {
                  existing.setJoinedAt(now);
                }
              }
              return true;
            })
        .ifPresent(this::broadcastRoster);
  }

  /** Mark the caller as left; broadcast roster; end the call if no one remains. */
  public void leaveCall(String userId, String callId) {
    Instant now = Instant.now();
    CallSession session =
        updateActive(
                callId,
                s -> {
                  CallSession.Participant existing = CallSessions.findParticipant(s, userId);
                  if (CallSessions.isSfu(s) && existing == null) {
                    return false; // not in this call — cannot hang it up for the people who are
                  }
                  if (existing != null && existing.getLeftAt() == null) {
                    existing.setLeftAt(now);
                  }
                  return true;
                })
            .orElse(null);
    if (session == null) {
      return;
    }
    broadcastRoster(session);
    if (CallSessions.isSfu(session)) {
      busyRegistry.clear(userId, callId);
      if ("direct".equals(session.getKind())) {
        // The caller giving up before anyone answered is a cancel, whichever of the app's
        // call.cancel / call.leave the server handles first: the callee's devices stop ringing.
        if (userId.equals(session.getStartedBy()) && !CallSessions.answeredByOthers(session)) {
          membersOf(session.getConversationId()).stream()
              .filter(m -> !m.equals(userId))
              .forEach(
                  m ->
                      sendToUser(
                          m,
                          WebRTCSignalDto.builder()
                              .type("call-ring-cancel")
                              .callId(callId)
                              .reason("hangup")
                              .build()));
        }
        // A 1-on-1 cannot go on with one person: hanging up ends it for both.
        endCall(callId, "hangup");
        return;
      }
    }

    boolean anyActive = session.getParticipants().stream().anyMatch(p -> p.getLeftAt() == null);
    if (!anyActive) {
      endCall(callId);
    }
  }

  /**
   * End the call: stamp endedAt, broadcast call.ended, clear the active key, and (if the AI
   * notetaker is on) ask ai-service for a summary. Idempotent — a no-op if already ended.
   */
  public void endCall(String callId) {
    endCall(callId, "hangup");
  }

  /** As {@link #endCall(String)}, telling clients why: hangup | declined | busy | … */
  public void endCall(String callId, String reason) {
    if (callId == null) {
      return;
    }
    // Atomic claim: a hang-up and a LiveKit webhook can race to end the same call; only the one
    // that flips endedAt broadcasts, closes the room and asks for a summary.
    CallSession session =
        mongoTemplate.findAndModify(
            new Query(Criteria.where("callId").is(callId).and("endedAt").is(null)),
            new Update().set("endedAt", Instant.now()),
            FindAndModifyOptions.options().returnNew(true),
            CallSession.class);
    if (session == null) {
      return;
    }

    CallEventDto event =
        CallEventDto.builder().event("call.ended").callId(callId).reason(reason).build();
    broadcastToConversation(session.getConversationId(), event);

    // Not a plain DEL: a newer call in the same conversation may hold the key by now.
    redisTemplate.execute(
        RELEASE_ACTIVE, List.of(ACTIVE_KEY_PREFIX + session.getConversationId()), callId);

    if (CallSessions.isSfu(session)) {
      // Every member, not just those LiveKit saw join: someone who answered but never connected
      // was marked busy too. clear() only drops a key that still points at this call.
      busyRegistry.clear(session.getStartedBy(), callId);
      session.getParticipants().forEach(p -> busyRegistry.clear(p.getUserId(), callId));
      membersOf(session.getConversationId()).forEach(m -> busyRegistry.clear(m, callId));
      try {
        liveKitRoomClient.deleteRoom(RtcRooms.forCall(callId));
      } catch (RuntimeException e) {
        // The room may already be gone (LiveKit closes empty rooms itself).
        log.warn("Could not close LiveKit room for call {}: {}", callId, e.toString());
      }
    }

    if (session.isAiNotetaker()) {
      publishSummarize(session.getCallId(), session.getConversationId());
    }
  }

  private void publishSummarize(String callId, String conversationId) {
    try {
      String payload =
          objectMapper.writeValueAsString(
              Map.of("callId", callId, "conversationId", conversationId));
      redisTemplate.convertAndSend(SUMMARIZE_CHANNEL, payload);
    } catch (Exception e) {
      log.error("Failed to publish {} for call {}", SUMMARIZE_CHANNEL, callId, e);
    }
  }

  // ----------------------------------------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------------------------------------

  /** The session, ended or not. */
  Optional<CallSession> findSession(String callId) {
    return callId == null ? Optional.empty() : callSessionRepository.findByCallId(callId);
  }

  /** The session while it is still running. */
  Optional<CallSession> activeSession(String callId) {
    return findSession(callId).filter(s -> s.getEndedAt() == null);
  }

  /**
   * Change the running session {@code callId} without losing a concurrent write (see {@link
   * CallSessionWriter}). Empty when it has ended or {@code change} declined.
   */
  Optional<CallSession> updateActive(String callId, Predicate<CallSession> change) {
    return sessionWriter.updateActive(callId, change);
  }

  /** Server-side ring timeout for sfu calls (see {@link #RING_REAPER_DELAY}). */
  void expireUnanswered(String callId) {
    activeSession(callId)
        .filter(CallSessions::isSfu)
        .filter(s -> !CallSessions.answeredByOthers(s))
        .ifPresent(
            s -> {
              membersOf(s.getConversationId()).stream()
                  .filter(m -> !m.equals(s.getStartedBy()))
                  .forEach(
                      m ->
                          sendToUser(
                              m,
                              WebRTCSignalDto.builder()
                                  .type("call-ring-cancel")
                                  .callId(callId)
                                  .reason("no_answer")
                                  .build()));
              endCall(callId, "no_answer");
            });
  }

  /** An sfu ring nobody answered that is older than {@link CallSessions#GHOST_RING_AGE}. */
  boolean isGhostRing(String callId) {
    return CallSessions.isGhostRing(activeSession(callId).orElse(null));
  }

  void sendToUser(String userId, WebRTCSignalDto dto) {
    clusterBroker.convertAndSendToUser(userId, WEBRTC_QUEUE, dto);
  }

  void broadcastRoster(CallSession session) {
    CallEventDto event =
        CallEventDto.builder()
            .event("call.roster")
            .callId(session.getCallId())
            .participants(CallSessions.toParticipantDtos(session))
            .build();
    broadcastToConversation(session.getConversationId(), event);
  }

  private void broadcastToConversation(String conversationId, CallEventDto event) {
    clusterBroker.convertAndSend("/topic/conversation/" + conversationId, event);
  }

  List<String> membersOf(String conversationId) {
    return conversationRepository
        .findById(conversationId)
        .map(c -> c.getParticipants() == null ? List.<String>of() : c.getParticipants())
        .orElse(List.of());
  }
}
