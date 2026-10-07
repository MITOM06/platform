package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.LobbyEntryDto;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.service.CallBusyRegistry;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MeetingCloserTest {

  @Mock private MeetingStore store;
  @Mock private MeetingLobby lobby;
  @Mock private MeetingEvents events;
  @Mock private CallBusyRegistry busy;
  @InjectMocks private MeetingCloser closer;

  @Test
  void closingFreesThePeopleStillInsideAndTellsTheLobby() {
    Instant t = Instant.now();
    Meeting before =
        Meeting.builder()
            .id("m1")
            .status(MeetingStatus.LIVE)
            .attendance(
                new ArrayList<>(
                    List.of(
                        Meeting.Attendance.builder().userId("in").joinedAt(t).build(),
                        Meeting.Attendance.builder().userId("gone").joinedAt(t).leftAt(t).build())))
            .build();
    when(store.markEnded(eq("m1"), any())).thenReturn(Optional.of(before));
    when(lobby.waiting("m1")).thenReturn(List.of(new LobbyEntryDto("w1", "Wen")));

    assertThat(closer.close("m1")).isTrue();

    verify(busy).clear("in", "meet_m1");
    verify(busy, never()).clear(eq("gone"), anyString());
    verify(lobby).clear("m1");
    verify(events).ended("m1", List.of("w1"));
  }

  @Test
  void closingTwiceDoesNothingTheSecondTime() {
    when(store.markEnded(eq("m1"), any())).thenReturn(Optional.empty());

    assertThat(closer.close("m1")).isFalse();

    verify(lobby, never()).clear(anyString());
    verify(events, never()).ended(anyString(), anyCollection());
  }
}
