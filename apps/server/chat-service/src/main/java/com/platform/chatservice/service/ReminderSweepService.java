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
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReminderSweepService {

  private final ReminderRepository reminderRepository;
  private final FcmService fcmService;

  /** Deliver any reminders whose time has arrived. */
  @Scheduled(fixedDelayString = "${app.reminder.sweep-interval-ms:60000}")
  public void sweepDueReminders() {
    List<Reminder> due =
        reminderRepository.findByDoneFalseAndNotifiedFalseAndRemindAtLessThanEqual(Instant.now());
    if (due.isEmpty()) return;

    for (Reminder reminder : due) {
      boolean delivered =
          fcmService.sendReminderPush(
              reminder.getUserId(), reminder.getText(), reminder.getConversationId());
      // Only mark notified once delivery was attempted without a hard error, so a transient
      // failure (e.g. DB hiccup) is retried on the next sweep rather than silently dropped.
      if (delivered) {
        reminder.setNotified(true);
        reminderRepository.save(reminder);
      }
    }
    log.debug("Reminder sweep delivered {} reminder(s)", due.size());
  }
}
