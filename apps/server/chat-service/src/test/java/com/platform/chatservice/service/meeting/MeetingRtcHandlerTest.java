package com.platform.chatservice.service.meeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.platform.chatservice.dto.meeting.PersonDto;
import com.platform.chatservice.model.Meeting;
import com.platform.chatservice.model.MeetingStatus;
import com.platform.chatservice.service.CallBusyRegistry;
import com.platform.chatservice.service.rtc.RtcParticipantEvent;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingRtcHandlerTest {

  @Mock private MeetingStore store;
  @Mock private MeetingEvents events;
  @Mock private CallBusyRegistry busy;
  @Mock private MeetingCloser closer;
  @Mock private MeetingPeople people;
  @InjectMocks private MeetingRtcHandler handler;
  private Meeting m;
  private final Instant at = Instant.parse("2026-10-08T02:00:05Z");

  @BeforeEach
  void setUp() {
    m = Meeting.builder().id("m1").hostId("host").build();
    when(store.findById("m1")).thenReturn(Optional.of(m));
    when(people.profiles(anyCollection()))
        .thenReturn(Map.of("host", new PersonDto("host", "Lan", null)));
    when(store.recordJoin(anyString(), any())).thenReturn(true);
  }

  private static RtcParticipantEvent ev(String identity, String sid, Instant createdAt) {
    return new RtcParticipantEvent("meet_m1", identity, sid, "evt", createdAt);
  }

  @Test
  void ownsOnlyMeetingRooms() {
    assertThat(handler.supports("meet_m1")).isTrue();
    assertThat(handler.supports("call_c1")).isFalse();
  }

  @Test
  void theFirstPersonInMakesTheMeetingLiveAndIsRecorded() {
    handler.onParticipantJoined(ev("host", "PA_1", at));

    verify(store).markLive("m1", at);
    ArgumentCaptor<Meeting.Attendance> row = ArgumentCaptor.forClass(Meeting.Attendance.class);
    verify(store).recordJoin(eq("m1"), row.capture());
    assertThat(row.getValue().getUserId()).isEqualTo("host");
    assertThat(row.getValue().getDisplayName()).isEqualTo("Lan");
    assertThat(row.getValue().getRole()).isEqualTo("host");
    assertThat(row.getValue().getSid()).isEqualTo("PA_1");
    assertThat(row.getValue().getJoinedAt()).isEqualTo(at);
    verify(busy).markBusy("host", "meet_m1");
    verify(events).roster(m);
  }

  @Test
  void aLiveMeetingIsNotMadeLiveAgainAndUnnamedPeopleStayUnnamed() {
    m.setStatus(MeetingStatus.LIVE);

    handler.onParticipantJoined(ev("guest", "PA_2", null));

    verify(store, never()).markLive(anyString(), any());
    ArgumentCaptor<Meeting.Attendance> row = ArgumentCaptor.forClass(Meeting.Attendance.class);
    verify(store).recordJoin(eq("m1"), row.capture());
    assertThat(row.getValue().getDisplayName()).isNull();
    assertThat(row.getValue().getRole()).isEqualTo("attendee");
    assertThat(row.getValue().getJoinedAt()).isNotNull();
  }

  @Test
  void eventsForEndedOrUnknownMeetingsAreIgnored() {
    m.setStatus(MeetingStatus.ENDED);
    handler.onParticipantJoined(ev("host", "PA_1", at));
    handler.onParticipantLeft(ev("host", "PA_1", at));
    when(store.findById("m1")).thenReturn(Optional.empty());
    handler.onParticipantJoined(ev("host", "PA_1", at));

    verify(store, never()).recordJoin(anyString(), any());
    verify(store, never()).recordLeave(anyString(), anyString(), any(), any());
    verifyNoInteractions(busy, events);
  }

  @Test
  void aJoinThatLostTheRaceWithEndMarksNobodyBusy() {
    m.setStatus(MeetingStatus.LIVE);
    // `end` landed between the handler's read and its write: the store refuses the row.
    when(store.recordJoin(anyString(), any())).thenReturn(false);

    handler.onParticipantJoined(ev("host", "PA_1", at));

    verify(busy, never()).markBusy(anyString(), anyString());
    verify(events, never()).roster(any());
  }

  @Test
  void leavingClosesTheRowFreesThePersonAndUpdatesTheRosterButNeverEndsTheMeeting() {
    m.setStatus(MeetingStatus.LIVE);
    when(store.recordLeave(eq("m1"), eq("host"), eq("PA_1"), any())).thenReturn(true);

    handler.onParticipantLeft(ev("host", "PA_1", at));

    verify(busy).clear("host", "meet_m1");
    verify(events).roster(m);
    verify(closer, never()).close(anyString());
  }

  @Test
  void aStaleOrRepeatedLeaveChangesNothing() {
    m.setStatus(MeetingStatus.LIVE);
    when(store.recordLeave(eq("m1"), eq("host"), eq("PA_OLD"), any())).thenReturn(false);

    handler.onParticipantLeft(ev("host", "PA_OLD", at));

    verifyNoInteractions(busy, events);
  }

  @Test
  void roomFinishedClosesTheMeeting() {
    handler.onRoomFinished("meet_m1");
    handler.onRoomFinished("meet_");

    verify(closer).close("m1");
    verify(closer, never()).close("");
  }
}
