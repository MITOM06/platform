package com.platform.chatservice.service.meeting;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.chatservice.model.Meeting;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Claims a summary slot on the meeting (atomic, once per attempt) and asks ai-service for it on
 * {@code meet:summarize}. A publish failure leaves the state PENDING; the stale sweep fails it.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MeetingSummaryTrigger {

  public static final String SUMMARIZE_CHANNEL = "meet:summarize";

  private final MeetingStore store;
  private final StringRedisTemplate redis;
  private final ObjectMapper objectMapper;

  /** First request when an AI meeting ends; true when this call claimed and published. */
  public boolean requestFirst(Meeting m) {
    String attempt = UUID.randomUUID().toString();
    return store.claimSummary(m.getId(), attempt, Instant.now()) && publish(m, attempt);
  }

  /** Outcome of {@link #regenerate}. */
  public enum Result {
    /** Claimed and published. */
    PUBLISHED,
    /** Another request (or a state change) won the claim; nothing was published. */
    REFUSED,
    /** Claimed (state is PENDING) but the publish failed; the stale sweep will fail it. */
    PUBLISH_FAILED
  }

  /** "Generate again"; true when this call claimed and published. */
  public boolean requestAgain(Meeting m) {
    return regenerate(m) == Result.PUBLISHED;
  }

  /** Like {@link #requestAgain} but tells a refused claim from a failed publish. */
  public Result regenerate(Meeting m) {
    String attempt = UUID.randomUUID().toString();
    if (!store.claimRegenerate(m.getId(), attempt, Instant.now())) {
      return Result.REFUSED;
    }
    return publish(m, attempt) ? Result.PUBLISHED : Result.PUBLISH_FAILED;
  }

  private boolean publish(Meeting m, String attempt) {
    try {
      String payload =
          objectMapper.writeValueAsString(
              Map.of("meetingId", m.getId(), "attempt", attempt, "requesterId", m.getHostId()));
      redis.convertAndSend(SUMMARIZE_CHANNEL, payload);
      return true;
    } catch (Exception e) {
      log.error("Failed to publish {} for meeting {}", SUMMARIZE_CHANNEL, m.getId(), e);
      return false;
    }
  }
}
