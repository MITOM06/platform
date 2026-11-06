package com.platform.chatservice.service.meeting;

import com.platform.chatservice.model.Meeting;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Flips AI summaries stuck in PENDING (ai-service down, lost message, failed publish) to FAILED so
 * the host can regenerate, and tells host and co-hosts. Each flip is a conditional update, so many
 * instances never both flip (or announce) the same meeting.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MeetingSummarySweep {

  static final Duration STALE_AFTER = Duration.ofMinutes(10);

  private final MeetingStore store;
  private final MeetingEvents events;

  @Scheduled(fixedDelayString = "${app.meeting.sweep-interval-ms:60000}")
  public void sweep() {
    try {
      failStale(Instant.now());
    } catch (Exception e) {
      log.warn("Meeting summary sweep failed: {}", e.getMessage());
    }
  }

  void failStale(Instant now) {
    List<Meeting> failed = store.failStaleSummaries(now.minus(STALE_AFTER));
    if (!failed.isEmpty()) {
      log.info("Failed {} meeting summary(ies) stuck in PENDING", failed.size());
    }
    for (Meeting m : failed) {
      try {
        events.summaryReady(m, managers(m));
      } catch (Exception e) {
        log.warn("meet.summary.ready for meeting {} failed: {}", m.getId(), e.getMessage());
      }
    }
  }

  private static Set<String> managers(Meeting m) {
    Set<String> out = new LinkedHashSet<>();
    if (m.getHostId() != null) {
      out.add(m.getHostId());
    }
    if (m.getCoHostIds() != null) {
      out.addAll(m.getCoHostIds());
    }
    return out;
  }
}
