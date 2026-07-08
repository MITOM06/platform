package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mongodb.client.result.UpdateResult;
import com.platform.chatservice.model.Reminder;
import com.platform.chatservice.repository.ReminderRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

/**
 * TASK-11 + concurrency hardening: the sweep atomically CLAIMS each due reminder (flip
 * notified=false→true in one conditional update) before acting, so only the instance that wins the
 * race delivers it — preventing duplicate delivery across instances. After a claim, a delivery
 * failure is NOT retried (notified stays true) so a poison reminder can't be re-attempted forever;
 * behavior is single-delivery, at-least-effort.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReminderSweepServiceTest {

  @Mock private ReminderRepository reminderRepository;
  @Mock private FcmService fcmService;
  @Mock private AiMessageService aiMessageService;
  @Mock private MongoTemplate mongoTemplate;

  @InjectMocks private ReminderSweepService service;

  private Reminder due(String id) {
    return Reminder.builder()
        .id(id)
        .userId("user-1")
        .conversationId("conv-1")
        .text("Standup")
        .remindAt(Instant.now().minusSeconds(10))
        .done(false)
        .notified(false)
        .build();
  }

  /** A claim result with the given modifiedCount (1 = won the claim, 0 = another instance won). */
  private UpdateResult claimResult(long modifiedCount) {
    return UpdateResult.acknowledged(modifiedCount, modifiedCount, null);
  }

  @Test
  void formatsReminderTextWithBellPrefix() {
    assertThat(ReminderSweepService.formatReminderText("Standup")).isEqualTo("🔔 Standup");
    assertThat(ReminderSweepService.formatReminderText(null)).isEqualTo("🔔 ");
  }

  @Test
  void claimsThenPersistsInChatMessageAndPushes() {
    Reminder r = due("r1");
    when(reminderRepository.findByDoneFalseAndNotifiedFalseAndRemindAtLessThanEqual(any()))
        .thenReturn(List.of(r));
    when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(Reminder.class)))
        .thenReturn(claimResult(1));

    service.sweepDueReminders();

    // Claim happened via an atomic conditional update (not reminderRepository.save).
    verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(Reminder.class));
    verify(reminderRepository, never()).save(any());
    // In-chat type:"ai" persist with the bell-prefixed text, null trace.
    verify(aiMessageService).saveAiMessage(eq("conv-1"), eq("🔔 Standup"), isNull());
    // FCM push kept (best-effort) with the RAW text.
    verify(fcmService).sendReminderPush("user-1", "Standup", "conv-1");
  }

  @Test
  void skipsReminderWhenClaimLostToAnotherInstance() {
    Reminder r = due("r2");
    when(reminderRepository.findByDoneFalseAndNotifiedFalseAndRemindAtLessThanEqual(any()))
        .thenReturn(List.of(r));
    // modifiedCount == 0 → another instance already claimed it this tick.
    when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(Reminder.class)))
        .thenReturn(claimResult(0));

    service.sweepDueReminders();

    verify(aiMessageService, never()).saveAiMessage(any(), any(), any());
    verify(fcmService, never()).sendReminderPush(any(), any(), any());
  }

  @Test
  void doesNotRetryAfterClaimWhenInChatPersistFails() {
    Reminder r = due("r3");
    when(reminderRepository.findByDoneFalseAndNotifiedFalseAndRemindAtLessThanEqual(any()))
        .thenReturn(List.of(r));
    when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(Reminder.class)))
        .thenReturn(claimResult(1));
    doThrow(new RuntimeException("mongo down"))
        .when(aiMessageService)
        .saveAiMessage(any(), any(), any());

    service.sweepDueReminders();

    // Claim already flipped notified=true; on failure we must NOT reset it (no re-delivery). The
    // reminder is never handed back to reminderRepository.save.
    verify(reminderRepository, never()).save(any());
    // attempts is incremented for observability (a second updateFirst on the same collection).
    verify(mongoTemplate, org.mockito.Mockito.times(2))
        .updateFirst(any(Query.class), any(Update.class), eq(Reminder.class));
  }

  @Test
  void stillDeliversWhenOnlyFcmPushFails() {
    Reminder r = due("r4");
    when(reminderRepository.findByDoneFalseAndNotifiedFalseAndRemindAtLessThanEqual(any()))
        .thenReturn(List.of(r));
    when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(Reminder.class)))
        .thenReturn(claimResult(1));
    doThrow(new RuntimeException("fcm 500")).when(fcmService).sendReminderPush(any(), any(), any());

    service.sweepDueReminders();

    // In-chat delivery is the source of truth; a failed best-effort push must not undo the claim
    // or trigger the attempts-increment failure path.
    verify(aiMessageService).saveAiMessage(eq("conv-1"), eq("🔔 Standup"), isNull());
    verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(Reminder.class));
  }
}
