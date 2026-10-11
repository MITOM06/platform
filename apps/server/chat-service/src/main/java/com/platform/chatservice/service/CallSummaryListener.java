package com.platform.chatservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.model.CallSession;
import com.platform.chatservice.repository.CallSessionRepository;
import java.time.Duration;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Subscribes to the Redis {@code call:summary:result} channel (produced by ai-service) and persists
 * the AI meeting summary as a {@code meeting_summary} Message, broadcasting it to the conversation
 * topic the same way normal messages are broadcast, then backfills {@link
 * CallSession#getSummaryMessageId()}.
 *
 * <p>Registered next to {@link AiResponseListener} in {@code RedisListenerConfig}. Contract §5 step
 * 7. chat-service only CONSUMES this channel; producing the summary is ai-service's job.
 *
 * <p>Inbound payload:
 *
 * <pre>{ conversationId, callId, payload: { attendees, durationSec, overview, keyPoints,
 * actionItems } }</pre>
 *
 * The {@code payload} object is stored verbatim as the Message content (JSON string).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CallSummaryListener implements MessageListener {

  /** One summary per call cluster-wide: every instance receives the same pub/sub message. */
  static final String CLAIM_KEY_PREFIX = "call:summary:claim:";

  private static final Duration CLAIM_TTL = Duration.ofHours(1);

  private final AiMessageService aiMessageService;
  private final CallSessionRepository callSessionRepository;
  private final ObjectMapper objectMapper;
  private final StringRedisTemplate redisTemplate;

  @Override
  public void onMessage(org.springframework.data.redis.connection.Message message, byte[] pattern) {
    try {
      Map<String, Object> envelope =
          objectMapper.readValue(message.getBody(), new TypeReference<>() {});
      String conversationId = (String) envelope.get("conversationId");
      String callId = (String) envelope.get("callId");
      Object payload = envelope.get("payload");
      if (conversationId == null || payload == null) {
        log.warn("call:summary:result missing conversationId or payload");
        return;
      }

      // Pub/sub fans this out to every instance; only the one that claims the call saves and
      // broadcasts it (as AiResponseListener does for AI replies).
      if (callId != null
          && !Boolean.TRUE.equals(
              redisTemplate.opsForValue().setIfAbsent(CLAIM_KEY_PREFIX + callId, "1", CLAIM_TTL))) {
        return;
      }

      String contentJson = objectMapper.writeValueAsString(payload);
      String summaryMessageId = aiMessageService.saveMeetingSummary(conversationId, contentJson);

      if (callId != null) {
        callSessionRepository
            .findByCallId(callId)
            .ifPresent(
                (CallSession session) -> {
                  session.setSummaryMessageId(summaryMessageId);
                  callSessionRepository.save(session);
                });
      }
    } catch (Exception e) {
      log.error("Failed to process call:summary:result message", e);
    }
  }
}
