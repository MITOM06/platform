package com.platform.chatservice.service.meeting;

import com.platform.chatservice.model.Meeting;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Periodic meeting housekeeping, safe on many instances: the "starting in 10 minutes" reminder
 * ({@code meet.starting} + FCM {@code MEETING_STARTING}), claimed atomically so each meeting is
 * reminded exactly once cluster-wide; and retiring SCHEDULED meetings nobody opened within 48h so
 * "Upcoming" does not fill with leftovers.
 *
 * <p>Delivery is best-effort, like {@code ReminderSweepService}: a failure is logged and the claim
 * is not reset (no duplicate reminders).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MeetingReminderSweep {

  static final Duration LEAD = Duration.ofMinutes(10);
  static final Duration STALE_AFTER = Duration.ofHours(48);

  private final MeetingStore store;
  private final MeetingPeople people;
  private final MeetingEvents events;

  @Scheduled(fixedDelayString = "${app.meeting.sweep-interval-ms:60000}")
  public void sweep() {
    try {
      remindDue(Instant.now());
    } catch (Exception e) {
      log.warn("Meeting reminder sweep failed: {}", e.getMessage());
    }
    try {
      expireStale(Instant.now());
    } catch (Exception e) {
      log.warn("Meeting stale sweep failed: {}", e.getMessage());
    }
  }

  void remindDue(Instant now) {
    for (Meeting m : store.dueForReminder(now, LEAD)) {
      if (!store.claimReminder(m.getId())) {
        continue; // another instance took it
      }
      try {
        List<String> department =
            m.getDepartmentId() == null ? List.of() : people.departmentMembers(m.getDepartmentId());
        events.starting(m, MeetingMapper.recipients(m, department));
      } catch (Exception e) {
        log.error(
            "Failed to deliver the claimed reminder of meeting {} (not retried)", m.getId(), e);
      }
    }
  }

  void expireStale(Instant now) {
    long retired = store.expireStale(now.minus(STALE_AFTER), now);
    if (retired > 0) {
      log.info("Retired {} stale scheduled meeting(s)", retired);
    }
  }
}
