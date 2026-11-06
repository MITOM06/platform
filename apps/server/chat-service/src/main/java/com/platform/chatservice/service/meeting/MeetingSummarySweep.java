package com.platform.chatservice.service.meeting;

import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Flips AI summaries stuck in PENDING (ai-service down, lost message, failed publish) to FAILED so
 * the host can regenerate. One atomic multi-update, safe on many instances.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MeetingSummarySweep {

  static final Duration STALE_AFTER = Duration.ofMinutes(10);

  private final MeetingStore store;

  @Scheduled(fixedDelayString = "${app.meeting.sweep-interval-ms:60000}")
  public void sweep() {
    try {
      failStale(Instant.now());
    } catch (Exception e) {
      log.warn("Meeting summary sweep failed: {}", e.getMessage());
    }
  }

  void failStale(Instant now) {
    long failed = store.failStaleSummaries(now.minus(STALE_AFTER));
    if (failed > 0) {
      log.info("Failed {} meeting summary(ies) stuck in PENDING", failed);
    }
  }
}
