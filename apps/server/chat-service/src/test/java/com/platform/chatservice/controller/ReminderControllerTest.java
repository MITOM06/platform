package com.platform.chatservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.ReminderResponse;
import com.platform.chatservice.model.Reminder;
import com.platform.chatservice.repository.ReminderRepository;
import com.platform.chatservice.security.UserPrincipal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

/** Reminders are private: every read / write is scoped to the caller's own rows. */
class ReminderControllerTest {

  private final ReminderRepository repo = mock(ReminderRepository.class);
  private final ReminderController controller = new ReminderController(repo);
  private final UserPrincipal me = new UserPrincipal("me");

  private Reminder mine() {
    return Reminder.builder()
        .id("r1")
        .userId("me")
        .conversationId("c1")
        .text("call mom")
        .remindAt(Instant.parse("2026-11-07T08:00:00Z"))
        .build();
  }

  @Test
  void listReturnsOnlyCallersOpenReminders() {
    when(repo.findByUserIdAndDoneFalseOrderByRemindAtAsc("me")).thenReturn(List.of(mine()));
    List<ReminderResponse> list = controller.getReminders(me);
    assertThat(list).hasSize(1);
    assertThat(list.get(0).text()).isEqualTo("call mom");
    assertThat(list.get(0).userId()).isEqualTo("me");
  }

  @Test
  void markDoneOwnReminder() {
    Reminder r = mine();
    when(repo.findByIdAndUserId("r1", "me")).thenReturn(Optional.of(r));
    ResponseEntity<ReminderResponse> res = controller.markDone("r1", me);
    assertThat(res.getBody().done()).isTrue();
    assertThat(r.isDone()).isTrue();
    verify(repo).save(r);
  }

  @Test
  void someoneElsesReminderIs404AndUntouched() {
    when(repo.findByIdAndUserId(anyString(), anyString())).thenReturn(Optional.empty());
    assertThatThrownBy(() -> controller.markDone("r1", me))
        .isInstanceOfSatisfying(
            ResponseStatusException.class,
            e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    assertThatThrownBy(() -> controller.deleteReminder("r1", me))
        .isInstanceOf(ResponseStatusException.class);
    verify(repo, never()).save(any());
    verify(repo, never()).deleteById(anyString());
  }

  @Test
  void deleteOwnReminder() {
    when(repo.findByIdAndUserId("r1", "me")).thenReturn(Optional.of(mine()));
    assertThat(controller.deleteReminder("r1", me).getStatusCode())
        .isEqualTo(HttpStatus.NO_CONTENT);
    verify(repo).deleteById("r1");
  }
}
