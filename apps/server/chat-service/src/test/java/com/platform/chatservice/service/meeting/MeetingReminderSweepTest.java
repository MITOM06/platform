package com.platform.chatservice.service.meeting;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.model.Meeting;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingReminderSweepTest {

  @Mock private MeetingStore store;
  @Mock private MeetingPeople people;
  @Mock private MeetingEvents events;
  @InjectMocks private MeetingReminderSweep sweep;
  private final Instant now = Instant.parse("2026-10-08T01:50:00Z");

  private Meeting meeting(String id, String departmentId) {
    return Meeting.builder()
        .id(id)
        .hostId("host")
        .coHostIds(new ArrayList<>(List.of("co")))
        .inviteeIds(new ArrayList<>(List.of("inv", "kicked")))
        .removedIds(new ArrayList<>(List.of("kicked")))
        .departmentId(departmentId)
        .scheduledStart(now.plus(Duration.ofMinutes(10)))
        .build();
  }

  @Test
  void aDueMeetingIsClaimedOnceAndEveryoneConcernedIsReminded() {
    Meeting m = meeting("m1", "dept-a");
    when(store.dueForReminder(now, Duration.ofMinutes(10))).thenReturn(List.of(m));
    when(store.claimReminder("m1")).thenReturn(true);
    when(people.departmentMembers("dept-a")).thenReturn(List.of("d1", "inv"));

    sweep.remindDue(now);

    verify(events).starting(m, List.of("host", "co", "inv", "d1"));
  }

  @Test
  void aMeetingAnotherInstanceAlreadyClaimedIsSkipped() {
    Meeting m = meeting("m1", null);
    when(store.dueForReminder(now, Duration.ofMinutes(10))).thenReturn(List.of(m));
    when(store.claimReminder("m1")).thenReturn(false);

    sweep.remindDue(now);

    verify(events, never()).starting(any(), anyCollection());
    verify(people, never()).departmentMembers(anyString());
  }

  @Test
  void oneFailingMeetingDoesNotStopTheNext() {
    Meeting bad = meeting("bad", null);
    Meeting good = meeting("good", null);
    when(store.dueForReminder(now, Duration.ofMinutes(10))).thenReturn(List.of(bad, good));
    when(store.claimReminder(anyString())).thenReturn(true);
    doThrow(new RuntimeException("broker down")).when(events).starting(eq(bad), anyCollection());

    sweep.remindDue(now);

    verify(events).starting(eq(good), anyCollection());
  }

  @Test
  void staleScheduledMeetingsAreRetiredAfterTwoDays() {
    sweep.expireStale(now);
    verify(store).expireStale(now.minus(Duration.ofHours(48)), now);
  }
}
