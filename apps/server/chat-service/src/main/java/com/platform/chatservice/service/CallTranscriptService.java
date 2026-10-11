package com.platform.chatservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.repository.CallSessionRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Buffers the AI notetaker's speech-to-text segments for a call ({@code call:transcript:{callId}},
 * read by ai-service when the call ends). Only a member of the call's conversation may add to it,
 * and only while the call runs: the transcript becomes the meeting summary everyone reads.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CallTranscriptService {

  /** Redis list key buffering transcript segments for a call. */
  public static final String TRANSCRIPT_KEY_PREFIX = "call:transcript:";

  /** Transcript buffer lives ~2h. */
  private static final Duration TRANSCRIPT_TTL = Duration.ofHours(2);

  private final CallSessionRepository callSessionRepository;
  private final ConversationMembershipCache membership;
  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;

  /** Buffer a transcript segment in Redis (RPUSH + TTL). Server fills userId/displayName. */
  public void appendTranscript(String userId, String callId, String text, Long ts) {
    if (callId == null || text == null || text.isBlank()) {
      return;
    }
    boolean allowed =
        callSessionRepository
            .findByCallId(callId)
            .filter(s -> s.getEndedAt() == null)
            .filter(s -> membership.isMember(s.getConversationId(), userId))
            .isPresent();
    if (!allowed) {
      return;
    }
    try {
      long at = ts == null ? Instant.now().toEpochMilli() : ts;
      // ai-service reads the segment by key; ordering on the wire does not matter.
      String segment =
          objectMapper.writeValueAsString(
              Map.of("userId", userId, "displayName", userId, "text", text, "ts", at));
      String key = TRANSCRIPT_KEY_PREFIX + callId;
      redisTemplate.opsForList().rightPush(key, segment);
      redisTemplate.expire(key, TRANSCRIPT_TTL);
    } catch (Exception e) {
      log.error("Failed to append transcript for call {}", callId, e);
    }
  }
}
