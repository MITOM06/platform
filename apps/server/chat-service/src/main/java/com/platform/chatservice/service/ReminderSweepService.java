package com.platform.chatservice.service;

import com.platform.chatservice.model.Reminder;
import com.platform.chatservice.repository.ReminderRepository;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Background delivery for reminders. Reminders are created by the ai-service (via the {@code
 * create_reminder} tool) and stored in the shared {@code reminders} collection with a {@code
 * remindAt} timestamp, but nothing previously fired them — they were only ever read back in the UI.
 * This sweep closes that gap: it finds due, undone, not-yet-notified reminders, pushes them over
 * FCM, and flags them {@code notified} so they are delivered exactly once.
 *
 * <p>Mirrors {@link MessageSweepService}'s polling shape. The {@code due_sweep} compound index on
 * {@code Reminder} keeps the lookup off a collection scan.
 *
 * <p>TASK-11: a fired reminder is now persisted as a real in-chat {@code type:"ai"} message (via
 * {@link AiMessageService#saveAiMessage}) so BOTH web (which has no FCM) and mobile see it in the
 * conversation + history, broadcast over the same STOMP pipeline as every AI answer. The FCM push
 * is kept as a best-effort out-of-app nudge for mobile. The in-chat persist is the load-bearing
 * delivery; {@code notified=true} is only set after it succeeds, so a crash mid-sweep re-delivers
 * at most the in-flight item next tick (at-least-once).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReminderSweepService {

  /** Bell prefix so a fired reminder reads as a reminder, not a generic AI reply. */
  static final String REMINDER_PREFIX = "🔔 ";

  private final ReminderRepository reminderRepository;
  private final FcmService fcmService;
  private final AiMessageService aiMessageService;

  /** Deliver any reminders whose time has arrived. */
  @Scheduled(fixedDelayString = "${app.reminder.sweep-interval-ms:60000}")
  public void sweepDueReminders() {
    List<Reminder> due =
        reminderRepository.findByDoneFalseAndNotifiedFalseAndRemindAtLessThanEqual(Instant.now());
    if (due.isEmpty()) return;

    for (Reminder reminder : due) {
      try {
        // Load-bearing: persist + broadcast the reminder as an in-chat type:"ai"
        // message so web + history + mobile all render it via the existing pipeline.
        aiMessageService.saveAiMessage(
            reminder.getConversationId(), formatReminderText(reminder.getText()), null);

        // Best-effort out-of-app nudge for mobile; failure here must NOT block the
        // in-chat delivery that already succeeded.
        try {
          fcmService.sendReminderPush(
              reminder.getUserId(), reminder.getText(), reminder.getConversationId());
        } catch (Exception pushErr) {
          log.warn(
              "Reminder FCM push failed for {} (in-chat delivered)", reminder.getId(), pushErr);
        }

        // Only flag notified AFTER the in-chat persist succeeded, so a transient
        // failure is retried on the next sweep rather than silently dropped.
        reminder.setNotified(true);
        reminderRepository.save(reminder);
      } catch (Exception e) {
        // Leave notified=false → retried next tick (at-least-once).
        log.error("Failed to deliver reminder {}", reminder.getId(), e);
      }
    }
    log.debug("Reminder sweep processed {} reminder(s)", due.size());
  }

  /** Prefix the reminder body with the bell so it reads as a reminder in chat. */
  static String formatReminderText(String text) {
    return REMINDER_PREFIX + (text == null ? "" : text);
  }
}
