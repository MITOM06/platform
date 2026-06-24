package com.platform.chatservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

/**
 * TASK-11: verifies the sweep persists a fired reminder as an in-chat type:"ai" message (the
 * load-bearing delivery), still attempts the FCM push, and only flags {@code notified=true} after
 * the in-chat persist succeeds (idempotency / at-least-once on failure).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReminderSweepServiceTest {

  @Mock private ReminderRepository reminderRepository;
  @Mock private FcmService fcmService;
  @Mock private AiMessageService aiMessageService;

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

  @Test
  void formatsReminderTextWithBellPrefix() {
    assertThat(ReminderSweepService.formatReminderText("Standup")).isEqualTo("🔔 Standup");
    assertThat(ReminderSweepService.formatReminderText(null)).isEqualTo("🔔 ");
  }

  @Test
  void persistsInChatMessageAndPushesAndMarksNotified() {
    Reminder r = due("r1");
    when(reminderRepository.findByDoneFalseAndNotifiedFalseAndRemindAtLessThanEqual(any()))
        .thenReturn(List.of(r));

    service.sweepDueReminders();

    // In-chat type:"ai" persist with the bell-prefixed text, null trace.
    verify(aiMessageService).saveAiMessage(eq("conv-1"), eq("🔔 Standup"), isNull());
    // FCM push kept (best-effort) with the RAW text.
    verify(fcmService).sendReminderPush("user-1", "Standup", "conv-1");
    // notified flag set + persisted exactly once.
    assertThat(r.isNotified()).isTrue();
    verify(reminderRepository).save(r);
  }

  @Test
  void doesNotMarkNotifiedWhenInChatPersistFails() {
    Reminder r = due("r2");
    when(reminderRepository.findByDoneFalseAndNotifiedFalseAndRemindAtLessThanEqual(any()))
        .thenReturn(List.of(r));
    doThrow(new RuntimeException("mongo down"))
        .when(aiMessageService)
        .saveAiMessage(any(), any(), any());

    service.sweepDueReminders();

    // Persist failed → leave notified=false so it retries next tick (at-least-once).
    assertThat(r.isNotified()).isFalse();
    verify(reminderRepository, never()).save(any());
  }

  @Test
  void stillMarksNotifiedWhenOnlyFcmPushFails() {
    Reminder r = due("r3");
    when(reminderRepository.findByDoneFalseAndNotifiedFalseAndRemindAtLessThanEqual(any()))
        .thenReturn(List.of(r));
    doThrow(new RuntimeException("fcm 500")).when(fcmService).sendReminderPush(any(), any(), any());

    service.sweepDueReminders();

    // In-chat delivery is the source of truth; a failed best-effort push must not block it.
    verify(aiMessageService).saveAiMessage(eq("conv-1"), eq("🔔 Standup"), isNull());
    assertThat(r.isNotified()).isTrue();
    verify(reminderRepository).save(r);
  }
}
