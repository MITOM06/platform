package com.platform.chatservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.dto.CallEventDto;
import com.platform.chatservice.dto.WebRTCSignalDto;
import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.repository.CallSessionRepository;
import com.platform.chatservice.repository.ConversationRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
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

  /** Redis list key buffering transcript segments for a call. */
  public static final String TRANSCRIPT_KEY_PREFIX = "call:transcript:";

  /** Redis pub/sub channel: chat-service → ai-service to request a summary. */
  public static final String SUMMARIZE_CHANNEL = "call:summarize";

  /** STOMP per-user destination for mesh/ring signaling. */
  private static final String WEBRTC_QUEUE = "/queue/webrtc";

  /** Transcript buffer lives ~2h. */
  private static final Duration TRANSCRIPT_TTL = Duration.ofHours(2);

  private final CallSessionRepository callSessionRepository;
  private final ConversationRepository conversationRepository;
  private final SimpMessagingTemplate messagingTemplate;
  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;

  // ----------------------------------------------------------------------------------------------
  // call.start
  // ----------------------------------------------------------------------------------------------

  /** Create a session, mark the conversation active, broadcast call.started, and ring everyone. */
  public void startCall(String userId, String conversationId, String media, boolean aiNotetaker) {
    if (conversationId == null || conversationId.isBlank()) {
      return;
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
            .participants(new ArrayList<>(List.of(participant(userId, now))))
            .build();
    callSessionRepository.save(session);

    redisTemplate.opsForValue().set(ACTIVE_KEY_PREFIX + conversationId, callId);

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
            .participants(toParticipantDtos(session))
            .build();
    broadcastToConversation(session.getConversationId(), event);
  }

  private void ringOtherMembers(CallSession session) {
    List<String> members = membersOf(session.getConversationId());
    for (String memberId : members) {
      if (memberId.equals(session.getStartedBy())) {
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
              .build();
      messagingTemplate.convertAndSendToUser(memberId, WEBRTC_QUEUE, ring);
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
    Instant now = Instant.now();
    CallSession.Participant existing = findParticipant(session, userId);
    if (existing == null) {
      session.getParticipants().add(participant(userId, now));
    } else {
      // Rejoin: clear the previous leftAt so the roster shows them active again.
      existing.setLeftAt(null);
      if (existing.getJoinedAt() == null) {
        existing.setJoinedAt(now);
      }
    }
    callSessionRepository.save(session);
    broadcastRoster(session);
  }

  /** Mark the caller as left; broadcast roster; end the call if no one remains. */
  public void leaveCall(String userId, String callId) {
    CallSession session = callSessionRepository.findByCallId(callId).orElse(null);
    if (session == null || session.getEndedAt() != null) {
      return;
    }
    CallSession.Participant existing = findParticipant(session, userId);
    if (existing != null && existing.getLeftAt() == null) {
      existing.setLeftAt(Instant.now());
    }
    callSessionRepository.save(session);
    broadcastRoster(session);

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
    CallSession session = callSessionRepository.findByCallId(callId).orElse(null);
    if (session == null || session.getEndedAt() != null) {
      return;
    }
    session.setEndedAt(Instant.now());
    callSessionRepository.save(session);

    CallEventDto event = CallEventDto.builder().event("call.ended").callId(callId).build();
    broadcastToConversation(session.getConversationId(), event);

    redisTemplate.delete(ACTIVE_KEY_PREFIX + session.getConversationId());

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
  // Mesh signaling relay (offer / answer / ice)
  // ----------------------------------------------------------------------------------------------

  /**
   * Relay a mesh signal to the target participant's private queue, stamping {@code fromId} (and
   * {@code senderId}) with the originator so the recipient knows the source.
   */
  public void relaySignal(String fromUserId, String type, WebRTCSignalDto dto) {
    if (dto == null || dto.getTargetId() == null) {
      return;
    }
    dto.setType(type);
    dto.setFromId(fromUserId);
    dto.setSenderId(fromUserId);
    messagingTemplate.convertAndSendToUser(dto.getTargetId(), WEBRTC_QUEUE, dto);
  }

  // ----------------------------------------------------------------------------------------------
  // call.transcript
  // ----------------------------------------------------------------------------------------------

  /** Buffer a transcript segment in Redis (RPUSH + TTL). Server fills userId/displayName. */
  public void appendTranscript(String userId, String callId, String text, Long ts) {
    if (callId == null || text == null || text.isBlank()) {
      return;
    }
    try {
      String segment =
          objectMapper.writeValueAsString(
              orderedSegment(userId, userId, text, ts == null ? Instant.now().toEpochMilli() : ts));
      String key = TRANSCRIPT_KEY_PREFIX + callId;
      redisTemplate.opsForList().rightPush(key, segment);
      redisTemplate.expire(key, TRANSCRIPT_TTL);
    } catch (Exception e) {
      log.error("Failed to append transcript for call {}", callId, e);
    }
  }

  // ----------------------------------------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------------------------------------

  private Map<String, Object> orderedSegment(
      String userId, String displayName, String text, long ts) {
    // LinkedHashMap-style ordering is not required on the wire; ai-service reads by key.
    return Map.of("userId", userId, "displayName", displayName, "text", text, "ts", ts);
  }

  private void broadcastRoster(CallSession session) {
    CallEventDto event =
        CallEventDto.builder()
            .event("call.roster")
            .callId(session.getCallId())
            .participants(toParticipantDtos(session))
            .build();
    broadcastToConversation(session.getConversationId(), event);
  }

  private void broadcastToConversation(String conversationId, CallEventDto event) {
    messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, event);
  }

  private List<String> membersOf(String conversationId) {
    return conversationRepository
        .findById(conversationId)
        .map(c -> c.getParticipants() == null ? List.<String>of() : c.getParticipants())
        .orElse(List.of());
  }

  private CallSession.Participant findParticipant(CallSession session, String userId) {
    if (session.getParticipants() == null) {
      return null;
    }
    return session.getParticipants().stream()
        .filter(p -> userId.equals(p.getUserId()))
        .findFirst()
        .orElse(null);
  }

  private CallSession.Participant participant(String userId, Instant joinedAt) {
    return CallSession.Participant.builder()
        .userId(userId)
        .displayName(userId)
        .joinedAt(joinedAt)
        .build();
  }

  private List<CallEventDto.ParticipantDto> toParticipantDtos(CallSession session) {
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
