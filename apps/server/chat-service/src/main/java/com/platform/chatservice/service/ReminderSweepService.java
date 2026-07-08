package com.platform.chatservice.service;

import com.mongodb.client.result.UpdateResult;
import com.platform.chatservice.model.Reminder;
import com.platform.chatservice.repository.ReminderRepository;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
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
 * is kept as a best-effort out-of-app nudge for mobile.
 *
 * <p>Concurrency: each due reminder is CLAIMED with a single atomic conditional update ({@code
 * notified:false → true}) before any delivery work, so with multiple instances only the one that
 * wins the claim delivers it (no duplicate delivery). A delivery failure AFTER the claim is NOT
 * retried — resetting {@code notified} would let a poison reminder re-fire forever — so behavior is
 * single-delivery, at-least-effort; the failed attempt is counted in {@code attempts}.
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
  private final MongoTemplate mongoTemplate;

  /** Deliver any reminders whose time has arrived. */
  @Scheduled(fixedDelayString = "${app.reminder.sweep-interval-ms:60000}")
  public void sweepDueReminders() {
    List<Reminder> due =
        reminderRepository.findByDoneFalseAndNotifiedFalseAndRemindAtLessThanEqual(Instant.now());
    if (due.isEmpty()) return;

    int delivered = 0;
    for (Reminder reminder : due) {
      // Atomically claim the reminder BEFORE acting: flip notified=false→true in a single
      // conditional update. Only the instance whose update actually modified a document (i.e. won
      // the race) proceeds — this prevents duplicate delivery when multiple instances sweep the
      // same due reminder concurrently.
      UpdateResult claim =
          mongoTemplate.updateFirst(
              new Query(Criteria.where("_id").is(reminder.getId()).and("notified").is(false)),
              new Update().set("notified", true),
              Reminder.class);
      if (claim.getModifiedCount() != 1) {
        // Already claimed/delivered by another instance (or this tick raced with a status change).
        continue;
      }

      try {
        // Load-bearing: persist + broadcast the reminder as an in-chat type:"ai"
        // message so web + history + mobile all render it via the existing pipeline.
        aiMessageService.saveAiMessage(
            reminder.getConversationId(), formatReminderText(reminder.getText()), null);

        // Best-effort out-of-app nudge for mobile; failure here must NOT undo the claim.
        try {
          fcmService.sendReminderPush(
              reminder.getUserId(), reminder.getText(), reminder.getConversationId());
        } catch (Exception pushErr) {
          log.warn(
              "Reminder FCM push failed for {} (in-chat delivered)", reminder.getId(), pushErr);
        }
        delivered++;
      } catch (Exception e) {
        // Delivery failed AFTER the claim. We deliberately do NOT reset notified=false: resetting
        // would let a permanently-failing ("poison") reminder be retried forever on every sweep.
        // Behavior is single-delivery, at-least-effort. Track the attempt for observability.
        mongoTemplate.updateFirst(
            new Query(Criteria.where("_id").is(reminder.getId())),
            new Update().inc("attempts", 1),
            Reminder.class);
        log.error("Failed to deliver claimed reminder {} (not retried)", reminder.getId(), e);
      }
    }
    log.debug("Reminder sweep delivered {} of {} due reminder(s)", delivered, due.size());
  }

  /** Prefix the reminder body with the bell so it reads as a reminder in chat. */
  static String formatReminderText(String text) {
    return REMINDER_PREFIX + (text == null ? "" : text);
  }
}
